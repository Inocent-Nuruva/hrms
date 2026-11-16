import { describe, expect, it } from "vitest";
import { ContractSaveQueue } from "./contract-workspace-save-queue";

describe("serialized draft saves", () => {
  it("saves later edits after an in-flight save with the new revision", async () => {
    let text = "first";
    let resolveFirst!: (value: { updatedAt: string }) => void;
    const calls: Array<[string, string]> = [];
    const queue = new ContractSaveQueue(
      "v1",
      () => text,
      async (value, version) => {
        calls.push([value, version]);
        if (calls.length === 1)
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        return { updatedAt: "v3" };
      },
    );
    queue.changed();
    const saving = queue.flush();
    text = "second";
    queue.changed();
    resolveFirst({ updatedAt: "v2" });
    await saving;
    expect(calls).toEqual([
      ["first", "v1"],
      ["second", "v2"],
    ]);
    expect(queue.dirty).toBe(false);
  });
  it("preserves dirty state and blocks later saves after a conflict", async () => {
    const queue = new ContractSaveQueue(
      "v1",
      () => "edit",
      async () => {
        throw { status: 409 };
      },
    );
    queue.changed();
    await expect(queue.flush()).rejects.toMatchObject({ status: 409 });
    expect(queue.dirty).toBe(true);
    expect(queue.conflicted).toBe(true);
    expect(await queue.flush()).toBe(false);
  });
  it("retries network failures without losing the queued revision", async () => {
    let calls = 0;
    const waits: number[] = [];
    const queue = new ContractSaveQueue(
      "v1",
      () => "edit",
      async () => {
        if (++calls < 3) throw new TypeError("offline");
        return { updatedAt: "v2" };
      },
      async (delay) => {
        waits.push(delay);
      },
    );
    queue.changed();
    expect(await queue.flush()).toBe(true);
    expect(waits).toEqual([500, 1000]);
    expect(queue.dirty).toBe(false);
  });
  it("reapplies a conflicted revision using the newly fetched version", async () => {
    const versions: string[] = [];
    const queue = new ContractSaveQueue(
      "v1",
      () => "edit",
      async (_value, version) => {
        versions.push(version);
        if (version === "v1") throw { status: 409 };
        return { updatedAt: "v3" };
      },
    );
    queue.changed();
    await expect(queue.flush()).rejects.toMatchObject({ status: 409 });
    queue.rebase("v2");
    expect(await queue.flush()).toBe(true);
    expect(versions).toEqual(["v1", "v2"]);
  });
});
