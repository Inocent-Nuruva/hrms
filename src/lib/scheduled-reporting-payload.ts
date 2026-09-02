export function nullablePositiveInteger(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null
}
