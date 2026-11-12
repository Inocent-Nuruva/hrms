export function targetFor(type: string, direction: string, raw: string): Record<string, unknown> {
  if (direction === "range") {
    const parts = raw.split(",").map((part) => part.trim())
    if (parts.length !== 2 || parts.some((part) => part === "")) throw new Error("Enter min,max for a range target")
    const [min, max] = parts.map(Number)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error("Enter a valid min,max range")
    return { min, max }
  }
  if (["numeric", "percentage", "currency", "duration"].includes(type)) {
    const value = Number(raw)
    if (!Number.isFinite(value) || raw.trim() === "") throw new Error("Enter a numeric target")
    return { value }
  }
  if (type === "binary") {
    if (!["true", "false"].includes(raw.trim().toLowerCase())) throw new Error("Enter true or false")
    return { value: raw.trim().toLowerCase() === "true" }
  }
  if (!raw.trim()) throw new Error("Enter a target description")
  return { description: raw.trim() }
}
