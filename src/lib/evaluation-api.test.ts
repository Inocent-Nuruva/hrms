import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluationApi } from "./evaluation-api";

afterEach(() => vi.unstubAllGlobals());
describe("Phase 4 evaluation API client", () => {
  it("retrieves evaluations from the authenticated company context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await evaluationApi.mine("employee-token")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/evaluations\/me$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer employee-token" }) }));
  });
  it("sends the optimistic version for manager review and finalization", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: 4 }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await evaluationApi.managerAction("manager-token", 4, 7, "submit");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/evaluations\/4\/manager\/submit$/), expect.objectContaining({ method: "POST", body: JSON.stringify({ rowVersion: 7 }), headers: expect.objectContaining({ Authorization: "Bearer manager-token" }) }));
    await evaluationApi.finalize("hr-token", 4, 8);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/evaluations\/4\/finalize$/), expect.objectContaining({ method: "POST", body: JSON.stringify({ rowVersion: 8 }), headers: expect.objectContaining({ Authorization: "Bearer hr-token" }) }));
  });
  it("sends HR reviewer reassignment and audited exception requests to the existing API", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: 4 }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await evaluationApi.reassignHrReviewer("hr-token", 4, 12, "Reviewer unavailable");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/evaluations\/4\/reassign-hr-reviewer$/), expect.objectContaining({ method: "POST", body: JSON.stringify({ companyUserId: 12, reason: "Reviewer unavailable" }) }));
    await evaluationApi.grantDeadlineException("hr-token", 4, "self", "Approved exception");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/hr\/kpi\/evaluations\/4\/deadline-exceptions$/), expect.objectContaining({ method: "POST", body: JSON.stringify({ stage: "self", reason: "Approved exception" }) }));
  });
});
