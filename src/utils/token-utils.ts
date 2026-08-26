type UnknownRecord = Record<string, unknown>

export function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null
}

export function readString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) {
    return undefined
  }

  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return atob(padded)
  } catch {
    return null
  }
}

export function decodeJwtPayload(token: string): UnknownRecord | null {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  const decoded = decodeBase64Url(parts[1])
  if (!decoded) {
    return null
  }

  try {
    return asRecord(JSON.parse(decoded))
  } catch {
    return null
  }
}

export function isLikelyRefreshToken(token: string, refreshToken?: string): boolean {
  const normalized = token.trim()
  if (!normalized) {
    return true
  }

  if (refreshToken && normalized === refreshToken.trim()) {
    return true
  }

  const jwtPayload = decodeJwtPayload(normalized)
  if (!jwtPayload) {
    return false
  }

  const tokenType = readString(jwtPayload, ["token_type", "type", "typ"])?.toLowerCase()
  if (tokenType === "refresh" || tokenType === "refresh_token") {
    return true
  }

  return false
}
