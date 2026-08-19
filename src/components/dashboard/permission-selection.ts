import type { AdminRecord } from "@/lib/admin-api"

export type PermissionOption = {
  id: string
  name: string
  label: string
  description?: string
  group: string
}

function prettifyGroup(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

export function permissionGroupFromName(name: string) {
  const normalized = name.trim()
  if (!normalized) return "General"
  if (normalized.includes(":")) {
    return prettifyGroup(normalized.split(":")[0] ?? "general")
  }
  if (normalized.includes(".")) {
    return prettifyGroup(normalized.split(".")[0] ?? "general")
  }
  return "General"
}

function readPermissionString(permission: AdminRecord, keys: string[]): string {
  for (const key of keys) {
    const value = permission[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

export function toPermissionOptions(permissions: AdminRecord[]): PermissionOption[] {
  const options: PermissionOption[] = []
  for (const permission of permissions) {
    const idRaw = permission.id
    const id =
      typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw) : ""
    const name =
      readPermissionString(permission, ["name", "key", "code", "display_name", "displayName"])
    if (!id || !name) continue
    const label =
      readPermissionString(permission, ["display_name", "displayName", "name"]) || name
    const description = readPermissionString(permission, ["description"])
    options.push({
      id,
      name,
      label,
      description: description || undefined,
      group: permissionGroupFromName(name),
    })
  }
  return options.sort(
    (a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)
  )
}

function tokenFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function looksLikePermissionKey(value: string) {
  return value.includes(":") || value.includes(".")
}

export function permissionTokenFromAssignment(entry: unknown): string | null {
  if (typeof entry === "string" || typeof entry === "number") {
    return tokenFromUnknown(entry)
  }
  if (typeof entry !== "object" || entry === null) {
    return null
  }

  const record = entry as AdminRecord
  const nested =
    typeof record.permission === "object" && record.permission !== null
      ? (record.permission as AdminRecord)
      : null

  const keyTokens = [
    record.name,
    record.key,
    record.code,
    nested?.name,
    nested?.key,
    nested?.code,
  ]
    .map(tokenFromUnknown)
    .filter((value): value is string => Boolean(value))
  const preferredKey =
    keyTokens.find(looksLikePermissionKey) ?? keyTokens[0] ?? null
  if (preferredKey) {
    return preferredKey
  }

  const fallbacks = [
    record.display_name,
    record.displayName,
    nested?.display_name,
    nested?.displayName,
    record.permission_id,
    record.permissionId,
    nested?.id,
    record.id,
  ]
  for (const value of fallbacks) {
    const token = tokenFromUnknown(value)
    if (token) return token
  }
  return null
}

export function permissionAliases(option: PermissionOption): string[] {
  return Array.from(new Set([option.name, option.id, option.label].filter(Boolean)))
}

export function isPermissionSelected(
  option: PermissionOption,
  selected: Iterable<string>,
) {
  const selectedSet = selected instanceof Set ? selected : new Set(selected)
  return permissionAliases(option).some((alias) => selectedSet.has(alias))
}

export function togglePermissionSelection(
  option: PermissionOption,
  selectedNames: string[],
): string[] {
  const aliases = new Set(permissionAliases(option))
  const isSelected = selectedNames.some((entry) => aliases.has(entry))
  const withoutAliases = selectedNames.filter((entry) => !aliases.has(entry))
  if (isSelected) {
    return withoutAliases
  }
  return [...withoutAliases, option.name]
}

export function canonicalizePermissionNames(
  names: string[],
  options: PermissionOption[],
): string[] {
  const byAlias = new Map<string, string>()
  for (const option of options) {
    for (const alias of permissionAliases(option)) {
      byAlias.set(alias, option.name)
    }
  }
  const result: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const canonical = byAlias.get(name) ?? name
    if (seen.has(canonical)) continue
    seen.add(canonical)
    result.push(canonical)
  }
  return result
}
