"use client";

import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { ArrowReset24Regular, DocumentEdit24Regular, DocumentPdf24Regular, Filter24Regular, TableSimple24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { KpiFluentSelect } from "./kpi-fluent-fields";
import * as React from "react";
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

function text(value: unknown) {
  return value == null || value === "" ? "—" : String(value);
}

export function personalReportPeriods(assignments: KpiAssignment[]): KpiPeriod[] {
  return Array.from(new Map(assignments.filter((row) => row.period).map((row) => [row.period.id, row.period])).values());
}

export function KpiReportsWorkspace({ personal = false, embedded = false }: { personal?: boolean; embedded?: boolean }) {
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
  const [filtersOpen, setFiltersOpen] = React.useState(false);
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
  const reportCell = (column: string, value: string | number | null) => {
    if (column === "Status" && typeof value === "string")
      return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
    if (column !== "Subject" || typeof value !== "string") return text(value);
    const match = /^employee #(\d+)$/i.exec(value);
    if (!match) return value;
    const id = Number(match[1]);
    const listedName = employees.find((employee) => employee.id === id)?.name;
    const summaryMatch = report?.summary
      .find((line) => line.startsWith("Employee: "))
      ?.match(/^Employee: (.+) \(#(\d+)\)\.$/);
    return listedName ?? (summaryMatch && Number(summaryMatch[2]) === id ? summaryMatch[1] : value);
  };
  const activeFilterCount = [periodId, departmentId, branchId, employeeId, cycleId].filter(Boolean).length;
  const statusSection = report?.sections.find((section) => section.title === "Assignment and approval status");
  const scorecardSection = report?.sections.find((section) => section.title === "Scorecards (current page)");
  const scorecardTotal = Number(scorecardSection?.note?.match(/^\d+/)?.[0] ?? 0);
  const reportPreview = report && (
    <div className="space-y-8" aria-label="Report preview">
      <section className="space-y-5 border-t border-border pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{report.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{report.company} · {report.period}</p>
          </div>
          <span className="text-xs text-muted-foreground">Updated {new Date(report.generatedAt).toLocaleString()}</span>
        </div>
        {statusSection ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statusSection.rows.filter((row) => row.Status === "Total assignments" || Number(row.Count) > 0).map((row) => (
              <div key={text(row.Status)} className="border-l-2 border-primary/30 py-1 pl-4">
                <dt className="text-sm font-medium text-muted-foreground">{row.Status === "Total assignments" ? "Assigned KPIs" : text(row.Status)}</dt>
                <dd className="mt-1 text-3xl font-bold tabular-nums" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{text(row.Count)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{report.summary.join(" ")}</p>
        )}
      </section>
      {report.sections.filter((section) => section !== statusSection).map((section) => {
        const scorecards = section.title === "Scorecards (current page)";
        const columns = scorecards
          ? section.columns.filter((column) =>
              (column !== "Rating" || section.rows.some((row) => row.Rating && row.Rating !== "—")) &&
              (column !== "Live score" || section.rows.some((row) => row["Live score"] && row["Live score"] !== "Awaiting approved data")),
            )
          : section.columns;
        return (
          <section key={section.title} className="space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-xl font-bold">{scorecards ? "Scorecards" : section.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{scorecards ? `${section.rows.length} shown · Page ${page}` : section.note}</p>
            </div>
            {section.rows.length === 0 ? (
              <p className="rounded-lg bg-muted/30 px-4 py-5 text-sm text-muted-foreground">No records match this report.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table className="w-full min-w-[640px] text-left text-sm">
                  <TableHeader><TableRow>{columns.map((column) => <TableHeaderCell key={column} className="bg-muted/40 px-3 py-3 font-semibold">{column === "Subject" ? "Employee / subject" : column}</TableHeaderCell>)}</TableRow></TableHeader>
                  <TableBody>{section.rows.map((row, index) => <TableRow key={index}>{columns.map((column) => <TableCell key={column} className="border-t border-border px-3 py-3 align-top">{reportCell(column, row[column])}</TableCell>)}</TableRow>)}</TableBody>
                </Table>
              </div>
            )}
          </section>
        );
      })}
      {(report.summary.length > 0 || report.limitations.length > 0) && (
        <details className="border-t border-border pt-5 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">Report details and notes</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">{report.summary.map((line, index) => <li key={`summary-${index}`}>{line}</li>)}{report.limitations.map((line, index) => <li key={`note-${index}`}>{line}</li>)}</ul>
        </details>
      )}
      {scorecardSection && (
        <nav className="flex items-center gap-3 text-sm" aria-label="Report pages">
          <Button appearance="secondary" disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page}</span>
          <Button appearance="secondary" disabled={busy || page * report.pageSize >= scorecardTotal} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      )}
    </div>
  );
  const filterFields = (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {!personal && entryMode === "guided" && wizardStep === 0 && <label className="space-y-1 text-sm"><span>Report type</span><KpiFluentSelect appearance="underline" className="w-full" value={kind} onChange={(event) => { setKind(event.target.value as KpiReportKind); setPage(1); }}>{kinds.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</KpiFluentSelect></label>}
      {(entryMode === "manual" || wizardStep === 2) && <label className="space-y-1 text-sm"><span>Reporting period</span><KpiFluentSelect appearance="underline" className="w-full" value={periodId} onChange={(event) => { setPeriodId(event.target.value); setPage(1); }}><option value="">All periods</option>{periods.map((period) => <option value={period.id} key={period.id}>{period.label}</option>)}</KpiFluentSelect></label>}
      {admin && !personal && (entryMode === "manual" || wizardStep === 2) && <label className="space-y-1 text-sm"><span>Evaluation cycle</span><KpiFluentSelect appearance="underline" className="w-full" value={cycleId} onChange={(event) => { setCycleId(event.target.value); setPage(1); }}><option value="">All cycles</option>{cycles.map((cycle) => <option value={cycle.id} key={cycle.id}>{cycle.name}</option>)}</KpiFluentSelect></label>}
      {!personal && !executive && (entryMode === "manual" || wizardStep === 1) && <><label className="space-y-1 text-sm"><span>Department</span><KpiFluentSelect appearance="underline" className="w-full" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}><option value="">All permitted departments</option>{departments.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</KpiFluentSelect></label><label className="space-y-1 text-sm"><span>Branch</span><KpiFluentSelect appearance="underline" className="w-full" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(1); }}><option value="">All permitted branches</option>{branches.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</KpiFluentSelect></label><label className="space-y-1 text-sm"><span>Employee</span><KpiFluentSelect appearance="underline" className="w-full" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setPage(1); }}><option value="">All permitted employees</option>{employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</KpiFluentSelect></label></>}
    </div>
  );
  return (
    <main className="space-y-4">
      {!embedded && <KpiPageHeader title={personal ? "My KPI Reports" : "KPI Reports"} description="Review approved KPI results and download a report." actions={<Link href={personal ? "/dashboard/me/kpi" : "/dashboard/kpi"} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">Back to KPIs</Link>} />}
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-1 sm:px-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-2">
            {!personal && kinds.length > 1 && (
              <label className="flex min-w-52 flex-col gap-1 text-sm font-medium">
                Report type
                <KpiFluentSelect className="w-full" value={kind} onChange={(event) => { setKind(event.target.value as KpiReportKind); setPage(1); }}>
                  {kinds.map(([value, name]) => <option value={value} key={value}>{name}</option>)}
                </KpiFluentSelect>
              </label>
            )}
            <Button appearance="secondary" icon={<Filter24Regular />} onClick={() => setFiltersOpen(true)}>{"Filters" + (activeFilterCount ? " (" + activeFilterCount + ")" : "")}</Button>
            <Button appearance="subtle" icon={<DocumentEdit24Regular />} onClick={() => { setFiltersOpen(false); setWizardStep(0); setEntryMode("guided"); }}>Guided builder</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button appearance="secondary" icon={<DocumentPdf24Regular />} disabled={busy || !report} onClick={() => void download("pdf")}>PDF</Button>
            <Button appearance="secondary" icon={<TableSimple24Regular />} disabled={busy || !report} onClick={() => void download("xlsx")}>Excel</Button>
          </div>
        </div>
      {entryMode === "manual" && error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {entryMode === "manual" && notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
      {entryMode === "manual" && busy && !report && <Spinner size="small" label="Loading report" />}
      {entryMode === "manual" && reportPreview}
      </div>
      <Dialog open={filtersOpen} onOpenChange={(_, data) => setFiltersOpen(data.open)}>
        <DialogSurface style={{ width: "min(760px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)" }} className="max-h-[calc(100dvh-24px)] overflow-y-auto">
          <DialogBody>
            <DialogTitle>Filter report</DialogTitle>
            <DialogContent className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Choose a period or person to narrow this report.</p>
              {filterFields}
            </DialogContent>
            <DialogActions>
              {activeFilterCount > 0 && <Button appearance="subtle" icon={<ArrowReset24Regular />} onClick={() => { setPeriodId(""); setDepartmentId(""); setBranchId(""); setEmployeeId(""); setCycleId(""); setPage(1); }}>Clear filters</Button>}
              <Button appearance="primary" onClick={() => setFiltersOpen(false)}>Show results</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog open={entryMode === "guided"} onOpenChange={(_, data) => { if (!data.open) setEntryMode("manual"); }}>
        <DialogSurface style={{ width: "min(1080px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)" }} className="max-h-[calc(100dvh-24px)] overflow-y-auto">
          <DialogBody>
            <DialogTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close guided report builder" onClick={() => setEntryMode("manual")} />}>Guided report builder</DialogTitle>
            <DialogContent className="space-y-4 pt-2">
              <KpiWizardProgress steps={wizardSteps} step={wizardStep} compact />
              <section aria-label="Guided report fields">{filterFields}</section>
              {wizardStep === 4 && <label className="block max-w-xs text-sm">Export format<KpiFluentSelect aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "pdf" | "xlsx")}><option value="pdf">PDF</option><option value="xlsx">Excel</option></KpiFluentSelect></label>}
              {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
              {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
              {busy && !report && <Spinner size="small" label="Loading report" />}
              {wizardStep >= 3 && reportPreview}
            </DialogContent>
            <DialogActions className="border-t border-border pt-4">
              <KpiWizardControls steps={wizardSteps} step={wizardStep} busy={busy} finishDisabled={!report} error={error} onBack={() => setWizardStep((step) => step - 1)} onNext={() => { if (wizardStep === 2) void load(); setWizardStep((step) => step + 1); }} onCancel={() => setEntryMode("manual")} onFinish={() => void download(exportFormat)} finishLabel={`Download ${exportFormat.toUpperCase()}`} />
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </main>
  );
}
