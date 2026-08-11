import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/services/api"
import { authService } from "@/services/authService"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  })
}

describe("authService foundation helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists and normalizes active sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          sessions: [
            {
              session_id: "sess-current",
              is_current: true,
              device_name: "MacBook Pro",
              browser: "Chrome",
              os: "macOS",
              ip_address: "10.0.0.7",
              last_used_at: "2026-08-11T08:15:00.000Z",
            },
            {
              id: "sess-other",
              current: false,
              user_agent: "Mobile Safari",
              created_at: "2026-08-10T18:20:00.000Z",
            },
          ],
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await authService.listSessions("access-token")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/sessions",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      })
    )
    expect(result).toEqual([
      expect.objectContaining({
        id: "sess-current",
        label: "MacBook Pro",
        isCurrent: true,
        browser: "Chrome",
        os: "macOS",
        ipAddress: "10.0.0.7",
      }),
      expect.objectContaining({
        id: "sess-other",
        label: "Mobile Safari",
        isCurrent: false,
      }),
    ])
  })

  it("posts logout-all with the current bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await authService.logoutAll("access-token")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/logout-all",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      })
    )
  })

  it("verifies email using the query token contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await authService.verifyEmail("abc-123")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/verify-email?token=abc-123",
      expect.objectContaining({
        method: "GET",
      })
    )
  })

  it("resends verification email with normalized email address", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await authService.resendVerification(" USER@Example.com ")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/resend-verification",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      })
    )
  })

  it("parses switch-company response into the persisted company context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "next-access-token",
        company_id: 4,
        company_name: "Acme East",
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await authService.switchCompany("access-token", 4)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/switch-company",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
        body: JSON.stringify({ company_id: 4 }),
      })
    )
    expect(result).toEqual({
      accessToken: "next-access-token",
      companyId: 4,
      companyName: "Acme East",
    })
  })

  it("surfaces expired verification links as API errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          message: "Verification token expired",
        },
        { status: 410 }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(authService.verifyEmail("expired-token")).rejects.toBeInstanceOf(ApiError)
  })
})
