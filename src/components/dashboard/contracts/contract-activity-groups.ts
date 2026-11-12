import type { ContractActivityItem } from "@/lib/contracts-api"

export function groupDraftActivity(items: ContractActivityItem[], minutes: number): ContractActivityItem[][] {
  const groups: ContractActivityItem[][] = []
  for (const item of items) {
    const group = groups[groups.length - 1]
    const last = group?.[group.length - 1]
    const elapsed = last ? Date.parse(last.at) - Date.parse(item.at) : NaN
    if (last && item.action === "draft_update" && last.action === "draft_update" && item.outcome === "SUCCESS" && last.outcome === "SUCCESS" && item.actor_id != null && item.actor_id === last.actor_id && elapsed >= 0 && elapsed <= minutes * 60_000) group.push(item)
    else groups.push([item])
  }
  return groups
}

export function summarizeDraftActivity(group: ContractActivityItem[]): ContractActivityItem {
  const first = group[0]
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  for (const item of [...group].reverse()) for (const field of item.changed_fields) {
    if (!(field in oldValues)) oldValues[field] = item.old_values?.[field]
    newValues[field] = item.new_values?.[field]
  }
  return { ...first, changed_fields: Object.keys(oldValues), old_values: oldValues, new_values: newValues }
}
