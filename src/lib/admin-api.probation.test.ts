import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createProbationPolicy,
  generateProbationLetter,
  getMyProbation,
  getProbationCase,
  getProbationDashboard,
  listMyTeamProbationCases,
  listProbationCases,
  listProbationPolicies,
  submitMyProbationSelfAssessment,
  submitProbationHrDecision,
  submitProbationManagerReview,
  updateProbationPolicy,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  })
}

describe("probation admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads dashboard, policies, and cases with optional status filters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { open_cases: 5, due_this_week: 2 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [{ id: 4, code: "FT-90", name: "Full time 90 days" }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [{ id: 18, caseNo: "PRB-18", status: "IN_REVIEW" }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [{ id: 19, caseNo: "PRB-19", status: "IN_REVIEW" }],
          },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const dashboard = await getProbationDashboard("token")
    const policies = await listProbationPolicies("token", "ACTIVE")
    const cases = await listProbationCases("token", "IN_REVIEW")
    const team = await listMyTeamProbationCases("token", "IN_REVIEW")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/probation/dashboard/summary",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/probation/policies?status=ACTIVE",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/probation/cases?status=IN_REVIEW",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/probation/cases/my-team?status=IN_REVIEW",
      expect.objectContaining({ method: "GET" }),
    )
    expect(dashboard).toEqual(expect.objectContaining({ open_cases: 5 }))
    expect(policies).toEqual([expect.objectContaining({ code: "FT-90" })])
    expect(cases).toEqual([expect.objectContaining({ caseNo: "PRB-18" })])
    expect(team).toEqual([expect.objectContaining({ caseNo: "PRB-19" })])
  })

  it("creates and updates policies and runs case review actions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 4 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 4, status: "ACTIVE" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { id: 18, caseNo: "PRB-18", status: "IN_REVIEW" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: 18, status: "MANAGER_REVIEWED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 18, status: "CONFIRMED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { document_id: 91 } }))
    vi.stubGlobal("fetch", fetchMock)

    await createProbationPolicy("token", {
      code: "FT-90",
      name: "Full time 90 days",
      probation_period_days: 90,
      effective_from: "2026-01-01",
    })
    await updateProbationPolicy("token", 4, { status: "ACTIVE" })
    const detail = await getProbationCase("token", 18)
    await submitProbationManagerReview("token", 18, {
      recommendation: "CONFIRM",
      comments: "Ready to confirm.",
    })
    await submitProbationHrDecision("token", 18, {
      decision: "CONFIRMED",
      comments: "Confirmed.",
      confirmation_date: "2026-08-17",
    })
    await generateProbationLetter("token", 18)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/probation/policies",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/probation/policies/4",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/probation/cases/18",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/probation/cases/18/manager-review",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/probation/cases/18/generate-letter",
      expect.objectContaining({ method: "POST" }),
    )
    expect(detail).toEqual(expect.objectContaining({ caseNo: "PRB-18" }))
  })

  it("loads the employee probation record and submits a self-assessment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: { id: 18, status: "IN_PROGRESS", caseNo: "PRB-18" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: 18, status: "SELF_ASSESSED" } }))
    vi.stubGlobal("fetch", fetchMock)

    const mine = await getMyProbation("token")
    await submitMyProbationSelfAssessment("token", 18, {
      overall_comment: "Settled into the role.",
      ratings: [{ criterion_code: "QUALITY", rating: 4 }],
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/probation",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/me/probation/18/self-assessment",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          overall_comment: "Settled into the role.",
          ratings: [{ criterion_code: "QUALITY", rating: 4 }],
        }),
      }),
    )
    expect(mine).toEqual(expect.objectContaining({ caseNo: "PRB-18" }))
  })
})
