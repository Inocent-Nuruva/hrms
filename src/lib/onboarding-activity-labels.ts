type AdminRecord = Record<string, unknown>

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as AdminRecord) : null
}

function readText(record: AdminRecord | null, keys: string[]) {
  if (!record) return ""
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function readNumber(record: AdminRecord | null, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function isIdFallback(label: string) {
  return /^#\d+$/.test(label.trim())
}

export function recordMatchesId(row: AdminRecord, id: number, idKeys: string[]) {
  return idKeys.some((key) => readNumber(row, [key]) === id)
}

export function personDisplayName(record: AdminRecord | null, fallback = "") {
  if (!record) return fallback

  const sources = [
    record,
    asRecord(record.company_user),
    asRecord(record.companyUser),
    asRecord(record.user),
    asRecord(record.person),
    asRecord(record.profile),
    asRecord(record.employee),
    asRecord(record.actor),
    asRecord(record.performed_by),
    asRecord(record.performedBy),
  ].filter((source): source is AdminRecord => Boolean(source))

  for (const source of sources) {
    const named = readText(source, [
      "full_name",
      "fullName",
      "display_name",
      "displayName",
      "employee_name",
      "employeeName",
      "preferred_name",
      "preferredName",
    ])
    if (named) return named

    const assembled = [
      readText(source, ["first_name", "firstName"]),
      readText(source, ["middle_name", "middleName"]),
      readText(source, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
    if (assembled) return assembled
  }

  for (const source of sources) {
    const genericName = readText(source, ["name", "title", "email"])
    if (genericName) return genericName
  }

  return fallback
}

export function personEmail(record: AdminRecord | null, fallback = "") {
  if (!record) return fallback

  const sources = [
    record,
    asRecord(record.company_user),
    asRecord(record.companyUser),
    asRecord(record.user),
    asRecord(record.person),
    asRecord(record.profile),
    asRecord(record.employee),
  ].filter((source): source is AdminRecord => Boolean(source))

  for (const source of sources) {
    const email = readText(source, ["email", "email_address", "emailAddress"])
    if (email) return email
  }

  return fallback
}

export function resolveCatalogLabel(rows: AdminRecord[], id: number | null, idKeys: string[], labelKeys: string[]) {
  if (id === null) return ""
  const found = rows.find((row) => recordMatchesId(row, id, idKeys))
  if (!found) return ""
  const person = personDisplayName(found)
  if (person) return person
  return readText(found, labelKeys)
}

export function resolveRoleLabel(roles: AdminRecord[], id: number | null) {
  return resolveCatalogLabel(roles, id, ["id", "role_id", "roleId"], ["display_name", "displayName", "name", "title"])
}

export function resolvePersonLabel(users: AdminRecord[], id: number | null) {
  return resolveCatalogLabel(
    users,
    id,
    ["id", "company_user_id", "companyUserId", "user_id", "userId"],
    ["full_name", "fullName", "display_name", "displayName", "name", "email"],
  )
}

export function resolvePersonEmail(users: AdminRecord[], id: number | null) {
  if (id === null) return ""
  const found = users.find((row) =>
    recordMatchesId(row, id, ["id", "company_user_id", "companyUserId", "user_id", "userId"]),
  )
  return personEmail(found ?? null)
}

const ASSIGNEE_ID_KEYS = ["company_user_id", "companyUserId", "id", "user_id", "userId"] as const

export function collectAssigneeIds(row: AdminRecord): number[] {
  const ids: number[] = []
  const sources = [
    row,
    asRecord(row.user),
    asRecord(row.company_user),
    asRecord(row.companyUser),
    asRecord(row.member),
    asRecord(row.person),
  ]
  for (const source of sources) {
    if (!source) continue
    for (const key of ASSIGNEE_ID_KEYS) {
      const id = readNumber(source, [key])
      if (id !== null && id > 0 && !ids.includes(id)) {
        ids.push(id)
      }
    }
  }
  return ids
}

export function flattenAssigneeRecord(row: AdminRecord): AdminRecord {
  const nested = asRecord(row.user) ?? asRecord(row.company_user) ?? asRecord(row.companyUser) ?? asRecord(row.member)
  if (!nested) {
    return row
  }
  return {
    ...nested,
    ...row,
    id: row.id ?? nested.id,
    user_id: row.user_id ?? row.userId ?? nested.user_id ?? nested.id,
    company_user_id: row.company_user_id ?? row.companyUserId ?? nested.company_user_id ?? nested.id,
    first_name: row.first_name ?? nested.first_name,
    last_name: row.last_name ?? nested.last_name,
    full_name: row.full_name ?? nested.full_name,
    email: row.email ?? nested.email,
  }
}

export function preferredAssigneeId(row: AdminRecord): number | null {
  return collectAssigneeIds(row)[0] ?? null
}

export function findAssigneeRecord(rows: AdminRecord[], assignedId: number | null) {
  if (assignedId === null || assignedId <= 0) {
    return null
  }
  return rows.find((row) => collectAssigneeIds(row).includes(assignedId)) ?? null
}

export function catalogHasRoleMetadata(rows: AdminRecord[]) {
  return rows.some((row) => {
    if (readNumber(row, ["role_id", "roleId"]) !== null) return true
    if (Array.isArray(row.roles) && row.roles.length > 0) return true
    if (Array.isArray(row.role_ids) && row.role_ids.length > 0) return true
    if (Array.isArray(row.roleIds) && row.roleIds.length > 0) return true
    return false
  })
}

export function recordHasRole(row: AdminRecord, roleId: number) {
  if (!roleId || roleId <= 0) return true
  if (readNumber(row, ["role_id", "roleId", "assigned_role_id"]) === roleId) {
    return true
  }
  const lists = [row.roles, row.role_ids, row.roleIds, row.user_roles, row.userRoles]
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (typeof entry === "number" && entry === roleId) return true
      if (typeof entry === "string" && Number(entry) === roleId) return true
      const nested = asRecord(entry)
      if (readNumber(nested, ["id", "role_id", "roleId"]) === roleId) return true
    }
  }
  return false
}

export function filterAssigneesForStep(
  rows: AdminRecord[],
  options: {
    roleId?: number | null
    search?: string
    selectedId?: number | null
  },
) {
  const search = options.search?.trim().toLowerCase() ?? ""
  const roleId = options.roleId && options.roleId > 0 ? options.roleId : null
  const canFilterByRole = roleId !== null && catalogHasRoleMetadata(rows)
  return rows.filter((row) => {
    const ids = collectAssigneeIds(row)
    const isSelected = options.selectedId != null && ids.includes(options.selectedId)
    if (canFilterByRole && !recordHasRole(row, roleId) && !isSelected) {
      return false
    }
    if (!search) return true
    const haystack = [
      personDisplayName(row),
      readText(row, ["email", "user_no", "userNo"]),
      ...ids.map((id) => String(id)),
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(search)
  })
}

function nestedParty(record: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

export function resolveResponsiblePartyLabel(step: AdminRecord | null, roles: AdminRecord[], users: AdminRecord[]) {
  if (!step) return ""

  const explicitPerson = readText(step, [
    "assignee_name",
    "assigned_to_name",
    "owner_name",
    "company_user_name",
    "approver_name",
    "user_name",
  ])

  const nestedUser = nestedParty(step, [
    "assigned_user",
    "assignedUser",
    "assigned_company_user",
    "assignedCompanyUser",
    "company_user",
    "companyUser",
    "assignee",
    "approver",
    "user",
  ])
  const nestedRole = nestedParty(step, ["assigned_role", "assignedRole", "role"])

  const roleId = readNumber(step, ["assigned_role_id", "assignedRoleId", "role_id", "roleId"])
  const userId = readNumber(step, [
    "assigned_user_id",
    "assignedUserId",
    "assigned_company_user_id",
    "assignedCompanyUserId",
    "company_user_id",
    "companyUserId",
    "user_id",
    "userId",
  ])

  const roleName =
    personDisplayName(nestedRole) ||
    readText(nestedRole, ["display_name", "displayName", "name", "title"]) ||
    resolveRoleLabel(roles, roleId)
  const userName = explicitPerson || personDisplayName(nestedUser) || resolvePersonLabel(users, userId)

  const parts: string[] = []
  if (roleName && !isIdFallback(roleName)) {
    parts.push(`Role: ${roleName}`)
  }
  if (userName && !isIdFallback(userName)) {
    parts.push(`User: ${userName}`)
  }

  return parts.join(" • ")
}

export function resolveAuditActorLabel(entry: AdminRecord | null, users: AdminRecord[]) {
  if (!entry) return ""

  const explicit = readText(entry, [
    "actor_name",
    "performed_by_name",
    "user_name",
    "company_user_name",
    "created_by_name",
  ])
  if (explicit && !isIdFallback(explicit)) return explicit

  const nested = nestedParty(entry, [
    "actor",
    "performed_by",
    "performedBy",
    "created_by_user",
    "createdByUser",
    "company_user",
    "companyUser",
    "user",
  ])
  const nestedName = personDisplayName(nested)
  if (nestedName) return nestedName

  const actorId = readNumber(entry, [
    "actor_id",
    "actorId",
    "performed_by_id",
    "performedById",
    "created_by",
    "createdBy",
    "company_user_id",
    "companyUserId",
    "user_id",
    "userId",
  ])
  return resolvePersonLabel(users, actorId)
}

export function resolveApprovalOwnerLabel(approval: AdminRecord | null, roles: AdminRecord[], users: AdminRecord[]) {
  if (!approval) return ""
  const explicit = readText(approval, [
    "approver_name",
    "approverName",
    "company_user_name",
    "assigned_to_name",
    "owner_name",
    "user_name",
  ])
  if (explicit && !isIdFallback(explicit)) return explicit

  const nestedApprover = nestedParty(approval, [
    "approver",
    "original_approver",
    "originalApprover",
    "assigned_user",
    "assignedUser",
    "assigned_company_user",
    "assignedCompanyUser",
    "company_user",
    "companyUser",
    "user",
  ])
  const nestedName = personDisplayName(nestedApprover)
  if (nestedName && !isIdFallback(nestedName)) return nestedName

  const companyUserId = readNumber(approval, [
    "approver_company_user_id",
    "approverCompanyUserId",
    "original_approver_company_user_id",
    "originalApproverCompanyUserId",
    "assigned_company_user_id",
    "assignedCompanyUserId",
    "company_user_id",
    "companyUserId",
  ])
  const catalogName = resolvePersonLabel(users, companyUserId)
  if (catalogName && !isIdFallback(catalogName)) return catalogName

  return resolveResponsiblePartyLabel(approval, roles, users)
}

export function resolveApprovalOwnerEmail(approval: AdminRecord | null, users: AdminRecord[]) {
  if (!approval) return ""

  const explicit = readText(approval, [
    "approver_email",
    "approverEmail",
    "company_user_email",
    "assigned_to_email",
    "owner_email",
    "user_email",
    "email",
  ])
  if (explicit) return explicit

  const nestedApprover = nestedParty(approval, [
    "approver",
    "original_approver",
    "originalApprover",
    "assigned_user",
    "assignedUser",
    "assigned_company_user",
    "assignedCompanyUser",
    "company_user",
    "companyUser",
    "user",
  ])
  const nestedEmail = personEmail(nestedApprover)
  if (nestedEmail) return nestedEmail

  const companyUserId = readNumber(approval, [
    "approver_company_user_id",
    "approverCompanyUserId",
    "original_approver_company_user_id",
    "originalApproverCompanyUserId",
    "assigned_company_user_id",
    "assignedCompanyUserId",
    "company_user_id",
    "companyUserId",
  ])
  return resolvePersonEmail(users, companyUserId)
}

function coerceApprovalsList(value: unknown): AdminRecord[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is AdminRecord => asRecord(entry) !== null)
  }
  const record = asRecord(value)
  if (!record) return []
  for (const key of ["data", "items", "results", "rows", "records", "list", "approvals"] as const) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      const rows = nested.filter((entry): entry is AdminRecord => asRecord(entry) !== null)
      if (rows.length > 0) return rows
    }
  }
  return []
}

export function collectOnboardingApprovals(sources: Array<AdminRecord | null | undefined>) {
  const rows: AdminRecord[] = []
  const seen = new Set<string>()
  for (const source of sources) {
    if (!source) continue
    const lists = [
      source.approvals,
      source.approval_records,
      source.approvalRecords,
      source.pending_approvals,
      source.pendingApprovals,
      source.approval_chain,
      source.approvalChain,
      asRecord(source.progress)?.approvals,
    ]
    for (const list of lists) {
      for (const row of coerceApprovalsList(list)) {
        const id = readNumber(row, ["id", "approval_id", "approvalId"])
        const key = id == null ? JSON.stringify(row).slice(0, 80) : String(id)
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(row)
      }
    }
  }
  return rows
}

export type OnboardingApprovalNode = {
  id: number | null
  level: number
  status: string
  name: string
  email: string
  comments: string
  isCurrent: boolean
  raw: AdminRecord
}

export function summarizeOnboardingApprovals(
  sources: Array<AdminRecord | null | undefined>,
  roles: AdminRecord[],
  users: AdminRecord[],
) {
  const request = sources.find((source): source is AdminRecord => Boolean(source)) ?? null
  const currentLevel =
    readNumber(request, ["current_approval_level", "currentApprovalLevel", "current_level", "currentLevel"]) ?? 0

  const rows = collectOnboardingApprovals(sources)
    .map((approval) => {
      const level = readNumber(approval, ["approval_level", "approvalLevel", "level"]) ?? 0
      const status = (readText(approval, ["status", "approval_status", "approvalStatus"]) || "pending")
        .trim()
        .toLowerCase()
      const name = resolveApprovalOwnerLabel(approval, roles, users)
      const email = resolveApprovalOwnerEmail(approval, users)
      return {
        id: readNumber(approval, ["id", "approval_id", "approvalId"]),
        level,
        status,
        name,
        email,
        comments: readText(approval, ["comments", "comment", "notes"]),
        isCurrent: currentLevel > 0 ? level === currentLevel : status === "pending" || status === "waiting",
        raw: approval,
      }
    })
    .sort((left, right) => left.level - right.level || String(left.id).localeCompare(String(right.id)))

  const pending = rows.filter((row) => {
    const pendingStatus = row.status === "pending" || row.status === "waiting" || row.status.includes("pending")
    if (!pendingStatus) return false
    return currentLevel > 0 ? row.level === currentLevel || row.isCurrent : true
  })
  const pendingNames = pending.map((row) => row.name).filter(Boolean)
  const pendingLabels = pending
    .map((row) => (row.email ? `${row.name || "Approver"} (${row.email})` : row.name))
    .filter(Boolean)
  const requestStatus = (readText(request, ["status", "request_status"]) || "").toLowerCase()

  let waitingLabel = "No pending approver on the current level"
  if (["completed", "approved"].includes(requestStatus)) {
    waitingLabel = "Fully approved"
  } else if (["rejected", "cancelled", "canceled"].includes(requestStatus)) {
    waitingLabel = requestStatus.replace(/\b\w/g, (char) => char.toUpperCase())
  } else if (pendingLabels.length === 1) {
    waitingLabel = `Pending with ${pendingLabels[0]}`
  } else if (pendingLabels.length > 1) {
    waitingLabel = `Pending with ${pendingLabels[0]} +${pendingLabels.length - 1}`
  } else if (currentLevel > 0) {
    waitingLabel = `Waiting at approval level ${currentLevel}`
  }

  return {
    rows,
    currentLevel,
    pending,
    pendingNames,
    pendingLabels,
    waitingLabel,
  }
}

export function isOnboardingDraftStatus(status: string) {
  const value = status.trim().toLowerCase().replace(/[_-]+/g, " ")
  return (
    value === "draft" ||
    value === "not started" ||
    value === "pending" ||
    value === "pending submit" ||
    value === "new" ||
    value === ""
  )
}

export function isOnboardingActableStatus(status: string) {
  const value = status.trim().toLowerCase().replace(/[_-]+/g, " ")
  return ["submitted", "in review", "in progress"].includes(value)
}

export function mergeAdminRecords(...groups: AdminRecord[][]) {
  const byKey = new Map<string, AdminRecord>()
  for (const row of groups.flat()) {
    const keys = [
      readNumber(row, ["company_user_id", "companyUserId"]),
      readNumber(row, ["id"]),
      readNumber(row, ["user_id", "userId"]),
    ].filter((value): value is number => value !== null)

    if (keys.length === 0) continue

    const mapKey = keys.map((key) => String(key)).join(":")
    const existing = byKey.get(mapKey)
    byKey.set(mapKey, existing ? { ...existing, ...row } : row)
  }
  return Array.from(byKey.values())
}
