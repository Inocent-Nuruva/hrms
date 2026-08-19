export function mergeUniqueNavItems<T extends { url?: string; title: string }>(
  ...groups: T[][]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const group of groups) {
    for (const item of group) {
      const key = item.url || item.title
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}
