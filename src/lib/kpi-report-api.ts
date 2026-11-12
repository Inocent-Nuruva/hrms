import { adminRequest, downloadAdminBlob } from "@/lib/admin-api";
import type { AnalyticsFilters } from "@/lib/kpi-analytics-api";

export type KpiReportKind = "individual" | "department" | "branch" | "hr" | "executive";
export type KpiReportDocument = {
  kind: KpiReportKind;
  title: string;
  company: string;
  generatedAt: string;
  period: string;
  filters: Record<string, string | number>;
  page: number;
  pageSize: number;
  summary: string[];
  sections: Array<{ title: string; columns: string[]; rows: Array<Record<string, string | number | null>>; note?: string }>;
  limitations: string[];
};

function url(kind: KpiReportKind, filters: AnalyticsFilters, format?: "pdf" | "xlsx") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  if (format) params.set("format", format);
  return `/api/hr/kpi/reports/${kind}${params.size ? `?${params}` : ""}`;
}

export const kpiReportApi = {
  get: (token: string, kind: KpiReportKind, filters: AnalyticsFilters = {}) =>
    adminRequest<KpiReportDocument>(url(kind, filters), { token, dedupe: false }),
  download: (token: string, kind: KpiReportKind, filters: AnalyticsFilters, format: "pdf" | "xlsx") =>
    downloadAdminBlob(url(kind, filters, format), token, `kpi-${kind}-report.${format}`),
};
