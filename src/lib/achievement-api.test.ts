import { afterEach, describe, expect, it, vi } from "vitest"
import { achievementApi } from "./achievement-api"

afterEach(() => vi.unstubAllGlobals())
describe("Phase 3 achievement API client", () => {
  it("uses the session-derived personal endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await achievementApi.mine("employee-token")).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/me\/achievements$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer employee-token" }) }))
  })
  it("sends optimistic version and manager decision through authenticated routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 4 }), { status: 201, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    await achievementApi.decide("manager-token", 4, "approve", 2, "Verified")
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/achievements\/4\/approve$/), expect.objectContaining({ method: "POST", body: JSON.stringify({ rowVersion: 2, comments: "Verified" }), headers: expect.objectContaining({ Authorization: "Bearer manager-token" }) }))
  })
})
