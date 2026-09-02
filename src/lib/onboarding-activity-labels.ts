type AdminRecord = Record<string, unknown>

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
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

export function resolveCatalogLabel(
  rows: AdminRecord[],
  id: number | null,
  idKeys: string[],
  labelKeys: string[]
) {
  if (id === null) return ""
  const found = rows.find((row) => recordMatchesId(row, id, idKeys))
  if (!found) return ""
  const person = personDisplayName(found)
  if (person) return person
  return readText(found, labelKeys)
}

export function resolveRoleLabel(roles: AdminRecord[], id: number | null) {
  return resolveCatalogLabel(
    roles,
    id,
    ["id", "role_id", "roleId"],
    ["display_name", "displayName", "name", "title"]
  )
}

export function resolvePersonLabel(users: AdminRecord[], id: number | null) {
  return resolveCatalogLabel(
    users,
    id,
    ["id", "company_user_id", "companyUserId", "user_id", "userId"],
    ["full_name", "fullName", "display_name", "displayName", "name", "email"]
  )
}

function nestedParty(record: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

export function resolveResponsiblePartyLabel(
  step: AdminRecord | null,
  roles: AdminRecord[],
  users: AdminRecord[]
) {
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
  const userName =
    explicitPerson ||
    personDisplayName(nestedUser) ||
    resolvePersonLabel(users, userId)

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

export function resolveApprovalOwnerLabel(
  approval: AdminRecord | null,
  roles: AdminRecord[],
  users: AdminRecord[]
) {
  if (!approval) return ""
  const explicit = readText(approval, [
    "approver_name",
    "company_user_name",
    "assigned_to_name",
    "owner_name",
    "user_name",
  ])
  if (explicit && !isIdFallback(explicit)) return explicit

  const nestedApprover = nestedParty(approval, [
    "approver",
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

  return resolveResponsiblePartyLabel(approval, roles, users)
}

export function isOnboardingDraftStatus(status: string) {
  const value = status.trim().toLowerCase().replace(/[_-]+/g, " ")
  return value === "draft" || value === "pending submit" || value === "new" || value === ""
}

export function isOnboardingActableStatus(status: string) {
  const value = status.trim().toLowerCase().replace(/[_-]+/g, " ")
  return [
    "active",
    "pending",
    "submitted",
    "in review",
    "awaiting approval",
    "request",
  ].includes(value)
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
