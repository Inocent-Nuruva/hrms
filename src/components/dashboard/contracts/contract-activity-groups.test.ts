import { describe, expect, it } from "vitest"
import { groupDraftActivity, summarizeDraftActivity } from "./contract-activity-groups"
import type { ContractActivityItem } from "@/lib/contracts-api"

function item(id: string, at: string, actor_id: number, oldValue: string, newValue: string): ContractActivityItem {
  return { id, at, actor_id, kind: "security", action: "draft_update", title: null, detail: null, actor_name: "HR", outcome: "SUCCESS", changed_fields: ["title"], old_values: { title: oldValue }, new_values: { title: newValue } }
}
describe("contract draft activity grouping", () => {
  it("shows the first old value and last new value without changing the source events", () => {
    const events = [item("2", "2026-11-12T10:05:00Z", 1, "B", "C"), item("1", "2026-11-12T10:00:00Z", 1, "A", "B")]
    const group = groupDraftActivity(events, 10)[0]
    expect(summarizeDraftActivity(group)).toMatchObject({ old_values: { title: "A" }, new_values: { title: "C" } })
    expect(events[0].old_values).toEqual({ title: "B" })
    expect(groupDraftActivity(events, 4)).toHaveLength(2)
    expect(groupDraftActivity([events[0], { ...events[1], actor_id: 2 }], 10)).toHaveLength(2)
  })
})
