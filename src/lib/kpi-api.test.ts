import { afterEach, describe, expect, it, vi } from "vitest"
import { kpiApi } from "./kpi-api"

afterEach(() => vi.unstubAllGlobals())

describe("Phase 1A KPI API client", () => {
  it("requests personal assignments from the session-derived endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 7 }]), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await kpiApi.mine("local-token")).toEqual([{ id: 7 }])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/me\/assignments$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer local-token" }) }))
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("employeeId")
  })
  it("posts a definition through the existing authenticated API client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 12, code: "LOSS" }), { status: 201, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const body = { code: "LOSS", name: "Loss", category: "Finance", measurementType: "percentage", measurementUnit: "%", direction: "lower", frequency: "monthly" }
    expect(await kpiApi.createDefinition("local-token", body)).toMatchObject({ id: 12 })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/definitions$/), expect.objectContaining({ method: "POST", body: JSON.stringify(body), headers: expect.objectContaining({ Authorization: "Bearer local-token" }) }))
  })
})
