export type SecurityEventRow = Record<string, unknown>

function asRecord(value: unknown): SecurityEventRow | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as SecurityEventRow)
    : null
}

export function parseSecurityMetadata(row: SecurityEventRow): SecurityEventRow {
  const raw = row.metadata ?? row.meta
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      return asRecord(parsed) ?? {}
    } catch {
      return {}
    }
  }
  return asRecord(raw) ?? {}
}

function readText(row: SecurityEventRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return ""
}

export function describeApiPath(path: string): string {
  const normalized = path.trim().toLowerCase()
  if (!normalized) {
    return "a part of the system"
  }
  if (normalized.includes("/analytics")) return "company reports"
  if (normalized.includes("/leave")) return "leave"
  if (normalized.includes("/attendance")) return "attendance"
  if (normalized.includes("/employee")) return "employee records"
  if (normalized.includes("/payroll")) return "payroll"
  if (normalized.includes("/performance")) return "performance"
  if (normalized.includes("/probation")) return "probation"
  if (normalized.includes("/sms")) return "SMS"
  if (normalized.includes("/access-control")) return "door access"
  if (normalized.includes("/companies")) return "company settings"
  if (normalized.includes("/auth") || normalized.includes("/login")) return "sign-in"
  if (normalized.includes("/notification")) return "notifications"
  if (normalized.includes("/role") || normalized.includes("/permission")) return "roles and permissions"
  return "a page they are not allowed to use"
}

export function describePermission(permission: string): string {
  const normalized = permission.trim().toLowerCase()
  if (!normalized) {
    return "the right access"
  }
  if (normalized.includes("analytics")) return "view reports"
  if (normalized.includes("leave")) return "manage leave"
  if (normalized.includes("attendance")) return "manage attendance"
  if (normalized.includes("employee")) return "manage employees"
  if (normalized.includes("payroll")) return "manage payroll"
  if (normalized.includes("compan")) return "manage the company"
  if (normalized.includes("role") || normalized.includes("permission")) return "change roles"
  return permission.replace(/[_:]+/g, " ")
}

export function describeSecurityEvent(
  row: SecurityEventRow,
  nameByActorId?: Map<number, string>,
): {
  title: string
  what: string
  who: string
  why: string
  whenRaw: string
} {
  const metadata = parseSecurityMetadata(row)
  const path = readText(metadata, ["path", "url", "route"])
  const area = describeApiPath(path)
  const reason = readText(row, ["reason", "message"])
  const missing = metadata.missing_permissions
  const missingList = Array.isArray(missing)
    ? missing.map((entry) => describePermission(String(entry)))
    : []
  const actorId = Number(
    row.actor_user_id ?? row.actorUserId ?? row.actor_company_user_id ?? row.actorCompanyUserId ?? row.user_id ?? row.userId,
  )
  const named =
    Number.isFinite(actorId) && nameByActorId
      ? nameByActorId.get(actorId)
      : undefined

  return {
    title: "Access was blocked",
    what: path ? `Tried to open ${area}` : "Tried to open something they cannot use",
    who: named || (Number.isFinite(actorId) ? "A team member" : "Someone"),
    why:
      missingList.length > 0
        ? `They do not have permission to ${missingList.join(" or ")}.`
        : reason.toLowerCase().includes("permission")
          ? "They do not have permission for that page."
          : reason || "The system blocked this action.",
    whenRaw: readText(row, ["occurred_at", "occurredAt", "created_at", "createdAt", "timestamp"]),
  }
}
