"use client";

import { Card, MessageBar, MessageBarBody, Spinner, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, Text } from "@fluentui/react-components";
import { KpiFluentSelect } from "./kpi-fluent-fields";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiFeedback, KpiPageHeader } from "./kpi-page-elements";
import { KpiWizardControls, KpiWizardProgress, type KpiEntryMode } from "./kpi-guided-flow";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { readKpiToken, reportsEnabled } from "@/lib/kpi-session";
import { kpiReportApi, type KpiReportDocument, type KpiReportKind } from "@/lib/kpi-report-api";
import { kpiAnalyticsApi } from "@/lib/kpi-analytics-api";
import { kpiApi, type KpiAssignment, type KpiPeriod } from "@/lib/kpi-api";
import { evaluationApi, type EvaluationCycle } from "@/lib/evaluation-api";
import { listBranches, listDepartments, type AdminRecord } from "@/lib/admin-api";

const classes = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const action = "rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

function text(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

export function personalReportPeriods(assignments: KpiAssignment[]): KpiPeriod[] {
  return Array.from(new Map(assignments.filter((row) => row.period).map((row) => [row.period.id, row.period])).values());
}

export function KpiReportsWorkspace({ personal = false }: { personal?: boolean }) {
  const actor = useDashboardActor();
  const roles = actor.roleNames ?? [];
  const admin = roles.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role));
  const executive = roles.includes("MANAGEMENT") && !admin;
  const manager = roles.some((role) => ["DEPARTMENT_MANAGER", "BRANCH_MANAGER"].includes(role));
  const [kind, setKind] = React.useState<KpiReportKind>(personal ? "individual" : "hr");
  const [periodId, setPeriodId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [cycleId, setCycleId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([]);
  const [cycles, setCycles] = React.useState<EvaluationCycle[]>([]);
  const [departments, setDepartments] = React.useState<AdminRecord[]>([]);
  const [branches, setBranches] = React.useState<AdminRecord[]>([]);
  const [employees, setEmployees] = React.useState<Array<{ id: number; name: string }>>([]);
  const [report, setReport] = React.useState<KpiReportDocument | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [entryMode, setEntryMode] = React.useState<KpiEntryMode>("manual");
  const [wizardStep, setWizardStep] = React.useState(0);
  const [exportFormat, setExportFormat] = React.useState<"pdf" | "xlsx">("pdf");
  const wizardSteps = [
    { title: "Report type", description: "Choose an authorized report. Personal and executive access remains restricted." },
    { title: "Scope", description: "Filter by permitted organizational subjects." },
    { title: "Period and cycle", description: "Choose a reporting period or evaluation cycle." },
    { title: "Preview", description: "Review actual authorized data and any report limitations." },
    { title: "Download", description: "Export the same report and filters to PDF or Excel." },
  ];
  const requestSequence = React.useRef(0);
  const token = actor.ready ? readKpiToken() : "";

  React.useEffect(() => {
    if (!reportsEnabled || !token) return;
    let active = true;
    Promise.allSettled([
      personal ? kpiApi.mine(token).then(personalReportPeriods) : kpiApi.periods(token),
      !admin || personal ? Promise.resolve(null) : evaluationApi.cycles(token),
      personal || executive ? Promise.resolve(null) : listDepartments(token, { limit: 100 }),
      personal || executive ? Promise.resolve(null) : listBranches(token, { limit: 100 }),
      personal || executive ? Promise.resolve(null) : kpiAnalyticsApi.subjects(token),
    ]).then((results) => {
      if (!active) return;
      const [periodResult, cycleResult, departmentResult, branchResult, subjectResult] = results;
      if (periodResult.status === "fulfilled") setPeriods(periodResult.value as KpiPeriod[]);
      if (cycleResult.status === "fulfilled" && cycleResult.value) setCycles(cycleResult.value);
      if (departmentResult.status === "fulfilled" && departmentResult.value) setDepartments(departmentResult.value.rows);
      if (branchResult.status === "fulfilled" && branchResult.value) setBranches(branchResult.value.rows);
      if (subjectResult.status === "fulfilled" && subjectResult.value) setEmployees(subjectResult.value.employees);
    });
    return () => { active = false; };
  }, [token, personal, executive, admin]);

  React.useEffect(() => {
    if (personal) setKind("individual");
    else if (executive) setKind("executive");
    else if (manager && !admin) setKind("department");
  }, [personal, executive, manager, admin]);

  const filters = React.useMemo(() => ({
    ...(periodId ? { periodId: Number(periodId) } : {}),
    ...(departmentId ? { departmentId: Number(departmentId) } : {}),
    ...(branchId ? { branchId: Number(branchId) } : {}),
    ...(employeeId && !personal && !executive ? { employeeId: Number(employeeId) } : {}),
    ...(cycleId ? { cycleId: Number(cycleId) } : {}),
    page, limit: 20,
  }), [periodId, departmentId, branchId, employeeId, cycleId, page, personal, executive]);

  const load = React.useCallback(async () => {
    if (!token || (!admin && !personal && kind === "hr") || (executive && kind !== "executive") || (personal && kind !== "individual")) return;
    const sequence = ++requestSequence.current;
    setBusy(true); setError(""); setNotice(""); setReport(null);
    try { const result = await kpiReportApi.get(token, kind, filters); if (requestSequence.current === sequence) setReport(result); }
    catch (cause) { if (requestSequence.current === sequence) setError(cause instanceof Error ? cause.message : "Unable to load report"); }
    finally { if (requestSequence.current === sequence) setBusy(false); }
  }, [token, kind, filters, admin, personal, executive]);
  React.useEffect(() => { if (token && reportsEnabled) void load(); }, [token, load]);

  async function download(format: "pdf" | "xlsx") {
    setBusy(true); setError(""); setNotice("");
    try {
      const file = await kpiReportApi.download(token, kind, filters, format);
      const href = URL.createObjectURL(file.blob);
      const link = document.createElement("a"); link.href = href; link.download = file.filename; link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice(`${format.toUpperCase()} downloaded for the current filters and page.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Download failed"); }
    finally { setBusy(false); }
  }

  if (!reportsEnabled) return <main className="p-6">KPI reports are not enabled in this environment.</main>;
  if (!actor.ready) return <main className="p-6">Loading your report access…</main>;
  if (actor.scope !== "company") return <main className="p-6">Company access is required.</main>;
  const kinds: Array<[KpiReportKind, string]> = personal ? [["individual", "My KPI report"]] : executive ? [["executive", "Executive summary"]] : admin ? [["hr", "HR evaluation"], ["individual", "Individual"], ["department", "Department"], ["branch", "Branch"], ["executive", "Executive summary"]] : [["individual", "Individual"], ["department", "Department"], ["branch", "Branch"]];
  return <main className="space-y-4 pt-3">
    <KpiPageHeader title={personal ? "My KPI Reports" : "KPI Reports"} description="Reports use approved achievements. Live scores may change; finalized evaluations retain their historical snapshot." actions={<Link href={personal ? "/dashboard/me/kpi" : "/dashboard/kpi"} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">Back to KPIs</Link>} />
    <div className="flex flex-wrap gap-2"><KpiFluentButton type="button" onClick={() => { setEntryMode("guided"); setWizardStep(0) }}>Guided report builder</KpiFluentButton><KpiFluentButton type="button" onClick={() => setEntryMode("manual")}>Manual filters</KpiFluentButton></div>
    {entryMode === "guided" && <KpiWizardProgress steps={wizardSteps} step={wizardStep} />}
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Report filters">
      {!personal && (entryMode === "manual" || wizardStep === 0) && <label className="space-y-1 text-sm"><span>Report type</span><KpiFluentSelect className={`${classes} w-full`} value={kind} onChange={(event) => { setKind(event.target.value as KpiReportKind); setPage(1); }}>{kinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</KpiFluentSelect></label>}
      {(entryMode === "manual" || wizardStep === 2) && <label className="space-y-1 text-sm"><span>Reporting period</span><KpiFluentSelect className={`${classes} w-full`} value={periodId} onChange={(event) => { setPeriodId(event.target.value); setPage(1); }}><option value="">All periods</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.label}</option>)}</KpiFluentSelect></label>}
      {admin && !personal && (entryMode === "manual" || wizardStep === 2) && <label className="space-y-1 text-sm"><span>Evaluation cycle</span><KpiFluentSelect className={`${classes} w-full`} value={cycleId} onChange={(event) => { setCycleId(event.target.value); setPage(1); }}><option value="">All cycles</option>{cycles.map((cycle) => <option value={cycle.id} key={cycle.id}>{cycle.name}</option>)}</KpiFluentSelect></label>}
      {!personal && !executive && (entryMode === "manual" || wizardStep === 1) && <><label className="space-y-1 text-sm"><span>Department</span><KpiFluentSelect className={`${classes} w-full`} value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}><option value="">All permitted departments</option>{departments.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</KpiFluentSelect></label><label className="space-y-1 text-sm"><span>Branch</span><KpiFluentSelect className={`${classes} w-full`} value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}><option value="">All permitted branches</option>{branches.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</KpiFluentSelect></label><label className="space-y-1 text-sm"><span>Employee</span><KpiFluentSelect className={`${classes} w-full`} value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setPage(1); }}><option value="">All permitted employees</option>{employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</KpiFluentSelect></label></>}
      {entryMode === "manual" && <div className="flex flex-wrap items-end gap-2"><KpiFluentButton className={action} type="button" disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : "Generate report"}</KpiFluentButton><KpiFluentButton type="button" disabled={busy} onClick={() => { setPeriodId(""); setDepartmentId(""); setBranchId(""); setEmployeeId(""); setCycleId(""); setPage(1); }}>Reset filters</KpiFluentButton><KpiFluentButton type="button" disabled={busy || !report} onClick={() => void download("pdf")}>Download PDF</KpiFluentButton><KpiFluentButton type="button" disabled={busy || !report} onClick={() => void download("xlsx")}>Download Excel</KpiFluentButton></div>}
    </section>
    {entryMode === "guided" && wizardStep === 4 && <label className="block max-w-xs text-sm">Export format<KpiFluentSelect aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "pdf" | "xlsx")}><option value="pdf">PDF</option><option value="xlsx">Excel</option></KpiFluentSelect></label>}
    {entryMode === "guided" && <KpiWizardControls steps={wizardSteps} step={wizardStep} busy={busy} finishDisabled={!report} error={error} onBack={() => setWizardStep((step) => step - 1)} onNext={() => { if (wizardStep === 2) void load(); setWizardStep((step) => step + 1) }} onCancel={() => setEntryMode("manual")} onFinish={() => void download(exportFormat)} finishLabel={`Download ${exportFormat.toUpperCase()}`} />}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
    {busy && !report && <Spinner size="small" label="Loading report" />}
    {report && (entryMode === "manual" || wizardStep >= 3) && <><Card appearance="outline" className="p-5"><p className="text-xs text-muted-foreground">{report.company} · {report.period} · Generated {new Date(report.generatedAt).toLocaleString()}</p><h2 className="mt-2 text-xl font-semibold">{report.title}</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{report.summary.map((line, index) => <li key={index}>{line}</li>)}</ul></Card>
      {report.sections.map((section) => <Card key={section.title} appearance="outline" className="p-5"><h2 className="text-lg font-semibold">{section.title}</h2>{section.note && <p className="my-2 text-xs text-muted-foreground">{section.note}</p>}{section.rows.length ? <div className="overflow-x-auto"><Table className="w-full text-left text-sm"><TableHeader><TableRow>{section.columns.map((column) => <TableHeaderCell key={column} className="border-b p-2">{column}</TableHeaderCell>)}</TableRow></TableHeader><TableBody>{section.rows.map((row, index) => <TableRow key={index}>{section.columns.map((column) => <TableCell key={column} className="border-b p-2 align-top">{text(row[column])}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <p className="py-4 text-sm text-muted-foreground">No authorized records match these filters.</p>}</Card>)}
      <MessageBar intent="info"><MessageBarBody><Text weight="semibold">How to read this report</Text><ul className="mt-1 list-disc pl-5">{report.limitations.map((line, index) => <li key={index}>{line}</li>)}</ul></MessageBarBody></MessageBar>
      <div className="flex items-center gap-3 text-sm"><KpiFluentButton className={classes} disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Previous page</KpiFluentButton><span>Page {page}</span><KpiFluentButton className={classes} disabled={busy || !report.sections.some((section) => section.title.includes("current page") && section.rows.length >= 20)} onClick={() => setPage(page + 1)}>Next page</KpiFluentButton></div>
    </>}
  </main>;
}
