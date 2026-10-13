import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  adminRequest,
  invalidateAdminGetCache,
  getAttendancePolicy,
  listDepartments,
} from "./admin-api";
import { ApiResponseSchema, ContractError } from "./request-json";
const Entity = z.object({ id: z.number(), name: z.string() });
afterEach(() => {
  invalidateAdminGetCache();
  vi.unstubAllGlobals();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("strict resource contracts and cache generations", () => {
  it("rejects successful invalid JSON and mismatched typed records", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("<html>not JSON</html>"))
        .mockResolvedValueOnce(Response.json({ id: "invalid", name: "Test" })),
    );
    await expect(adminRequest("/api/example", Entity)).rejects.toBeInstanceOf(
      ContractError,
    );
    await expect(adminRequest("/api/example", Entity)).rejects.toBeInstanceOf(
      ContractError,
    );
  });
  it("keeps the primary empty collection despite a nonempty sibling relation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            data: [],
            employees: [{ id: 7 }],
            meta: { total: 0 },
          }),
        ),
    );
    expect(
      (await listDepartments("test-token", { page: 1, limit: 10 })).rows,
    ).toEqual([]);
  });
  it("does not replace an entity with the identity of its company relation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ id: 42, name: "Group", company: { id: 7 } }),
        ),
    );
    expect((await getAttendancePolicy("test-token", 42))?.id).toBe(42);
  });
  it("rejects old pending GETs and never caches them after a mutation", async () => {
    const old = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ id: 1, name: "updated" }));
    vi.stubGlobal("fetch", fetchMock);
    const first = adminRequest("/api/example", Entity, { cacheTtlMs: 60_000 });
    const assertion = expect(first).rejects.toMatchObject({
      name: "AbortError",
    });
    await adminRequest("/api/example", ApiResponseSchema, {
      method: "PATCH",
      body: { name: "updated" },
    });
    old.resolve(Response.json({ id: 1, name: "old" }));
    await assertion;
    expect(
      (await adminRequest("/api/example", Entity, { cacheTtlMs: 60_000 })).name,
    ).toBe("updated");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("does not deduplicate a new generation against an older pending promise", async () => {
    const old = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(Response.json({ id: 1, name: "new" }));
    vi.stubGlobal("fetch", fetchMock);
    const first = adminRequest("/api/example", Entity);
    const assertion = expect(first).rejects.toMatchObject({
      name: "AbortError",
    });
    invalidateAdminGetCache();
    expect((await adminRequest("/api/example", Entity)).name).toBe("new");
    old.resolve(Response.json({ id: 1, name: "old" }));
    await assertion;
  });
  it("revalidates cached raw payloads correctly for transforming schemas", async () => {
    const transformed = Entity.transform((row) => row.name.length);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: 1, name: "Test" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await adminRequest("/api/example", transformed, { cacheTtlMs: 60_000 }),
    ).toBe(4);
    expect(
      await adminRequest("/api/example", transformed, { cacheTtlMs: 60_000 }),
    ).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
