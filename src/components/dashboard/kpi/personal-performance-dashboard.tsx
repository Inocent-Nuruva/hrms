"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Dropdown, Option, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text } from "@fluentui/react-components";
import { FluentSearchBox } from "@/components/common/fluent-search-box";
import { achievementApi, type Achievement } from "@/lib/achievement-api";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { readKpiToken } from "@/lib/kpi-session";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";

type PersonalData = { assignments: KpiAssignment[]; achievements: Achievement[] };

function displayValue(value: unknown, unit?: string | null): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ("value" in record) return displayValue(record.value, unit);
    if ("min" in record && "max" in record) return `${record.min}–${record.max}${unit ? ` ${unit}` : ""}`;
    if ("description" in record) return String(record.description);
    return Object.values(record).map(String).join(" · ");
  }
  return `${String(value)}${unit ? ` ${unit}` : ""}`;
}

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function AssignmentList({ title, rows, achievements, empty, showHeading = true }: {
  title: string; rows: KpiAssignment[]; achievements: Map<number, Achievement>; empty?: string; showHeading?: boolean;
}) {
  const router = useRouter();
  return <section className="space-y-3" aria-label={title}>
    {showHeading && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <Text as="h2" size={500} weight="semibold" className="block" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{title}</Text>
      <Badge appearance="outline" color="brand">{rows.length}</Badge>
    </div>}
    {rows.length === 0 ? <p className="py-5 text-sm text-muted-foreground">{empty ?? "No KPIs match your filters."}</p> : <div className="overflow-x-auto border border-border bg-card">
      <Table aria-label={title} size="small" className="w-full min-w-[720px] text-sm"><TableHeader className="bg-muted/40"><TableRow><TableHeaderCell>KPI</TableHeaderCell><TableHeaderCell>Reporting period</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell><TableHeaderCell>Actual</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableRow></TableHeader><TableBody>
        {rows.map((assignment) => { const achievement = achievements.get(assignment.id); const unit = assignment.definitionVersion?.measurementUnit; const href = `/dashboard/me/kpi/${assignment.id}`; return <TableRow key={assignment.id} tabIndex={0} aria-label={`Open ${assignment.definitionVersion?.name ?? "assigned KPI"}`} className="cursor-pointer even:bg-muted/15 hover:bg-primary/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => router.push(href)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); router.push(href); } }}><TableCell className="max-w-64 break-words py-4 font-semibold"><Link href={href} onClick={(event) => event.stopPropagation()} className="hover:text-primary hover:underline">{assignment.definitionVersion?.name ?? "Assigned KPI"}</Link></TableCell><TableCell className="max-w-72 break-words py-4"><span className="block font-medium">{assignment.period?.label ?? "Reporting period"}</span>{assignment.period?.startDate && assignment.period?.endDate && <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(assignment.period.startDate)} – {formatDate(assignment.period.endDate)}</span>}</TableCell><TableCell className="py-4">{displayValue(assignment.currentTarget?.target, unit)}</TableCell><TableCell className="py-4">{displayValue(achievement?.current?.actual, unit)}</TableCell><TableCell className="py-4"><KpiStatusBadge status={achievement?.current?.status ?? (assignment.status === "active" ? "Not submitted" : assignment.status)} /></TableCell></TableRow>; })}
      </TableBody></Table>
    </div>}
  </section>;
}

export function PersonalPerformanceDashboard() {
  const [data, setData] = React.useState<PersonalData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [kpiSearch, setKpiSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [periodFilter, setPeriodFilter] = React.useState("all");
  const load = React.useCallback(async () => {
    const token = readKpiToken();
    if (!token) { setError("Sign in to view your performance."); setLoading(false); return; }
    setLoading(true);
    try {
      const [assignments, achievements] = await Promise.all([kpiApi.mine(token), achievementApi.mine(token)]);
      setData({ assignments, achievements });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your performance could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener("hrms:refresh-page-data", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("hrms:refresh-page-data", refresh); };
  }, [load]);

  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const allAssignments = data?.assignments ?? [];
  const current = allAssignments.filter((row) => row.status === "active" && (!row.period?.startDate || row.period.startDate <= today) && (!row.period?.endDate || row.period.endDate >= today));
  const upcoming = allAssignments.filter((row) => row.status === "active" && !!row.period?.startDate && row.period.startDate > today);
  const previous = allAssignments.filter((row) => row.status !== "active" || (!!row.period?.endDate && row.period.endDate < today)).sort((a, b) => (b.period?.endDate ?? "").localeCompare(a.period?.endDate ?? ""));
  const achievements = new Map<number, Achievement>(data?.achievements.map((item) => [item.assignmentId, item]) ?? []);
  const periodOptions = [...new Map(allAssignments.filter((row) => row.period).map((row) => [row.period.id, row.period])).values()];
  const searchTerm = kpiSearch.trim().toLocaleLowerCase();
  const matchesKpiFilters = (row: KpiAssignment) => {
    const status = achievements.get(row.id)?.current?.status ?? "not_submitted";
    return (periodFilter === "all" || String(row.periodId) === periodFilter) &&
      (statusFilter === "all" || status === statusFilter) &&
      (!searchTerm || `${row.definitionVersion?.name ?? ""} ${row.period?.label ?? ""}`.toLocaleLowerCase().includes(searchTerm));
  };
  const filteredCurrent = current.filter(matchesKpiFilters);
  const filteredUpcoming = upcoming.filter(matchesKpiFilters);
  const filteredPrevious = previous.filter(matchesKpiFilters);
  const hasKpiFilters = !!searchTerm || statusFilter !== "all" || periodFilter !== "all";

  return <main className="min-w-0" aria-label="My Performance">
    <KpiPageHeader title="My KPIs" section="My Performance" flushBelow />
    <div className="space-y-8 py-6">
      {loading && <div className="py-8"><Spinner label="Loading your performance" size="medium" /></div>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {!loading && !error && data && <>
        <div className="flex flex-wrap items-end gap-3" aria-label="Filter my KPIs">
          <FluentSearchBox aria-label="Search my KPIs" placeholder="Search KPI or reporting period" value={kpiSearch} onChange={(_, value) => setKpiSearch(value.value)} className="w-full sm:max-w-sm" />
          <Dropdown aria-label="Filter result status" value={{ all: "All statuses", not_submitted: "Not submitted", draft: "Draft", submitted: "Submitted", under_review: "In review", returned: "Returned", approved: "Approved", rejected: "Rejected" }[statusFilter] ?? "All statuses"} selectedOptions={[statusFilter]} onOptionSelect={(_, value) => setStatusFilter(value.optionValue ?? "all")} className="w-full sm:!w-44"><Option value="all">All statuses</Option><Option value="not_submitted">Not submitted</Option><Option value="draft">Draft</Option><Option value="submitted">Submitted</Option><Option value="under_review">In review</Option><Option value="returned">Returned</Option><Option value="approved">Approved</Option><Option value="rejected">Rejected</Option></Dropdown>
          <Dropdown aria-label="Filter reporting period" value={periodFilter === "all" ? "All periods" : periodOptions.find((item) => String(item.id) === periodFilter)?.label ?? "All periods"} selectedOptions={[periodFilter]} onOptionSelect={(_, value) => setPeriodFilter(value.optionValue ?? "all")} className="w-full sm:!w-56"><Option value="all">All periods</Option>{periodOptions.map((item) => <Option key={item.id} value={String(item.id)}>{item.label}</Option>)}</Dropdown>
          {hasKpiFilters && <Button appearance="subtle" onClick={() => { setKpiSearch(""); setStatusFilter("all"); setPeriodFilter("all"); }}>Clear filters</Button>}
          <span className="ml-auto text-sm text-muted-foreground">Showing {filteredCurrent.length + filteredUpcoming.length + filteredPrevious.length} of {allAssignments.length}</span>
        </div>
        <AssignmentList title="Current KPIs" showHeading={false} rows={filteredCurrent} achievements={achievements} empty={hasKpiFilters ? "No current KPIs match your filters." : allAssignments.length ? "No KPIs are due in the current reporting period." : "Your manager has not assigned a KPI yet. New assignments will appear here."} />
        {(upcoming.length > 0 || filteredUpcoming.length > 0) && <AssignmentList title="Upcoming KPIs" rows={filteredUpcoming} achievements={achievements} />}
        {(previous.length > 0 || filteredPrevious.length > 0) && <AssignmentList title="Previous KPIs" rows={filteredPrevious} achievements={achievements} />}
      </>}
    </div>
  </main>;
}
