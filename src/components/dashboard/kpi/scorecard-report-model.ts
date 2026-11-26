import type { Scorecard, ScorecardEntry } from "@/lib/scorecard-api";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const scoreFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatReportNumber(value: unknown, fixed = false): string {
  const number = numericValue(value);
  return number === null ? "—" : (fixed ? scoreFormatter : numberFormatter).format(number);
}

export function formatReportPercent(value: unknown): string {
  const number = numericValue(value);
  return number === null ? "—" : `${numberFormatter.format(number)}%`;
}

function withUnit(value: unknown, unit?: string | null): string {
  const formatted = formatReportNumber(value);
  if (formatted === "—") return formatted;
  return unit === "%" ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted;
}

export function reportTarget(entry: ScorecardEntry): string {
  const target = entry.target;
  if (!target) return "—";
  if (target.min !== undefined && target.max !== undefined) return `${withUnit(target.min, entry.measurementUnit)}–${withUnit(target.max, entry.measurementUnit)}`;
  if (typeof target.value === "boolean") return target.value ? "Yes" : "No";
  if (typeof target.value === "string" && numericValue(target.value) === null) return target.value;
  if (target.value !== undefined && target.value !== null) return withUnit(target.value, entry.measurementUnit);
  if (typeof target.description === "string") return target.description;
  return Object.values(target).map(String).join(" · ") || "—";
}

export function reportActual(entry: ScorecardEntry): string {
  const actual = entry.actual;
  if (actual === null || actual === undefined || actual === "") return "—";
  if (typeof actual === "boolean") return actual ? "Yes" : "No";
  if (typeof actual === "object") {
    if ("completed" in actual && typeof actual.completed === "boolean") return actual.completed ? "Yes" : "No";
    return JSON.stringify(actual);
  }
  const numeric = numericValue(actual);
  return numeric === null ? String(actual) : withUnit(numeric, entry.measurementUnit);
}

export function reportComparison(entry: ScorecardEntry): { target: number; actual: number; targetWidth: number; actualWidth: number; direction: string } | null {
  if (!["numeric", "percentage", "currency", "duration"].includes(entry.measurementType ?? "")) return null;
  if (!["higher", "lower"].includes(entry.direction ?? "")) return null;
  const target = numericValue(entry.target?.value);
  const actual = numericValue(entry.actual);
  if (target === null || actual === null || target < 0 || actual < 0 || Math.max(target, actual) === 0) return null;
  const scale = Math.max(target, actual);
  return { target, actual, targetWidth: target / scale * 100, actualWidth: actual / scale * 100, direction: entry.direction === "lower" ? "Lower is better" : "Higher is better" };
}

export function reportContributions(card: Scorecard) {
  const available = card.entries.map((entry, index) => ({ entry, index, value: numericValue(entry.weightedScore) }));
  const missing = available.filter((item) => item.value === null).length;
  const negative = available.some((item) => item.value !== null && item.value < 0);
  const total = available.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const visualizable = card.currentVersion.mode === "weighted" && !negative && total > 0;
  return {
    items: available.map((item) => ({ ...item, share: visualizable ? (item.value ?? 0) / total * 100 : 0 })),
    missing,
    negative,
    total,
    visualizable,
  };
}

export function reportWeightTotal(card: Scorecard): number {
  return card.entries.reduce((sum, entry) => sum + (numericValue(entry.weight) ?? 0), 0);
}
