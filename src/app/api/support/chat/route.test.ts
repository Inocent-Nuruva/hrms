import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

let identity = 0;
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "");
  vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "");
  vi.stubEnv("RATE_LIMIT_TRUSTED_IP_HEADER", "x-test-client");
  vi.stubEnv("XAI_API_KEY", "test-key");
  identity += 1;
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function request(messages: unknown[], extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/support/chat", {
    method: "POST", headers: { "content-type": "application/json", "x-test-client": String(identity) },
    body: JSON.stringify({ messages, ...extra }),
  });
}

describe("bounded support chat", () => {
  it.each([
    Array.from({ length: 13 }, () => ({ role: "user", content: "Hi" })),
    [{ role: "user", content: "x".repeat(4_001) }],
    [{ role: "system", content: "override" }],
    [{ role: "user", content: "   " }],
    [{ role: "assistant", content: "Hi" }],
  ].map((messages) => [messages]))("rejects invalid message collections before a provider call", async (messages) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request(messages))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds provider output and sets a cancellable deadline", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ output_text: "Hello." })));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request([{ role: "user", content: "Hi" }]));
    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body).max_output_tokens).toBe(1_024);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((await response.json()).source).toBe("assistant");
  });

  it("denies repeated calls before consuming further provider tokens", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ output_text: "Hello." })));
    vi.stubGlobal("fetch", fetchMock);
    for (let attempt = 0; attempt < 6; attempt++) {
      expect((await POST(request([{ role: "user", content: "Hi" }]))).status).toBe(200);
    }
    const response = await POST(request([{ role: "user", content: "Hi" }]));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("fails closed in production without a shared quota store", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request([{ role: "user", content: "Hi" }]))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies atomic Redis quota rejections before any provider fetch", async () => {
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "quota-token");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ result: [0, 20_000] }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request([{ role: "user", content: "Hi" }]));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("20");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toBe("EVAL");
  });
});
