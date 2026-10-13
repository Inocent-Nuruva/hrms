export function cleanKpiCategory(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function collectKpiCategories(values: readonly string[]): string[] {
  const categories = new Map<string, string>();
  for (const value of values) {
    const category = cleanKpiCategory(value);
    if (category) {
      const key = category.toLocaleLowerCase("en");
      if (!categories.has(key)) categories.set(key, category);
    }
  }
  return [...categories.values()].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function resolveKpiCategory(
  value: string,
  categories: readonly string[],
): string {
  const cleaned = cleanKpiCategory(value);
  return (
    categories.find(
      (category) =>
        category.toLocaleLowerCase("en") === cleaned.toLocaleLowerCase("en"),
    ) ?? cleaned
  );
}
