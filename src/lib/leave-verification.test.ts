import { describe, expect, it, vi } from "vitest";

import { lookupLeaveVerification } from "@/lib/leave-verification";

const TOKEN = "a".repeat(43);

function respond(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("lookupLeaveVerification", () => {
  it("rejects malformed tokens without calling the API", async () => {
    const fetcher = respond(200);
    await expect(lookupLeaveVerification("abc", fetcher)).resolves.toEqual({
      kind: "not_found",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts the token in the body without credentials", async () => {
    const fetcher = respond(200, { verification_status: "valid" });
    const result = await lookupLeaveVerification(TOKEN, fetcher);
    expect(result).toEqual({ kind: "found", data: { verification_status: "valid" } });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/leave\/verification\/lookup$/);
    expect(String(url)).not.toContain(TOKEN);
    expect(init).toMatchObject({ method: "POST", credentials: "omit" });
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN });
  });

  it("unwraps a { data } envelope", async () => {
    const fetcher = respond(200, { data: { verification_status: "pending" } });
    await expect(lookupLeaveVerification(TOKEN, fetcher)).resolves.toEqual({
      kind: "found",
      data: { verification_status: "pending" },
    });
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "error"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    await expect(lookupLeaveVerification(TOKEN, respond(status))).resolves.toEqual({
      kind,
    });
  });

  it("maps network failures to error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(lookupLeaveVerification(TOKEN, fetcher)).resolves.toEqual({
      kind: "error",
    });
  });
});
