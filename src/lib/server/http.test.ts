import { describe, expect, it } from "vitest";
import { HttpError, readLimitedBody } from "./http";

describe("bounded request bodies", () => {
  it("rejects overflowing streams without retaining the overflowing chunk", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(4)); controller.enqueue(new Uint8Array(4)); },
      cancel() { cancelled = true; },
    });
    const request = new Request("http://localhost/upload", {
      method: "POST", body, duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readLimitedBody(request, 5)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });

  it("counts real bytes even when Content-Length underreports", async () => {
    const request = new Request("http://localhost/chat", {
      method: "POST", headers: { "content-length": "1" }, body: "abcdef",
    });
    await expect(readLimitedBody(request, 5)).rejects.toBeInstanceOf(HttpError);
  });

  it("retains exact-limit bodies", async () => {
    const bytes = await readLimitedBody(new Request("http://localhost/chat", {
      method: "POST", body: "abcde",
    }), 5);
    expect(new TextDecoder().decode(bytes)).toBe("abcde");
  });
});
