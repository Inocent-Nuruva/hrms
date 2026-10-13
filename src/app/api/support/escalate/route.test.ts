import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "./route";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function request(body: unknown = { summary: "Help with leave", transcript: [] }, authorization = "Bearer verified-token") {
  return new Request("http://localhost:3000/api/support/escalate", {
    method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
describe("server support escalation", () => {
  it("uses an absolute operational fallback despite a relative public API base", async () => {
    vi.stubEnv("INTERNAL_BACKEND_URL", ""); vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ sent: true })); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request())).status).toBe(200);
    expect(fetchMock.mock.calls[0][0].toString()).toBe("http://127.0.0.1:4000/api/support/escalate");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("uses the configured internal backend without duplicating its API prefix", async () => {
    vi.stubEnv("INTERNAL_BACKEND_URL", "https://backend.example.com/api/");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ sent: true }, { status: 201 })); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request())).status).toBe(201);
    expect(fetchMock.mock.calls[0][0].toString()).toBe("https://backend.example.com/api/support/escalate");
  });
  it.each(["/api", "file:///tmp/service", "http://localhost:3000", "https://u:p@example.com"])(
    "rejects relative, unsafe, and self-recursing destinations %s", async (url) => {
      vi.stubEnv("INTERNAL_BACKEND_URL", url);
      const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
      expect((await POST(request())).status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("rejects missing authentication before consuming the body", async () => {
    const input = request({}, "");
    expect((await POST(input)).status).toBe(401);
    expect(input.bodyUsed).toBe(false);
  });
  it("preserves validation/throttle failures without exposing backend 500 details", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ message: ["summary too long"] }, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ message: "internal SQL details" }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const validation = await POST(request()); expect(validation.status).toBe(400);
    expect((await validation.json()).error).toBe("summary too long");
    const failure = await POST(request()); expect(failure.status).toBe(502);
    expect(JSON.stringify(await failure.json())).not.toContain("SQL");
  });
  it("maps provider timeout to a bounded 504 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Deadline", "TimeoutError")));
    expect((await POST(request())).status).toBe(504);
  });
});
