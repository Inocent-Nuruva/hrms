import { afterEach, describe, expect, it, vi } from "vitest"

import {
  acknowledgeOnboardingRequest,
  approveOnboardingRequest,
  assignOffboardingClearance,
  delegateOnboardingApproval,
  submitOnboardingRequest,
  deleteOffboardingDocument,
  ensureDraftOnboardingRequest,
  listMyOffboardingRequests,
  listMyOnboardingRequests,
  updateOffboardingAction,
  updateOffboardingAssetReturn,
  updateOffboardingDocument,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("documented onboarding and offboarding leftovers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("creates a draft onboarding request and treats an existing one as success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: { id: 2, status: "draft", employee_id: 139 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 409,
            message: "Employee already has active onboarding request ONB-2026-000001",
          },
          { status: 409 },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    const created = await ensureDraftOnboardingRequest("token", {
      employee_id: 139,
      workflow_id: 1,
      title: "Onboarding for Damas Urio Damas",
    })
    const existing = await ensureDraftOnboardingRequest("token", {
      employee_id: 139,
      workflow_id: 1,
      title: "Onboarding for Damas Urio Damas",
    })

    expect(created).toEqual(expect.objectContaining({ id: 2, status: "draft" }))
    expect(existing).toBeNull()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/onboarding/requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_id: 139,
          workflow_id: 1,
          title: "Onboarding for Damas Urio Damas",
          submit: false,
        }),
      }),
    )
  })

  it("lists my onboarding and offboarding requests", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/me/onboarding")) {
        return jsonResponse({ data: [{ id: 11, status: "in_progress" }] })
      }
      return jsonResponse({ data: [{ id: 22, status: "submitted" }] })
    })
    vi.stubGlobal("fetch", fetchMock)

    const onboarding = await listMyOnboardingRequests("token")
    const offboarding = await listMyOffboardingRequests("token")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/onboarding",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/me/offboarding",
      expect.objectContaining({ method: "GET" }),
    )
    expect(onboarding).toEqual([expect.objectContaining({ id: 11 })])
    expect(offboarding).toEqual([expect.objectContaining({ id: 22 })])
  })

  it("acknowledges onboarding and delegates a pending approval", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await acknowledgeOnboardingRequest("token", 8, {
      accepted: true,
      acknowledgement_version: "v1",
    })
    await delegateOnboardingApproval("token", 8, 3, {
      delegate_company_user_id: 44,
      reason: "On leave",
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/onboarding/requests/8/acknowledge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          accepted: true,
          acknowledgement_version: "v1",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/onboarding/requests/8/approvals/3/delegate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          delegate_company_user_id: 44,
          reason: "On leave",
        }),
      }),
    )
  })

  it("submits a draft by creating a new request with submit=true", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const method = String(init?.method ?? "GET").toUpperCase()
      const path = String(url)
      if (path.endsWith("/api/onboarding/requests/3") && method === "GET") {
        return jsonResponse({
          data: {
            id: 3,
            employee_id: 139,
            workflow_id: 1,
            title: "TEST",
            description: "TEST",
            status: "draft",
          },
        })
      }
      if (path.endsWith("/api/onboarding/requests") && method === "POST") {
        return jsonResponse({ data: { id: 4, status: "submitted" } })
      }
      if (path.endsWith("/api/onboarding/requests/3/cancel") && method === "POST") {
        return jsonResponse({ data: { ok: true } })
      }
      return jsonResponse({ data: {} })
    })
    vi.stubGlobal("fetch", fetchMock)

    await submitOnboardingRequest("token", 3, { workflow_id: 9 })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/onboarding/requests/3",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/onboarding/requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_id: 139,
          submit: true,
          workflow_id: 1,
          title: "TEST",
          description: "TEST",
        }),
      }),
    )
  })

  it("reads employee_id from nested employee when the GET envelope also has company", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const method = String(init?.method ?? "GET").toUpperCase()
      const path = String(url)
      if (path.endsWith("/api/onboarding/requests/3") && method === "GET") {
        return jsonResponse({
          data: {
            id: 3,
            title: "TEST",
            status: "draft",
            company: { id: 1, name: "Acme" },
            employee: { id: 139, first_name: "Kevin", last_name: "Kiggundu" },
            workflow: { id: 1, name: "General" },
          },
        })
      }
      if (path.endsWith("/api/onboarding/requests") && method === "POST") {
        return jsonResponse({ data: { id: 4, status: "submitted" } })
      }
      return jsonResponse({ data: { ok: true } })
    })
    vi.stubGlobal("fetch", fetchMock)

    await submitOnboardingRequest("token", 3, { employee_id: 139 })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/onboarding/requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_id: 139,
          submit: true,
          workflow_id: 1,
          title: "TEST",
        }),
      }),
    )
  })

  it("approves an onboarding request without sending an empty signature_url", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await approveOnboardingRequest("token", 3, {
      approve: true,
      comments: "Approved",
      signature_url: "",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/onboarding/requests/3/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          approve: true,
          comments: "Approved",
        }),
      }),
    )
  })

  it("updates nested offboarding actions, assets, clearances, and documents", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await updateOffboardingAction("token", 9, 4, { status: "completed" })
    await updateOffboardingAssetReturn("token", 9, 6, { status: "returned" })
    await assignOffboardingClearance("token", 9, 2, {
      owner_company_user_id: 15,
      remarks: "IT owner",
    })
    await updateOffboardingDocument("token", 9, 7, { title: "Exit checklist" })
    await deleteOffboardingDocument("token", 9, 7)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/offboarding/requests/9/actions/4",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/offboarding/requests/9/assets/6",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "returned" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/offboarding/requests/9/clearances/2/assign",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          owner_company_user_id: 15,
          remarks: "IT owner",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/offboarding/requests/9/documents/7",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Exit checklist" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/offboarding/requests/9/documents/7",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
