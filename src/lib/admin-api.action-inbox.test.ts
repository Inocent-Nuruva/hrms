import { afterEach, describe, expect, it, vi } from "vitest"
import { listAllMyActionItems, reportMyActionItemIssue } from "./admin-api"

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } })
}
afterEach(() => vi.unstubAllGlobals())
describe("action inbox API", () => {
  it("loads subsequent pages so employee groups include every assigned item", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))))
      .mockResolvedValueOnce(response([{ id: 101 }]))
    vi.stubGlobal("fetch", fetchMock)
    expect(await listAllMyActionItems("token")).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain("page=2")
  })
  it("persists an issue through the assigned action comment endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ id: "comment-1" }))
    vi.stubGlobal("fetch", fetchMock)
    await reportMyActionItemIssue("token", 12, "Email licence unavailable")
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/me/action-items/12/comments")
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: "POST", body: JSON.stringify({ comment: "Email licence unavailable" }),
    }))
  })
})
