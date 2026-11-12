import { afterEach, describe, expect, it, vi } from "vitest"
import { scorecardApi } from "./scorecard-api"

afterEach(() => vi.unstubAllGlobals())

describe("Phase 2 scorecard API client", () => {
  it("reads personal scorecards using only the authenticated session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await scorecardApi.mine("employee-token")).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/scorecards\/me$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer employee-token" }) }))
  })

  it("sends configuration without treating example scores as achievements", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 7 }), { status: 201, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const body = { code: "SERVICE", name: "Service", subjectType: "employee", subjectId: 12, periodId: 3, mode: "weighted" as const, policyVersionId: 5, entries: [{ assignmentId: 9, weight: "100", required: true }] }
    await scorecardApi.create("manager-token", body)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/scorecards$/), expect.objectContaining({ method: "POST", body: JSON.stringify(body), headers: expect.objectContaining({ Authorization: "Bearer manager-token" }) }))
  })

  it("marks preview inputs with the dedicated nonpersisting endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ exampleOnly: true, persisted: false, overallScore: "90" }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await scorecardApi.preview("manager-token", 4, [{ assignmentId: 9, actual: 90 }])
    expect(result).toMatchObject({ exampleOnly: true, persisted: false })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/scorecards\/4\/preview$/), expect.objectContaining({ method: "POST" }))
  })
})
