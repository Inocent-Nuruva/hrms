import Decimal from "decimal.js";

export function numericActivityTotal(values: unknown[]): { total: string; count: number } | null {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numbers.length) return null;
  return { total: numbers.reduce((sum, value) => sum.plus(value), new Decimal(0)).toString(), count: numbers.length };
}
