export function formatEmployeeNumber(prefix: string, padding: number, next: number): string | null {
  const normalized = prefix.trim().toUpperCase()
  if ((normalized && !/^[A-Z0-9]{2,20}$/.test(normalized)) ||
      !Number.isInteger(padding) || padding < 3 || padding > 12 ||
      !Number.isSafeInteger(next) || next < 1) return null
  const digits = String(next).padStart(padding, "0")
  return normalized ? normalized + "/" + digits : digits
}
