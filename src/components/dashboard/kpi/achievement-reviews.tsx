"use client";

import { Badge, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Dropdown, Input, Option, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import { KpiFluentTextarea } from "./kpi-fluent-fields";
import * as React from "react";
import { ClipboardCheck, X, Paperclip, ListChecks, History } from "lucide-react";
import { ArrowReply20Regular, CheckmarkCircle20Regular, ClipboardTask20Regular, DismissCircle20Regular, DocumentEdit20Regular } from "@fluentui/react-icons";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { achievementApi, type Achievement, type AchievementActivity } from "@/lib/achievement-api";
import { achievementsEnabled, readKpiToken } from "@/lib/kpi-session";
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api";
import { kpiApi } from "@/lib/kpi-api";
import { KpiSearchSelect, type KpiChoice } from "./kpi-search-select";
import { numericActivityTotal } from "@/lib/kpi-activity-total";
import Decimal from "decimal.js";
import detailStyles from "./achievement-review-detail.module.css";

type AdvancedReviewFilters = { employee: string; department: string; branch: string; period: string; category: string; query: string };
const emptyAdvancedFilters: AdvancedReviewFilters = { employee: "", department: "", branch: "", period: "", category: "", query: "" };
const reviewOrder: Record<string, number> = { submitted: 0, under_review: 1, returned: 2, draft: 3, rejected: 4, approved: 5 };
async function listReviewRows(token: string, status: string): Promise<Achievement[]> {
  if (status === "awaiting") return achievementApi.pending(token);
  if (status !== "all") return achievementApi.pending(token, status);
  const batches = await Promise.all([
    achievementApi.pending(token),
    achievementApi.pending(token, "returned"),
    achievementApi.pending(token, "correction_draft"),
    achievementApi.pending(token, "rejected"),
    achievementApi.pending(token, "approved"),
  ]);
  return Array.from(new Map(batches.flat().map((row) => [row.id, row])).values());
}
function text(value: unknown) {
  return value === null || value === undefined
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function directorySubjectLabel(row: AdminRecord, type: string) {
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  if (type === "employee") {
    const name = read("full_name", "fullName", "name") || [read("first_name", "firstName"), read("last_name", "lastName")].filter(Boolean).join(" ");
    const employeeNumber = read("employee_no", "employee_number", "employeeNumber", "employeeNo");
    return [name || read("email"), employeeNumber ? `(${employeeNumber})` : ""].filter(Boolean).join(" ");
  }
  return read("name", "department_name", "departmentName", "branch_name", "branchName", "title");
}
function useSubjectNames(token: string, enabled: boolean) {
  const [names, setNames] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!enabled || !token) return;
    let active = true;
    void Promise.allSettled([
      listEmployees(token, { limit: 100 }),
      listDepartments(token, { limit: 100 }),
      listBranches(token, { limit: 100 }),
    ]).then((results) => {
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const type = index === 0 ? "employee" : index === 1 ? "department" : "branch";
        result.value.rows.forEach((row: AdminRecord) => {
          const id = Number(row.id ?? row.employee_id ?? row.department_id ?? row.branch_id);
          if (!Number.isInteger(id)) return;
          const label = directorySubjectLabel(row, type);
          if (label) next[`${type}:${id}`] = label;
        });
      });
      setNames(next);
    });
    return () => { active = false; };
  }, [enabled, token]);
  return names;
}
function subjectName(record: Achievement, names: Record<string, string>) {
  const { subjectType, subjectId } = record.assignment;
  return names[`${subjectType}:${subjectId}`] ?? `${subjectType.replaceAll("_", " ")} #${subjectId}`;
}

export function AchievementReviews() {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [rows, setRows] = React.useState<Achievement[]>([]),
    [status, setStatus] = React.useState("all"),
    [employee, setEmployee] = React.useState(""),
    [department, setDepartment] = React.useState(""),
    [branch, setBranch] = React.useState(""),
    [period, setPeriod] = React.useState(""),
    [category, setCategory] = React.useState(""),
    [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true),
    [error, setError] = React.useState("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [selectedReviewId, setSelectedReviewId] = React.useState<number | null>(null);
  const [draftFilters, setDraftFilters] = React.useState<AdvancedReviewFilters>(emptyAdvancedFilters);
  const subjectNames = useSubjectNames(token, actor.ready && achievementsEnabled);
  React.useEffect(() => {
    if (!actor.ready || !token || !achievementsEnabled) return;
    let active = true;
    void listReviewRows(token, status)
      .then((result) => { if (active) { setRows(result); setError(""); } })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Unable to load reviews"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actor.ready, token, status]);
  const loadEmployees = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await listEmployees(token, { limit: 100, search });
    return result.rows.map((row: AdminRecord) => ({ id: Number(row.id), label: [row.first_name ?? row.firstName, row.last_name ?? row.lastName].filter(Boolean).join(" ") || String(row.name ?? row.email ?? `Employee #${row.id}`) })).filter((choice) => Number.isInteger(choice.id));
  }, [token]);
  const loadDepartments = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await listDepartments(token, { limit: 100, search });
    return result.rows.map((row: AdminRecord) => ({ id: Number(row.id), label: String(row.name ?? `Department #${row.id}`) })).filter((choice) => Number.isInteger(choice.id));
  }, [token]);
  const loadBranches = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await listBranches(token, { limit: 100, search });
    return result.rows.map((row: AdminRecord) => ({ id: Number(row.id), label: String(row.name ?? `Branch #${row.id}`) })).filter((choice) => Number.isInteger(choice.id));
  }, [token]);
  const loadPeriods = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await kpiApi.periods(token);
    return result.filter((row) => row.label.toLowerCase().includes(search.toLowerCase())).map((row) => ({ id: row.id, label: row.label }));
  }, [token]);
  const filtered = rows.filter(
    (row) =>
      (!employee || String(row.assignment.subjectId) === employee) &&
      (!department || String(row.assignment.organizationSnapshot?.departmentId) === department) &&
      (!branch || String(row.assignment.organizationSnapshot?.branchId) === branch) &&
      (!period || String(row.assignment.periodId) === period) &&
      (!category || (row.assignment.definitionVersion?.category ?? "").trim().toLocaleLowerCase() === category.toLocaleLowerCase()) &&
      (!query.trim() || `${row.assignment.definitionVersion?.name ?? ""} ${row.assignment.definitionVersion?.category ?? ""} ${subjectName(row, subjectNames)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),
  ).sort((left, right) => (reviewOrder[left.current.status] ?? 5) - (reviewOrder[right.current.status] ?? 5));
  const categories = Array.from(new Set(rows.map((row) => row.assignment.definitionVersion?.category?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
  const advancedFilterCount = [employee, department, branch, period, category, query].filter(Boolean).length;
  function openAdvancedFilters() {
    setDraftFilters({ employee, department, branch, period, category, query });
    setFiltersOpen(true);
  }
  function applyAdvancedFilters() {
    setEmployee(draftFilters.employee);
    setDepartment(draftFilters.department);
    setBranch(draftFilters.branch);
    setPeriod(draftFilters.period);
    setCategory(draftFilters.category);
    setQuery(draftFilters.query);
    setFiltersOpen(false);
  }
  function closeReview() {
    setSelectedReviewId(null);
    setLoading(true);
    void listReviewRows(token, status)
      .then((result) => { setRows(result); setError(""); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to refresh reviews"))
      .finally(() => setLoading(false));
  }
  if (!achievementsEnabled)
    return <p className="p-6">KPI reviews are disabled in this environment.</p>;
  const awaitingCount = rows.filter((row) => ["submitted", "under_review"].includes(row.current.status)).length;
  return (
    <div className="space-y-4">
      <KpiPageHeader title="Achievement Reviews" description="Review submitted results, evidence, and past decisions." actions={status === "all" ? <><Badge appearance="tint" color="brand" size="large">{rows.length} {rows.length === 1 ? "submission" : "submissions"}</Badge><Badge appearance="tint" color={awaitingCount ? "warning" : "success"} size="large">{awaitingCount} awaiting review</Badge></> : <Badge appearance="tint" color="brand" size="large">{rows.length} shown</Badge>} />
      <section aria-label="Review filters" className="space-y-3 py-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="block w-full max-w-xs space-y-1 text-sm">
            <span className="font-medium">Show submissions</span>
            <Dropdown
              aria-label="Show submissions"
              className="w-full"
              button={{ className: "!w-full" }}
              value={{ all: "All submissions", awaiting: "Awaiting review", submitted: "Submitted", under_review: "In review", correction_draft: "Correction drafts", approved: "Approved", returned: "Returned", rejected: "Rejected" }[status] ?? "All submissions"}
              selectedOptions={[status]}
              onOptionSelect={(_, data) => {
                const next = data.optionValue ?? "all";
                if (next === status) return;
                setLoading(true);
                setError("");
                setStatus(next);
              }}
            >
              <Option value="all">All submissions</Option>
              <Option value="awaiting">Awaiting review</Option>
              <Option value="submitted">Submitted</Option>
              <Option value="under_review">In review</Option>
              <Option value="correction_draft">Correction drafts</Option>
              <Option value="approved">Approved</Option>
              <Option value="returned">Returned</Option>
              <Option value="rejected">Rejected</Option>
            </Dropdown>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button appearance="secondary" onClick={openAdvancedFilters}>More filters{advancedFilterCount ? ` (${advancedFilterCount})` : ""}</Button>
            {(status !== "all" || advancedFilterCount > 0) && <Button appearance="subtle" onClick={() => { if (status !== "all") setLoading(true); setStatus("all"); setEmployee(""); setDepartment(""); setBranch(""); setPeriod(""); setCategory(""); setQuery(""); }}>Clear filters</Button>}
          </div>
        </div>
      </section>
      <Dialog open={filtersOpen} onOpenChange={(_, data) => setFiltersOpen(data.open)}>
        <DialogSurface className="max-h-[90vh] !w-[min(44rem,calc(100vw-2rem))] overflow-y-auto">
          <DialogBody>
            <DialogTitle>Filter submissions</DialogTitle>
            <DialogContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Find submissions by KPI, person, category, team, or reporting period.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Search KPI or employee</span><Input className="w-full" value={draftFilters.query} onChange={(_, data) => setDraftFilters((current) => ({ ...current, query: data.value }))} placeholder="Name or category" /></label>
                <KpiSearchSelect label="Employee" value={draftFilters.employee} onChange={(value) => setDraftFilters((current) => ({ ...current, employee: value }))} load={loadEmployees} emptyLabel="All employees" fluentDropdown />
                <label className="space-y-1 text-sm"><span className="font-medium">KPI category</span><Dropdown className="w-full" aria-label="KPI category" value={draftFilters.category || "All categories"} selectedOptions={[draftFilters.category]} onOptionSelect={(_, data) => setDraftFilters((current) => ({ ...current, category: data.optionValue ?? "" }))}><Option value="">All categories</Option>{categories.map((value) => <Option key={value} value={value}>{value}</Option>)}</Dropdown></label>
                <KpiSearchSelect label="Department" value={draftFilters.department} onChange={(value) => setDraftFilters((current) => ({ ...current, department: value }))} load={loadDepartments} emptyLabel="All departments" fluentDropdown />
                <KpiSearchSelect label="Branch" value={draftFilters.branch} onChange={(value) => setDraftFilters((current) => ({ ...current, branch: value }))} load={loadBranches} emptyLabel="All branches" fluentDropdown />
                <KpiSearchSelect label="Period" value={draftFilters.period} onChange={(value) => setDraftFilters((current) => ({ ...current, period: value }))} load={loadPeriods} emptyLabel="All periods" fluentDropdown />
              </div>
              {Object.values(draftFilters).some(Boolean) && <Button appearance="subtle" size="small" onClick={() => setDraftFilters(emptyAdvancedFilters)}>Clear selections</Button>}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button>
              <Button appearance="primary" onClick={applyAdvancedFilters}>Apply filters</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {loading && <p>Loading submissions…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="font-semibold">{status !== "all" || advancedFilterCount ? "No submissions match these filters" : "No submissions yet"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{status !== "all" || advancedFilterCount ? "Change or clear a filter to see more submissions." : "Submitted KPI results will appear here once employees send them for review."}</p>
        </div>
      )}
      {!loading && filtered.length > 0 && <div className="overflow-x-auto rounded-lg border">
        <Table className="w-full text-left text-sm">
          <TableHeader>
            <TableRow className="border-b">
              <TableHeaderCell className="p-3">KPI</TableHeaderCell>
              <TableHeaderCell className="p-3">Employee / subject</TableHeaderCell>
              <TableHeaderCell className="p-3">Period</TableHeaderCell>
              <TableHeaderCell className="p-3">Actual</TableHeaderCell>
              <TableHeaderCell className="p-3">Status</TableHeaderCell>
              <TableHeaderCell className="p-3">Action</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow
                className="cursor-pointer border-b hover:bg-muted/40"
                key={row.id}
                tabIndex={0}
                onClick={() => setSelectedReviewId(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedReviewId(row.id);
                  }
                }}
              >
                <TableCell className="p-3">
                  {row.assignment.definitionVersion?.name ??
                    `Assignment #${row.assignmentId}`}
                </TableCell>
                <TableCell className="p-3">
                  {subjectName(row, subjectNames)}
                </TableCell>
                <TableCell className="p-3">
                  {row.assignment.period?.label ?? row.assignment.periodId}
                </TableCell>
                <TableCell className="p-3">{text(row.current.actual)}</TableCell>
                <TableCell className="p-3">
                  {row.current.status === "draft" && row.approvedRevisionId ? <Badge appearance="outline" color="warning">Correction draft</Badge> : <KpiStatusBadge status={row.current.status} />}
                </TableCell>
                <TableCell className="p-3">
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedReviewId(row.id);
                    }}
                  >
                    {["submitted", "under_review"].includes(row.current.status) ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>}
      <Dialog
        open={selectedReviewId !== null}
        onOpenChange={(_, data) => {
          if (!data.open) closeReview();
        }}
      >
        <DialogSurface className={detailStyles.surface} style={{ width: "min(1000px, calc(100vw - 32px))", height: "min(900px, calc(100dvh - 32px))", maxWidth: "none", maxHeight: "none", padding: 0, overflow: "hidden", boxSizing: "border-box" }}>
          <DialogBody style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0, gap: 0 }}>
            <DialogTitle className="sticky top-0 z-10 !m-0 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
              <span className="flex min-w-0 items-start gap-3">
                <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className={`${detailStyles.headerTitle} block font-semibold text-foreground`}>Achievement review</span>
                  <span className="block break-words text-xs font-normal text-muted-foreground sm:text-sm">
                    {(() => {
                      const selected = rows.find((row) => row.id === selectedReviewId);
                      return selected ? `${subjectName(selected, subjectNames)} · Revision ${selected.current.revision}` : "Loading submission…";
                    })()}
                  </span>
                </span>
              </span>
              <Button appearance="subtle" icon={<X aria-hidden="true" />} aria-label="Close achievement review" onClick={closeReview} />
            </DialogTitle>
            <DialogContent style={{ flex: 1, minHeight: 0, minWidth: 0, maxHeight: "none", overflowY: "auto", overflowX: "hidden", padding: "0 clamp(16px, 2vw, 24px) 24px", boxSizing: "border-box" }}>
              {selectedReviewId !== null && <AchievementReviewDetail id={selectedReviewId} embedded onCorrectionOpened={() => setStatus("correction_draft")} />}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function reviewValue(value: unknown, unit?: string | null) {
  if (value === null || value === undefined || value === "") return "—";
  let display: string;
  if (typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    display = entries.length === 1 && entries[0][0] === "value"
      ? String(entries[0][1])
      : entries.map(([key, item]) => key.replaceAll("_", " ") + ": " + String(item)).join(" · ");
  } else {
    display = String(value);
  }
  if (!unit || display === "—") return display;
  return unit === "%" ? display + "%" : display + " " + unit;
}

function reviewDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AchievementReviewDetail({ id, embedded = false, onCorrectionOpened }: { id: number; embedded?: boolean; onCorrectionOpened?: () => void }) {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [record, setRecord] = React.useState<Achievement | null>(null),
    [comments, setComments] = React.useState(""),
    [decisionDialog, setDecisionDialog] = React.useState<"review" | "return" | "reject" | null>(null),
    [confirmCorrection, setConfirmCorrection] = React.useState(false),
    [correctionRevision, setCorrectionRevision] = React.useState<number | null>(null),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const subjectNames = useSubjectNames(token, actor.ready && achievementsEnabled);

  React.useEffect(() => {
    if (!actor.ready || !token || !achievementsEnabled) return;
    void achievementApi
      .get(token, id)
      .then(setRecord)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load submission"),
      )
      .finally(() => setLoading(false));
  }, [actor.ready, token, id]);

  async function action(task: () => Promise<Achievement>, message: string): Promise<Achievement | undefined> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await task();
      setRecord(result);
      if (message) setNotice(message);
      window.dispatchEvent(new Event("hrms:refresh-page-data"));
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approve" | "return" | "reject") {
    if (!record || busy) return;
    if (decision !== "approve" && !comments.trim()) {
      setError("Add review comments before returning or rejecting this result.");
      return;
    }
    if (decision === "approve") {
      const total = record.assignment.definitionVersion?.measurementType === "numeric"
        ? numericActivityTotal((record.current.activities ?? []).map((activity) => activity.measurableResult))
        : null;
      const differs = total && typeof record.current.actual === "number" &&
        !new Decimal(record.current.actual).eq(total.total);
      const confirmed = await fluentConfirm(
        differs
          ? `The submitted actual (${record.current.actual}) differs from the numeric activity total (${total.total}). Approve this result anyway?`
          : "Approve this KPI achievement? The approved result will become eligible for scorecard calculation.",
      );
      if (!confirmed) return;
    }
    const message = decision === "approve"
      ? "Achievement approved"
      : decision === "return"
        ? "Returned for correction"
        : "Achievement rejected";
    await action(
      () => achievementApi.decide(
        token,
        id,
        decision,
        record.current.rowVersion,
        decision === "approve" ? "" : comments.trim(),
      ),
      message,
    );
  }

  function openDecisionDialog(decision: "review" | "return" | "reject") {
    setComments("");
    setError("");
    setDecisionDialog(decision);
  }

  async function createCorrectionDraft() {
    if (!record || busy || correctionRevision !== null) return;
    const updated = await action(
      () => achievementApi.correction(token, id),
      "",
    );
    if (updated) {
      setCorrectionRevision(updated.current.revision);
      setConfirmCorrection(false);
      onCorrectionOpened?.();
    }
  }

  async function submitDecisionDialog() {
    if (!record || !decisionDialog || busy) return;
    if (decisionDialog === "review") {
      setDecisionDialog(null);
      await action(
        () => achievementApi.review(token, id, record.current.rowVersion),
        "Review started",
      );
      return;
    }
    if (!comments.trim()) return;
    const decision = decisionDialog;
    setDecisionDialog(null);
    await decide(decision);
  }

  if (!achievementsEnabled)
    return <p className="p-6">KPI reviews are disabled in this environment.</p>;

  const status = record?.current.status ?? "";
  const canDecide = status === "submitted" || status === "under_review";
  const unit = record?.assignment.definitionVersion?.measurementUnit;
  const numericTotal = record?.assignment.definitionVersion?.measurementType === "numeric"
    ? numericActivityTotal((record.current.activities ?? []).map((activity) => activity.measurableResult))
    : null;
  const activityDiffers = numericTotal && typeof record?.current.actual === "number" &&
    !new Decimal(record.current.actual).eq(numericTotal.total);
  const targetNumber = record?.assignment.currentTarget?.target?.value;
  const actualNumber = record?.current.actual;
  const comparable = record?.assignment.definitionVersion?.direction === "higher" &&
    typeof targetNumber === "number" && Number.isFinite(targetNumber) && targetNumber > 0 &&
    typeof actualNumber === "number" && Number.isFinite(actualNumber) && actualNumber >= 0;
  const targetRatio = comparable ? new Decimal(actualNumber).div(targetNumber).times(100).toNumber() : null;
  const activityCount = record?.current.activities?.length ?? 0;

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-4 pb-6 pt-4">
      {!embedded && <KpiPageHeader variant="plain" title="Review achievement" />}
      {loading && <p className="text-sm text-muted-foreground">Loading submission…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
      {record && (
        <>
          <section aria-labelledby="achievement-summary-title" className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
            <div className="min-w-0">
              <h2 id="achievement-summary-title" className="break-words text-xl font-semibold text-foreground sm:text-2xl">{record.assignment.definitionVersion?.name ?? "KPI achievement"}</h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">{record.assignment.period?.label ?? "Reporting period unavailable"}{!embedded && ` · ${subjectName(record, subjectNames)} · Revision ${record.current.revision}`}</p>
            </div>
            <KpiStatusBadge status={status} />
          </section>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <section aria-label="Submitted result" className="min-w-0 rounded-xl border border-border p-4" style={{ background: "color-mix(in srgb, var(--primary) 7%, var(--card))" }}>
              <p className="text-xs font-semibold text-muted-foreground">Actual result</p>
              <p className={`${detailStyles.actualValue} mt-2 break-words font-semibold text-primary`}>{reviewValue(record.current.actual, unit)}</p>
              <div className="mt-3 flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Target</span>
                <span className="break-words font-semibold">{reviewValue(record.assignment.currentTarget?.target, unit)}</span>
              </div>
              {targetRatio !== null && <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Actual is ${targetRatio.toLocaleString(undefined, { maximumFractionDigits: 2 })}% of target; this is not the official achievement score`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(targetRatio, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Actual relative to target: {targetRatio.toLocaleString(undefined, { maximumFractionDigits: 2 })}%</p>
              </div>}
            </section>

            <section aria-labelledby="review-outcome-title" className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">
              <h3 id="review-outcome-title" className="text-base font-semibold">Review outcome</h3>
              <div className="mt-3"><KpiStatusBadge status={status} /></div>
              {canDecide ? <>
                <p className="mt-3 text-sm text-muted-foreground">Review this submitted result and its supporting evidence.</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {status === "submitted" && <KpiFluentButton type="button" icon={<ClipboardTask20Regular />} disabled={busy} onClick={() => openDecisionDialog("review")}>Start review</KpiFluentButton>}
                  <KpiFluentButton type="button" icon={<CheckmarkCircle20Regular />} disabled={busy} onClick={() => void decide("approve")}>{busy ? "Saving…" : "Approve result"}</KpiFluentButton>
                  <KpiFluentButton type="button" icon={<ArrowReply20Regular />} disabled={busy} onClick={() => openDecisionDialog("return")}>Return for correction</KpiFluentButton>
                  <KpiFluentButton type="button" icon={<DismissCircle20Regular />} disabled={busy} onClick={() => openDecisionDialog("reject")}>Reject</KpiFluentButton>
                </div>
              </> : <>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{record.current.reviewComment?.trim() || "No manager feedback on this revision."}</p>
                {status === "approved" && <div className="mt-auto space-y-2 pt-4">
                  <p className="text-xs text-muted-foreground">Need to change this approved result? Create a new draft for the employee. The approved result remains on record until a new revision is approved.</p>
                  {!confirmCorrection ? <KpiFluentButton type="button" icon={<DocumentEdit20Regular />} className="text-primary" disabled={busy} onClick={() => { setError(""); setConfirmCorrection(true); }}>Create correction draft</KpiFluentButton> : <div role="group" aria-label="Confirm correction draft" className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-sm font-medium">Create a correction draft for this KPI?</p>
                    <p className="mt-1 text-xs text-muted-foreground">The employee can edit and submit the new revision. This will not change the approved result yet.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button appearance="primary" icon={<DocumentEdit20Regular />} disabled={busy} onClick={() => void createCorrectionDraft()}>{busy ? "Creating…" : "Confirm and create draft"}</Button>
                      <Button appearance="secondary" disabled={busy} onClick={() => setConfirmCorrection(false)}>Cancel</Button>
                    </div>
                  </div>}
                </div>}
                {correctionRevision !== null && <p role="status" className="mt-3 text-sm text-foreground">Correction draft created (revision {correctionRevision}). The employee can now update and submit it.</p>}
              </>}
            </section>
          </div>

          {activityDiffers && <KpiFeedback intent="warning">The submitted actual ({reviewValue(record.current.actual, unit)}) differs from the numeric activity total ({reviewValue(numericTotal.total, unit)}). Check the supporting work before approving.</KpiFeedback>}

          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="min-w-0 space-y-4">
              <section aria-labelledby="review-comments-title" className="min-w-0 rounded-xl border border-border bg-card p-4">
                <h3 id="review-comments-title" className="text-base font-semibold">Employee comments</h3>
                <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm">{record.current.comments?.trim() || "No comments provided."}</p>
              </section>
              <section aria-labelledby="review-evidence-title" className="min-w-0 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2"><h3 id="review-evidence-title" className="flex items-center gap-2 text-base font-semibold"><Paperclip size={18} className="text-primary" aria-hidden="true" />Evidence</h3><span className="text-xs text-muted-foreground">{record.current.evidence.length} {record.current.evidence.length === 1 ? "attachment" : "attachments"}</span></div>
                {record.current.evidence.length ? <ul className="mt-2 space-y-2">{record.current.evidence.map((file) => <li key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm"><span className="min-w-0 break-all">{file.fileName} · {(file.fileSize / 1024).toFixed(1)} KB</span><KpiFluentButton type="button" onClick={() => void achievementApi.download(token, id, file).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>Download</KpiFluentButton></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No attachments</p>}
              </section>
            </div>
            <section aria-labelledby="review-activities-title" className="min-w-0 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="review-activities-title" className="flex items-center gap-2 text-base font-semibold"><ListChecks size={18} className="text-primary" aria-hidden="true" />Supporting activities</h3><span className="text-xs text-muted-foreground">{activityCount} {activityCount === 1 ? "entry" : "entries"}</span></div>
              {activityCount ? <div className="mt-3 space-y-3">{record.current.activities?.map((activity) => <ReviewActivity key={activity.id} activity={activity} achievementId={id} token={token} onError={setError} unit={unit} />)}</div> : <p className="mt-3 text-sm text-muted-foreground">No supporting activities recorded.</p>}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Supporting activities are not automatically included in the actual result.</p>
            </section>
          </div>

          <section aria-labelledby="review-history-title" className="min-w-0 border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                <h2 id="review-history-title" className="flex items-center gap-2 text-base font-semibold"><History size={20} className="text-primary" aria-hidden="true" />History</h2>
                <span className="text-xs text-muted-foreground">{record.revisions.length} {record.revisions.length === 1 ? "revision" : "revisions"} · {record.history.length} events</span>
              </div>
              <div className="grid gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Revisions</h3>
                  <ol className="mt-3 space-y-3">
                    {record.revisions.map((revision) => (
                      <li key={revision.id} className="min-w-0 border-t border-border py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">Revision {revision.revision}</span>
                          <KpiStatusBadge status={revision.effectiveStatus} />
                        </div>
                        <p className="mt-2 break-words text-muted-foreground">Actual: {reviewValue(revision.actual, unit)}</p>
                        {revision.reviewComment && <p className="mt-1 whitespace-pre-wrap break-words">Feedback: {revision.reviewComment}</p>}
                        {revision.id !== record.current.id && revision.activities?.length ? (
                          <div className="mt-3 space-y-2">
                            {revision.activities.map((activity) => (
                              <ReviewActivity key={activity.id} activity={activity} achievementId={id} token={token} onError={setError} />
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="min-w-0 lg:border-l lg:border-border lg:pl-8">
                  <h3 className="text-sm font-semibold">Activity timeline</h3>
                  <ol className="mt-5 space-y-5 border-l border-border pl-4">
                    {record.history.map((event) => (
                      <li key={event.id} className="relative break-words text-sm">
                        <span aria-hidden="true" className="absolute -left-[1.28rem] top-1 size-2 rounded-full bg-primary" />
                        <p className="font-medium capitalize">{event.action.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{reviewDate(event.createdAt)} · User #{event.actorId}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
          </section>
        </>
      )}
      <Dialog
        open={decisionDialog !== null}
        onOpenChange={(_, data) => {
          if (!data.open && !busy) setDecisionDialog(null);
        }}
      >
        <DialogSurface className="!w-[min(32rem,calc(100vw-2rem))]">
          <DialogBody>
            <DialogTitle>
              {decisionDialog === "review"
                ? "Start review?"
                : decisionDialog === "return"
                  ? "Return for correction"
                  : "Reject achievement"}
            </DialogTitle>
            <DialogContent>
              {decisionDialog === "review" ? (
                <p>This will mark the achievement as under review.</p>
              ) : (
                <div className="grid gap-2">
                  <label htmlFor="achievement-decision-reason" className="text-sm font-medium">
                    Reason
                  </label>
                  <KpiFluentTextarea
                    id="achievement-decision-reason"
                    className="min-h-28 w-full"
                    value={comments}
                    onChange={(event) => setComments(event.target.value)}
                    maxLength={4000}
                    autoFocus
                  />
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <>
                <Button appearance="secondary" disabled={busy} onClick={() => setDecisionDialog(null)}>Cancel</Button>
                <Button
                  appearance="primary"
                  icon={decisionDialog === "review" ? <ClipboardTask20Regular /> : decisionDialog === "return" ? <ArrowReply20Regular /> : <DismissCircle20Regular />}
                  disabled={busy || (decisionDialog !== "review" && !comments.trim())}
                  onClick={() => void submitDecisionDialog()}
                >
                  {busy
                    ? "Saving…"
                    : decisionDialog === "review"
                        ? "Start review"
                        : decisionDialog === "return"
                          ? "Return"
                          : "Reject"}
                </Button>
              </>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function ReviewActivity({
  activity,
  achievementId,
  token,
  onError,
  unit,
}: {
  activity: AchievementActivity;
  achievementId: number;
  token: string;
  onError: (message: string) => void;
  unit?: string | null;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{activity.activityDate}</p>
          <h4 className="mt-0.5 break-words text-sm font-semibold">{activity.title}</h4>
        </div>
        <KpiStatusBadge status={activity.status} />
      </div>
      {activity.details?.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{activity.details}</p>}
      <div className="mt-3 grid gap-x-6 gap-y-3 border-t border-border/70 pt-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Measured result</p>
          <p className="mt-0.5 break-words font-medium">{reviewValue(activity.measurableResult, unit)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Comments</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words">{activity.comments?.trim() || "—"}</p>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Evidence:</span>
        {activity.evidence.length ? activity.evidence.map((file) => (
          <KpiFluentButton
            key={file.id}
            type="button"
            className="max-w-full break-all text-left text-primary"
            onClick={() => void achievementApi.downloadActivityEvidence(token, achievementId, activity, file).catch((e: unknown) =>
              onError(e instanceof Error ? e.message : "Download failed"))}
          >{file.fileName} · {(file.fileSize / 1024).toFixed(1)} KB</KpiFluentButton>
        )) : <span className="text-xs text-muted-foreground">None attached</span>}
      </div>
    </article>
  );
}
