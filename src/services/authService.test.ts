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

  it("regenerates 2FA backup codes with the current token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        backup_codes: ["ABC1-DEF2-GHI3", "JKL4-MNO5-PQR6"],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const codes = await authService.regenerateBackupCodes("access-token", "123456")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/users/2fa/backup-codes/regenerate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
        body: JSON.stringify({ token: "123456" }),
      })
    )
    expect(codes).toEqual(["ABC1-DEF2-GHI3", "JKL4-MNO5-PQR6"])
  })

  it("posts logout with the session bearer token even when refresh is blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await authService.logout({ accessToken: "session-bearer", refreshToken: "" })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-bearer",
        }),
        body: JSON.stringify({}),
      }),
    )
  })

  it("includes refresh_token on logout only when one is stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await authService.logout({
      accessToken: "session-bearer",
      refreshToken: "refresh-token",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-bearer",
        }),
        body: JSON.stringify({ refresh_token: "refresh-token" }),
      }),
    )
  })

  it("does not call logout when there is no session bearer", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await authService.logout({ accessToken: "", refreshToken: "" })

    expect(fetchMock).not.toHaveBeenCalled()
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

  it("treats an explicitly empty live permission list as authoritative", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 7,
          full_name: "Revoked User",
          email: "revoked@example.com",
          dashboard_type: "admin",
          roles: [],
          permissions: [],
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const user = await authService.getCurrentUser("access-token")

    expect(user.permissions).toEqual([])
    expect(user.accessContextResolved).toBe(true)
  })

  it("marks profile-only current-user responses for token compatibility fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 8,
          full_name: "Legacy User",
          email: "legacy@example.com",
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const user = await authService.getCurrentUser("access-token")

    expect(user.permissions).toEqual([])
    expect(user.accessContextResolved).toBe(false)
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
