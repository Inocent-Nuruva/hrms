import type { AdminRecord } from "@/lib/admin-api"
import { readString, rowId } from "./talent-visuals"
import { resolveBackendMediaUrl } from "@/lib/backend-media-url"

export function recordValue(value: unknown): AdminRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AdminRecord : {}
}

export function actionSubject(row: AdminRecord) {
  const employee = recordValue(row.subject_employee)
  const metadata = recordValue(row.metadata)
  const employeeId = readString(employee, ["id"]) || readString(row, ["assigneeEmployeeId", "assignee_employee_id"]) || readString(metadata, ["employeeId", "employee_id"])
  const name = readString(employee, ["name"]) || readString(metadata, ["employeeName", "employee_name"]) || "Employee details unavailable"
  const requestId = readString(metadata, ["onboarding_request_id", "offboarding_request_id"])
  const defaultAvatar = recordValue(employee.selected_default_avatar ?? employee.selectedDefaultAvatar)
  const photoUrl = resolveBackendMediaUrl(
    readString(employee, ["profile_photo_url", "profilePhotoUrl"]) ||
    readString(defaultAvatar, ["image_path", "imagePath", "file_url", "fileUrl"]),
  ) ?? undefined
  return {
    key: employeeId ? `employee:${employeeId}` : `request:${readString(row, ["sourceModule", "source_module"])}:${requestId || rowId(row)}`,
    name,
    number: readString(employee, ["employee_no"]),
    department: readString(employee, ["department"]),
    position: readString(employee, ["position"]),
    photoUrl,
  }
}

export function isOpenAction(row: AdminRecord) {
  return ["OPEN", "PENDING", "TODO", "ACTION_REQUIRED"].includes(readString(row, ["status"], "OPEN").toUpperCase())
}

export function isEmployeeRequestAction(row: AdminRecord) {
  return readString(row, ["sourceEntityType", "source_entity_type"]).toUpperCase() !== "DAILY_ACTIVITY_REPORT"
}

export function actionReference(row: AdminRecord) {
  const type = readString(row, ["sourceEntityType", "source_entity_type"]).toUpperCase()
  const metadata = recordValue(row.metadata)
  const id = readString(row, ["sourceEntityId", "source_entity_id"])
  const requestId = type === "ONBOARDING_TASK"
    ? readString(metadata, ["onboarding_request_id"])
    : type === "OFFBOARDING_TASK" ? readString(metadata, ["offboarding_request_id"]) : id
  return { type, id, requestId }
}

export type InboxFilters = { search: string; status: string; module: string; priority: string; due: string; kind: string }
export const defaultInboxFilters: InboxFilters = { search: "", status: "open", module: "all", priority: "all", due: "all", kind: "all" }

export function filterAndGroupActions(actions: AdminRecord[], filters: InboxFilters, now = new Date()) {
  const groups = new Map<string, { subject: ReturnType<typeof actionSubject>; items: AdminRecord[] }>()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  for (const row of actions) {
    if (!isEmployeeRequestAction(row)) continue
    const sourceKey = readString(row, ["sourceKey", "source_key"])
    if (sourceKey.startsWith("daily-activity:missing-escalation:")) continue
    const subject = actionSubject(row)
    const sourceModule = readString(row, ["sourceModule", "source_module"])
    const kind = readString(row, ["actionType", "action_type"]).toUpperCase()
    const status = readString(row, ["status"], "OPEN").toUpperCase()
    const dueText = readString(row, ["dueAt", "due_at"])
    const due = dueText ? new Date(dueText).getTime() : NaN
    if (filters.status === "open" && !isOpenAction(row)) continue
    if (filters.status === "completed" && status !== "COMPLETED") continue
    if (filters.status === "cancelled" && status !== "CANCELLED") continue
    if (filters.module !== "all" && sourceModule !== filters.module) continue
    if (filters.priority !== "all" && readString(row, ["priority"]).toUpperCase() !== filters.priority) continue
    if (filters.kind !== "all" && kind !== filters.kind) continue
    if (filters.due === "overdue" && !(isOpenAction(row) && due < now.getTime())) continue
    if (filters.due === "today" && !(due >= today && due < tomorrow)) continue
    if (filters.due === "none" && Number.isFinite(due)) continue
    const search = filters.search.trim().toLowerCase()
    const metadata = recordValue(row.metadata)
    const haystack = [subject.name, subject.number, subject.department, subject.position, sourceModule, row.title, row.description, metadata.onboarding_request_id, metadata.offboarding_request_id].join(" ").toLowerCase()
    if (search && !haystack.includes(search)) continue
    const group = groups.get(subject.key) ?? { subject, items: [] }
    group.items.push(row)
    groups.set(subject.key, group)
  }
  return [...groups.values()]
}
