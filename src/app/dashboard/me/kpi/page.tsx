"use client";

import * as React from "react";
import { Badge, Button, Card, Spinner, Text, tokens } from "@fluentui/react-components";
import { ArrowRight20Regular } from "@fluentui/react-icons";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { achievementApi, type Achievement } from "@/lib/achievement-api";
import { achievementsEnabled, evaluationsEnabled, readKpiToken } from "@/lib/kpi-session";
import { KpiWorkflowGuidancePanel } from "@/components/dashboard/kpi/kpi-workflow-guidance";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "@/components/dashboard/kpi/kpi-page-elements";

function targetText(target: Record<string, unknown> | undefined) {
  return target ? Object.entries(target).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "—";
}

export default function MyKpiPage() {
  const [rows, setRows] = React.useState<KpiAssignment[]>([]);
  const [achievements, setAchievements] = React.useState<Achievement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    const token = readKpiToken();
    if (!token) { setError("Sign in to see your KPIs."); setLoading(false); return; }
    setLoading(true);
    try { const [assignments, submissions] = await Promise.all([kpiApi.mine(token), achievementApi.mine(token)]); setRows(assignments); setAchievements(submissions); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load your KPIs."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("hrms:refresh-page-data", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("hrms:refresh-page-data", refresh); window.removeEventListener("focus", refresh); };
  }, [load]);
  return <main className="space-y-4 pt-3">
    <KpiPageHeader title="My KPIs" description="Review your assigned targets, submit actual results, and follow their approval status." section="My Performance" actions={evaluationsEnabled ? <Button as="a" href="/dashboard/me/evaluations" appearance="secondary">My evaluations</Button> : undefined} />
    <KpiWorkflowGuidancePanel compact />
    {loading && <div className="py-4"><Spinner label="Loading your KPI assignments" size="small" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && rows.length === 0 && <Card appearance="outline" className="p-5"><Text as="h2" size={400} weight="semibold">No KPIs assigned yet</Text><Text as="p" size={300} style={{ color: tokens.colorNeutralForeground2 }}>HR or an authorized manager must assign a published KPI and target. Your workflow status above shows what is still pending.</Text></Card>}
    {!loading && !error && rows.length > 0 && <div className="grid gap-3 lg:grid-cols-2">{rows.map((row) => {
      const ready = row.status === "active" && !!row.currentTarget;
      const status = achievements.find((item) => item.assignmentId === row.id)?.current?.status;
      const actionLabel = status === "returned" || status === "rejected" ? "Correct achievement" : status === "submitted" || status === "under_review" || status === "approved" ? "View submission" : ready ? "Record achievement" : "View KPI";
      return <Card key={row.id} appearance="outline" className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><Text as="h2" size={400} weight="semibold">{row.definitionVersion?.name ?? `KPI assignment #${row.id}`}</Text><Text as="p" size={300} style={{ color: tokens.colorNeutralForeground2 }}>{row.definitionVersion?.description || "No description provided."}</Text></div><div className="flex flex-wrap gap-1"><KpiStatusBadge status={row.status} />{status && <KpiStatusBadge status={status} />}</div></div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-medium">Reporting period</dt><dd>{row.period?.label ?? "—"}{row.period?.startDate && row.period?.endDate ? ` · ${row.period.startDate} to ${row.period.endDate}` : ""}</dd></div><div><dt className="font-medium">Assigned target</dt><dd>{targetText(row.currentTarget?.target)}</dd></div><div><dt className="font-medium">Measurement</dt><dd>{row.definitionVersion?.measurementUnit ?? row.definitionVersion?.measurementType ?? "—"}</dd></div><div><dt className="font-medium">Responsible manager</dt><dd>{row.managerEmployeeId ? `Employee #${row.managerEmployeeId}` : "Not specified"}</dd></div></dl>
        {!ready && <Badge appearance="outline" color="warning" className="self-start">{row.status !== "active" ? "Assignment inactive" : "Waiting for target configuration"}</Badge>}
        {achievementsEnabled && <div className="mt-auto pt-1"><Button as="a" href={`/dashboard/me/kpi/${row.id}`} appearance={ready && (!status || ["draft", "returned", "rejected"].includes(status)) ? "primary" : "secondary"}>{actionLabel} <ArrowRight20Regular aria-hidden /></Button>{!ready && <Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>An authorized HR user or manager must complete the assignment before you can submit.</Text>}{["submitted", "under_review"].includes(status ?? "") && <Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Pending Manager Review. You can open the submission, but cannot edit it until it is returned.</Text>}</div>}
      </Card>;
    })}</div>}
  </main>;
}
