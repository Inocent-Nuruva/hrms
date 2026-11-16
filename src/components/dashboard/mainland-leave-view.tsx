"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { showErrorAlert } from "@/lib/error-alert";
import { showSuccessAlert } from "@/lib/success-alert";
import { readStoredSessionTokens } from "@/lib/session-client";
import { canPerformPermission } from "@/lib/dashboard-permissions";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  approveCutover,
  approvePolicyDraft,
  assignPolicy,
  buildCutover,
  confirmMainlandHoliday,
  createLeaveProfile,
  getHolidayReview,
  type HolidayReviewRow,
  createPolicyDraft,
  downloadMainlandCsv,
  extendCarryOver,
  forfeitCarryOver,
  getMainlandBalance,
  getMainlandReport,
  listCutoverRows,
  listCutovers,
  listJobRuns,
  listMissingProfiles,
  listPolicyDrafts,
  listPolicyRevisions,
  postCutover,
  resolveCutoverRow,
  reverseCutover,
  runCycleJob,
  seedMainlandHolidays,
  validatePolicyDraft,
  voidCutover,
  withdrawPolicyRevision,
  type CutoverRow,
  type CutoverSnapshot,
  type JobRun,
  type LeaveFamily,
  type MainlandBalance,
  type PolicyDraft,
  type PolicyRevision,
  type ReportKind,
} from "@/lib/mainland-leave-api";

// Each section is shown only to users whose permissions its API calls accept
// (see leave-mainland / leave-policy-revisions controllers).
const SECTIONS = [
  { key: "setup", label: "Employee profiles", permissions: ["leave-balances.manage"] },
  { key: "policy", label: "Policy revisions", permissions: ["leave_policies:read"] },
  { key: "cutover", label: "Cutover", permissions: ["leave-balances.manage"] },
  { key: "balances", label: "Balances & carry-over", permissions: ["leave-balances.view"] },
  { key: "reports", label: "Reports", permissions: ["leave-balances.view"] },
  { key: "operations", label: "Operations", permissions: ["leave-balances.manage"] },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(new Date());
const fmt = (v: unknown) =>
  typeof v === "number" ? v.toFixed(2) : v == null || v === "" ? "—" : String(v);
const token = () => readStoredSessionTokens().accessToken ?? "";

/** Runs an action, shows success/error alerts, returns the result or null. */
async function act<T>(fn: () => Promise<T>, done?: string): Promise<T | null> {
  try {
    const r = await fn();
    if (done) showSuccessAlert(done);
    return r;
  } catch (e) {
    showErrorAlert(e instanceof Error ? e.message : "Request failed");
    return null;
  }
}

const askReason = (label: string) => {
  const r = window.prompt(label)?.trim();
  return r ? r : null;
};

function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Table({ rows, columns }: { rows: Record<string, unknown>[]; columns?: string[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing to show.</p>;
  const cols = columns ?? Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="px-2 py-1.5 font-medium">{c.replace(/_/g, " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1.5 align-top">
                  {React.isValidElement(r[c])
                    ? (r[c] as React.ReactNode)
                    : Array.isArray(r[c])
                      ? (r[c] as unknown[]).join(", ") || "—"
                      : fmt(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

function SetupSection() {
  const [asOf, setAsOf] = React.useState(today());
  const [missing, setMissing] = React.useState<Record<string, unknown>[]>([]);
  const [form, setForm] = React.useState({ employeeId: "", effective: today(), jurisdiction: "mainland", fte: "1", anchor: "", prior: "", reason: "" });
  const load = React.useCallback(async () => {
    const r = await act(() => listMissingProfiles(token(), asOf));
    if (r) setMissing(r as unknown as Record<string, unknown>[]);
  }, [asOf]);
  React.useEffect(() => {
    void load();
  }, [load]);
  const save = async () => {
    const prior = form.prior
      .split(/\n|;/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [start_date, end_date] = l.split(/\s*(?:to|,)\s*/);
        return { start_date, end_date };
      });
    const r = await act(
      () =>
        createLeaveProfile(token(), Number(form.employeeId), {
          effective_date: form.effective,
          jurisdiction: form.jurisdiction as "mainland" | "zanzibar",
          fte: Number(form.fte),
          cycle_anchor_date: form.anchor || null,
          previous_employment_periods: prior,
          reason: form.reason,
        }),
      "Profile recorded (effective-dated; history kept)",
    );
    if (r) void load();
  };
  return (
    <div className="grid gap-4">
      <Card title="Record an effective-dated leave profile">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Employee ID"><Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></Field>
          <Field label="Effective date"><Input type="date" value={form.effective} onChange={(e) => setForm({ ...form, effective: e.target.value })} /></Field>
          <Field label="Jurisdiction">
            <select className={selectClass} value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}>
              <option value="mainland">Mainland</option>
              <option value="zanzibar">Zanzibar</option>
            </select>
          </Field>
          <Field label="FTE (0–1, up to 4 decimals)"><Input value={form.fte} onChange={(e) => setForm({ ...form, fte: e.target.value })} /></Field>
          <Field label="Migrated cycle anchor (optional)"><Input type="date" value={form.anchor} onChange={(e) => setForm({ ...form, anchor: e.target.value })} /></Field>
          <Field label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        </div>
        <div className="mt-3">
          <Field label="Prior company employment (one per line: YYYY-MM-DD to YYYY-MM-DD)">
            <textarea className="min-h-16 rounded-md border bg-background p-2 text-sm" value={form.prior} onChange={(e) => setForm({ ...form, prior: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={save} disabled={!form.employeeId || !form.reason.trim()}>Save profile</Button>
        </div>
      </Card>
      <Card title="Employees missing jurisdiction / FTE" actions={<Input type="date" className="w-40" value={asOf} onChange={(e) => setAsOf(e.target.value)} />}>
        <p className="mb-2 text-xs text-muted-foreground">
          Nobody is assumed Mainland or full-time. These employees cannot be activated until a profile is recorded.
        </p>
        <Table rows={missing} columns={["id", "employee_no", "first_name", "last_name", "hire_date"]} />
      </Card>
    </div>
  );
}

function PolicySection() {
  const [policyId, setPolicyId] = React.useState("1");
  const [drafts, setDrafts] = React.useState<PolicyDraft[]>([]);
  const [revisions, setRevisions] = React.useState<PolicyRevision[]>([]);
  const [rules, setRules] = React.useState("");
  const [date, setDate] = React.useState("2027-01-01");
  const [errors, setErrors] = React.useState<string[] | null>(null);
  const [assign, setAssign] = React.useState({ ids: "", date: "2027-01-01", snapshot: "", reason: "" });
  const load = React.useCallback(async () => {
    const id = Number(policyId);
    if (!id) return;
    const [d, r] = await Promise.all([act(() => listPolicyDrafts(token(), id)), act(() => listPolicyRevisions(token(), id))]);
    if (d) setDrafts(d);
    if (r) setRevisions(r);
  }, [policyId]);
  React.useEffect(() => {
    void load();
  }, [load]);
  const parsed = () => {
    try {
      return JSON.parse(rules) as Record<string, unknown>;
    } catch {
      showErrorAlert("Rules must be valid JSON");
      return null;
    }
  };
  const validate = async () => {
    const r = parsed();
    if (!r) return;
    const v = await act(() => validatePolicyDraft(token(), Number(policyId), date, r));
    if (v) setErrors(v.errors);
  };
  const saveDraft = async () => {
    const r = parsed();
    const reason = r && askReason("Reason for this draft");
    if (!r || !reason) return;
    const d = await act(() => createPolicyDraft(token(), Number(policyId), date, r, reason), "Draft stored (inactive)");
    if (d) {
      setErrors(d.validation_errors);
      void load();
    }
  };
  const approve = async (d: PolicyDraft) => {
    const reason = askReason("Approval reason (HR/legal reference)");
    if (!reason) return;
    const j = window.confirm("Mainland jurisdiction? (Cancel = Zanzibar)") ? "mainland" : "zanzibar";
    if (await act(() => approvePolicyDraft(token(), d.id, j, reason), "Revision approved")) void load();
  };
  const withdraw = async (r: PolicyRevision) => {
    const reason = askReason("Withdrawal reason");
    if (reason && (await act(() => withdrawPolicyRevision(token(), r.id, reason), "Withdrawn"))) void load();
  };
  const doAssign = () =>
    act(
      () =>
        assignPolicy(token(), {
          employee_ids: assign.ids.split(",").map((x) => Number(x.trim())).filter(Boolean),
          policy_id: Number(policyId),
          effective_date: assign.date,
          reason: assign.reason,
          cutover_snapshot_id: assign.snapshot ? Number(assign.snapshot) : undefined,
        }),
      "Employees assigned",
    );
  return (
    <div className="grid gap-4">
      <Card title="Policy" actions={<Input className="w-28" value={policyId} onChange={(e) => setPolicyId(e.target.value)} placeholder="Policy ID" />}>
        <p className="text-xs text-muted-foreground">
          Drafts are never active. An approved revision is immutable and applies from its effective date. Someone other than the draft author must approve it.
        </p>
      </Card>
      <Card title="New draft">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Field label="Proposed effective date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Rules (JSON; start from config/mainland-policy-2027.draft.json)">
            <textarea className="min-h-48 rounded-md border bg-background p-2 font-mono text-xs" value={rules} onChange={(e) => setRules(e.target.value)} />
          </Field>
        </div>
        {errors && (
          <ul className={`mt-2 text-xs ${errors.length ? "text-rose-600" : "text-emerald-600"}`}>
            {errors.length ? errors.map((e) => <li key={e}>{e}</li>) : <li>Valid: schema and cross-field checks pass.</li>}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={validate}>Validate</Button>
          <Button onClick={saveDraft}>Save draft</Button>
        </div>
      </Card>
      <Card title="Drafts">
        <Table
          rows={drafts.map((d) => ({
            id: d.id,
            proposed_effective_date: d.proposed_effective_date,
            reason: d.reason,
            action: (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setRules(JSON.stringify(d.rules, null, 2))}>Load</Button>
                <Button size="sm" onClick={() => approve(d)}>Approve</Button>
              </div>
            ),
          }))}
        />
      </Card>
      <Card title="Approved revisions">
        <Table
          rows={revisions.map((r) => ({
            id: r.id,
            jurisdiction: r.jurisdiction,
            effective_date: r.effective_date,
            approved_at: r.approved_at?.slice(0, 10),
            sha256: r.rules_sha256.slice(0, 12),
            status: r.withdrawn_at ? "withdrawn" : r.effective_date > today() ? "scheduled" : "effective",
            action: !r.withdrawn_at && r.effective_date > today() ? (
              <Button size="sm" variant="outline" onClick={() => withdraw(r)}>Withdraw</Button>
            ) : null,
          }))}
        />
      </Card>
      <Card title="Assign employees (activation)">
        <p className="mb-2 text-xs text-muted-foreground">
          Mainland activation needs a posted cutover snapshot and takes effect on its cutover date. No employee switches policy by default.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Employee IDs (comma separated)"><Input value={assign.ids} onChange={(e) => setAssign({ ...assign, ids: e.target.value })} /></Field>
          <Field label="Effective date"><Input type="date" value={assign.date} onChange={(e) => setAssign({ ...assign, date: e.target.value })} /></Field>
          <Field label="Cutover snapshot ID"><Input value={assign.snapshot} onChange={(e) => setAssign({ ...assign, snapshot: e.target.value })} /></Field>
          <Field label="Reason"><Input value={assign.reason} onChange={(e) => setAssign({ ...assign, reason: e.target.value })} /></Field>
        </div>
        <div className="mt-3">
          <Button disabled={!assign.ids || !assign.reason.trim()} onClick={doAssign}>Assign</Button>
        </div>
      </Card>
    </div>
  );
}

function CutoverSection() {
  const [snapshots, setSnapshots] = React.useState<CutoverSnapshot[]>([]);
  const [selected, setSelected] = React.useState<CutoverSnapshot | null>(null);
  const [rows, setRows] = React.useState<CutoverRow[]>([]);
  const [build, setBuild] = React.useState({ policy: "1", date: "2027-01-01" });
  const load = React.useCallback(async () => {
    const s = await act(() => listCutovers(token()));
    if (s) setSnapshots(s);
    return s;
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const open = async (s: CutoverSnapshot) => {
    setSelected(s);
    const r = await act(() => listCutoverRows(token(), s.id));
    if (r) setRows(r);
  };
  const refresh = async () => {
    const list = await load();
    const s = selected && list?.find((x) => x.id === selected.id);
    if (s) await open(s);
  };
  const doBuild = async () => {
    const r = await act(() => buildCutover(token(), Number(build.policy), build.date), "Draft reconciliation built");
    if (r) {
      await load();
      await open(r.snapshot);
    }
  };
  const signOff = async (s: CutoverSnapshot) => {
    const reason = askReason("Sign-off reason");
    const evidence = reason && askReason("Evidence reference (signed reconciliation file)");
    if (reason && evidence && (await act(() => approveCutover(token(), s.id, reason, evidence), "Signed off and sealed"))) void refresh();
  };
  const doPost = async (s: CutoverSnapshot) => {
    if (window.confirm("Post opening balances now? Stale or changed rows will be rejected.") && (await act(() => postCutover(token(), s.id), "Opening balances posted"))) void refresh();
  };
  const doVoid = async (s: CutoverSnapshot) => {
    const reason = askReason("Void reason");
    if (reason && (await act(() => voidCutover(token(), s.id, reason), "Voided"))) void refresh();
  };
  const doReverse = async (s: CutoverSnapshot) => {
    const reason = askReason("Recovery reason (reverses all opening entries; audit trail kept)");
    if (reason && (await act(() => reverseCutover(token(), s.id, reason), "Opening entries reversed"))) void refresh();
  };
  const resolveRow = async (s: CutoverSnapshot, r: CutoverRow) => {
    const reason = askReason("Resolution reason (evidence reviewed)");
    if (!reason) return;
    const o = window.prompt("Override opening days (leave blank to accept proposed)")?.trim();
    if (await act(() => resolveCutoverRow(token(), r.id, reason, o ? Number(o) : null))) void open(s);
  };
  const unresolved = rows.filter((r) => !r.resolved).length;
  return (
    <div className="grid gap-4">
      <Card title="Build reconciliation">
        <p className="mb-2 text-xs text-muted-foreground">
          Reconstructed from historical requests. Future and pending leave is listed as outstanding, never as taken. The legacy balance is shown only as a reference.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Policy ID"><Input className="w-28" value={build.policy} onChange={(e) => setBuild({ ...build, policy: e.target.value })} /></Field>
          <Field label="Cutover date"><Input type="date" value={build.date} onChange={(e) => setBuild({ ...build, date: e.target.value })} /></Field>
          <Button onClick={doBuild}>Build</Button>
        </div>
      </Card>
      <Card title="Snapshots">
        <Table
          rows={snapshots.map((s) => ({
            id: s.id,
            cutover_date: s.cutover_date,
            status: s.status,
            seal: s.rows_sha256?.slice(0, 12) ?? "—",
            approved_at: s.approved_at?.slice(0, 10),
            posted_at: s.posted_at?.slice(0, 10),
            action: <Button size="sm" variant="outline" onClick={() => open(s)}>Open</Button>,
          }))}
        />
      </Card>
      {selected && (
        <Card
          title={`Snapshot ${selected.id}: ${selected.status} (${unresolved} unresolved)`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => act(() => downloadMainlandCsv(token(), `/api/leave/mainland/cutovers/${selected.id}/export.csv`, `cutover-${selected.id}.csv`))}>Export CSV</Button>
              {selected.status === "draft" && <Button size="sm" disabled={unresolved > 0} onClick={() => signOff(selected)}>HR sign-off</Button>}
              {selected.status === "approved" && <Button size="sm" onClick={() => doPost(selected)}>Post opening balances</Button>}
              {(selected.status === "draft" || selected.status === "approved") && <Button size="sm" variant="outline" onClick={() => doVoid(selected)}>Void</Button>}
              {selected.status === "posted" && <Button size="sm" variant="outline" onClick={() => doReverse(selected)}>Reverse posting</Button>}
            </div>
          }
        >
          <Table
            rows={rows.map((r) => ({
              employee: r.employee_id,
              family: r.family,
              cycle_start: r.cycle_start,
              prior_carry: r.prior_carry_days,
              carry_expires: r.carry_expires_on,
              accrued: r.accrued_days,
              taken: r.taken_days,
              outstanding: r.outstanding_days,
              proposed: r.proposed_days,
              override: r.override_days ? `${r.override_days} (${r.override_reason})` : (r.override_reason ?? "—"),
              exceptions: r.exceptions,
              action:
                selected.status === "draft" ? (
                  <Button size="sm" variant={r.resolved ? "outline" : "default"} onClick={() => resolveRow(selected, r)}>
                    {r.resolved ? "Edit" : "Resolve"}
                  </Button>
                ) : r.resolved ? "resolved" : "—",
            }))}
          />
        </Card>
      )}
    </div>
  );
}

function BalancesSection() {
  const [q, setQ] = React.useState({ employee: "", family: "annual" as LeaveFamily, asOf: today() });
  const [bal, setBal] = React.useState<MainlandBalance | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const load = async () => {
    const r = await act(() => getMainlandBalance(token(), Number(q.employee), q.family, q.asOf));
    if (!r) return;
    if (r.status === "mainland") {
      setBal(r as MainlandBalance);
      setNote(null);
    } else {
      setBal(null);
      setNote(`Not on a Mainland policy on this date (${r.status}).`);
    }
  };
  const extend = async (src: string) => {
    const r = askReason("Extension reason (HR approval)");
    if (r && (await act(() => extendCarryOver(token(), Number(q.employee), src, r), "Extended"))) void load();
  };
  const forfeit = async (src: string, days: number) => {
    const r = askReason(`Forfeit ${days.toFixed(2)} days: reason`);
    if (r && (await act(() => forfeitCarryOver(token(), Number(q.employee), src, r), "Forfeited"))) void load();
  };
  return (
    <div className="grid gap-4">
      <Card title="As-of balance (past, today or future)">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Employee ID"><Input className="w-28" value={q.employee} onChange={(e) => setQ({ ...q, employee: e.target.value })} /></Field>
          <Field label="Leave">
            <select className={selectClass} value={q.family} onChange={(e) => setQ({ ...q, family: e.target.value as LeaveFamily })}>
              {["annual", "sick", "maternity", "paternity", "compassionate", "unpaid"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="As of"><Input type="date" value={q.asOf} onChange={(e) => setQ({ ...q, asOf: e.target.value })} /></Field>
          <Button onClick={load} disabled={!q.employee}>Show</Button>
        </div>
        {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
      </Card>
      {bal && (
        <>
          <PageHeader
            as="h3"
            title={`Cycle ${bal.cycle?.cycleNumber ?? "—"}: ${bal.cycle?.startDate ?? ""} → ${bal.cycle?.endDate ?? ""}`}
            stats={[
              { label: "Available", value: fmt(bal.available), tone: "success" },
              { label: "Balance", value: fmt(bal.balance) },
              { label: "Pending", value: fmt(bal.pending), tone: "info" },
              { label: "Scheduled", value: fmt(bal.scheduled), tone: "info" },
              { label: "Flagged (expired, usable)", value: fmt(bal.expired_flagged), tone: "warning" },
            ]}
          />
          <Card title="Movement in this cycle">
            <Table
              rows={[
                {
                  entitlement: bal.entitlement,
                  accrued: bal.accrued,
                  carried: bal.carried,
                  taken: bal.taken,
                  forfeited: bal.forfeited,
                  paid_out: bal.paid_out,
                  projected_unposted_accrual: bal.projected.unposted_accrual,
                  available_incl_projection: bal.projected.available_including_projection,
                },
              ]}
            />
            <p className="mt-2 text-xs text-muted-foreground">Projection is hypothetical and never posted. Shown to 2 decimals; the ledger keeps 4.</p>
            {bal.tier_usage.length > 0 && (
              <div className="mt-3">
                <Table rows={bal.tier_usage.map((t) => ({ pay_rate: `${t.pay_rate * 100}%`, days: t.days }))} />
              </div>
            )}
          </Card>
          <Card title="Credit buckets (oldest used first)">
            <Table
              rows={bal.buckets.map((b) => ({
                from_cycle: b.source_cycle_start,
                remaining: b.remaining,
                expires_on: b.expires_on ?? "current cycle",
                status: b.status,
                action:
                  b.expires_on && b.status !== "forfeited" && b.remaining > 0 ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => extend(b.source_cycle_start)}>Extend</Button>
                      <Button size="sm" variant="outline" onClick={() => forfeit(b.source_cycle_start, b.remaining)}>Forfeit</Button>
                    </div>
                  ) : null,
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function ReportsSection() {
  const [kind, setKind] = React.useState<ReportKind>("balances");
  const [params, setParams] = React.useState({ as_of: today(), family: "annual", department_id: "", within: "90" });
  const [data, setData] = React.useState<{ rows: Record<string, unknown>[]; totals?: Record<string, unknown> } | null>(null);
  const qp = () => ({
    as_of: params.as_of,
    family: kind === "balances" ? params.family : undefined,
    department_id: params.department_id || undefined,
    within: kind === "expiring" ? params.within : undefined,
  });
  const run = async () => {
    const r = await act(() => getMainlandReport(token(), kind, qp()));
    if (r) setData(r);
  };
  const csv = () => {
    const q = new URLSearchParams(
      Object.entries({ ...qp(), format: "csv" }).filter((e): e is [string, string] => Boolean(e[1])),
    );
    return act(() => downloadMainlandCsv(token(), `/api/leave/mainland/reports/${kind}?${q.toString()}`, `${kind}-${params.as_of}.csv`));
  };
  return (
    <div className="grid gap-4">
      <Card title="Report">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Report">
            <select
              className={selectClass}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ReportKind);
                setData(null);
              }}
            >
              <option value="balances">As-of balances (department and company)</option>
              <option value="liability">Annual leave liability</option>
              <option value="expiring">Carry-over expiring</option>
              <option value="sick-tiers">Sick tier usage</option>
              <option value="maternity-terms">Maternity terms used</option>
            </select>
          </Field>
          <Field label="As of"><Input type="date" value={params.as_of} onChange={(e) => setParams({ ...params, as_of: e.target.value })} /></Field>
          {kind === "balances" && (
            <Field label="Leave">
              <select className={selectClass} value={params.family} onChange={(e) => setParams({ ...params, family: e.target.value })}>
                {["annual", "sick", "compassionate", "maternity", "paternity", "unpaid"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          )}
          {kind === "expiring" && (
            <Field label="Within">
              <select className={selectClass} value={params.within} onChange={(e) => setParams({ ...params, within: e.target.value })}>
                {["30", "60", "90"].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </Field>
          )}
          {(kind === "balances" || kind === "liability") && (
            <Field label="Department ID (optional)"><Input className="w-28" value={params.department_id} onChange={(e) => setParams({ ...params, department_id: e.target.value })} /></Field>
          )}
          <Button onClick={run}>Run</Button>
          <Button variant="outline" onClick={csv}>Export CSV</Button>
        </div>
      </Card>
      {data && (
        <Card title="Results">
          {data.totals && (
            <Table rows={[Object.fromEntries(Object.entries(data.totals).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]))]} />
          )}
          <div className="mt-3">
            <Table rows={data.rows} />
          </div>
        </Card>
      )}
    </div>
  );
}

function OperationsSection() {
  const [runs, setRuns] = React.useState<JobRun[]>([]);
  const load = React.useCallback(async () => {
    const r = await act(() => listJobRuns(token()));
    if (r) setRuns(r);
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const runNow = async () => {
    if (await act(() => runCycleJob(token()), "Run finished")) void load();
  };
  const [review, setReview] = React.useState<Awaited<ReturnType<typeof getHolidayReview>> | null>(null);
  const loadReview = React.useCallback(async () => {
    const r = await act(() => getHolidayReview(token(), today(), 60));
    if (r) setReview(r);
  }, []);
  React.useEffect(() => {
    void loadReview();
  }, [loadReview]);
  const seed = async () => {
    const r = await act(() => seedMainlandHolidays(token()));
    if (r) showSuccessAlert(`Added ${r.created.length}; ${r.skipped} already seeded or edited by HR.`);
    void loadReview();
  };
  const confirm = async (row: HolidayReviewRow) => {
    const date = window.prompt(`Announced date for ${row.name} (YYYY-MM-DD). Leave as is to confirm ${row.date}.`, row.date)?.trim();
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return showErrorAlert("Use the YYYY-MM-DD format.");
    const reason = askReason("Reason (e.g. government announcement reference)");
    if (!reason) return;
    const evidence = window.prompt("Evidence (gazette/notice reference, optional)")?.trim() || null;
    const r = await act(() => confirmMainlandHoliday(token(), row.id, { date, reason, evidence }));
    if (!r) return;
    showSuccessAlert(
      r.affected_requests.length
        ? `Confirmed ${r.date}. Review ${r.affected_requests.length} leave request(s) touching ${r.from_date} or ${r.date}: ${r.affected_requests.map((a) => a.leave_no).join(", ")}.`
        : `Confirmed ${r.date}.`,
    );
    void loadReview();
  };
  return (
    <div className="grid gap-4">
      <Card title="Daily cycle job (01:15 Africa/Dar_es_Salaam)" actions={<Button size="sm" onClick={runNow}>Run / retry today</Button>}>
        <p className="mb-2 text-xs text-muted-foreground">
          Accrual, cycle close and carry-over, expiry flags (never silent forfeiture), and 60/30/7-day warnings. Reruns are safe.
        </p>
        <Table
          rows={runs.map((r) => ({
            date: r.run_date,
            status: r.status,
            attempts: r.attempts,
            employees: r.stats?.employees,
            entries: r.stats?.entries,
            warnings: r.stats?.warnings,
            error: r.error?.split("\n")[0],
          }))}
        />
      </Card>
      <Card title="Mainland public holidays" actions={<Button size="sm" onClick={seed}>Seed rest of 2026 + 2027</Button>}>
        <p className="text-xs text-muted-foreground">
          Lunar dates (Eid al-Fitr, Eid al-Adha, Maulid) are seeded as provisional. After the government announcement, confirm each one below (moving it if needed). Reseeding never overwrites or re-creates rows HR changed or deleted.
        </p>
        {review && (
          <div className="mt-3 grid gap-2">
            {review.rows.some((r) => r.needs_check) && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {review.rows.filter((r) => r.needs_check).length} provisional holiday(s) in the next 60 days need confirmation.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-1">Holiday</th>
                    <th className="p-1">Date</th>
                    <th className="p-1">Days until</th>
                    <th className="p-1">Status</th>
                    <th className="p-1" />
                  </tr>
                </thead>
                <tbody>
                  {review.rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-1">{r.name}</td>
                      <td className="p-1">{r.date}</td>
                      <td className="p-1">{r.days_until}</td>
                      <td className="p-1">{r.needs_check ? "Needs check" : r.is_provisional ? "Provisional" : "Confirmed"}</td>
                      <td className="p-1 text-right">
                        {r.is_provisional && (
                          <Button size="sm" variant="outline" onClick={() => confirm(r)}>
                            Confirm
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {review.deleted_seeded.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Deleted by HR (not re-seeded): {review.deleted_seeded.map((d) => `${d.name} ${d.seeded_date}`).join(", ")}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export function MainlandLeaveView() {
  const actor = useDashboardActor();
  const visible = SECTIONS.filter((s) =>
    canPerformPermission(actor.permissionLabels, { permissions: [...s.permissions], mode: "any" }),
  );
  const [picked, setSection] = React.useState<Section | null>(null);
  const section = visible.some((s) => s.key === picked) ? picked : (visible[0]?.key ?? null);
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Mainland Tanzania leave"
        description="Profiles, approved policy revisions, cutover sign-off, anniversary balances and reports. Zanzibar and unassigned employees stay on their existing policy."
      />
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {visible.map((s) => (
          <Button key={s.key} size="sm" variant={section === s.key ? "default" : "ghost"} onClick={() => setSection(s.key)}>
            {s.label}
          </Button>
        ))}
      </div>
      {section === "setup" && <SetupSection />}
      {section === "policy" && <PolicySection />}
      {section === "cutover" && <CutoverSection />}
      {section === "balances" && <BalancesSection />}
      {section === "reports" && <ReportsSection />}
      {section === "operations" && <OperationsSection />}
    </div>
  );
}
