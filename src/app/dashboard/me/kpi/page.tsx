"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, Spinner, Tab, TabList, Text, tokens } from "@fluentui/react-components";
import { ArrowRight20Regular, CalendarLtr24Regular } from "@fluentui/react-icons";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { achievementApi, type Achievement } from "@/lib/achievement-api";
import { evaluationsEnabled, readKpiToken } from "@/lib/kpi-session";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "@/components/dashboard/kpi/kpi-page-elements";

function displayPeriodDate(value?: string) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = Number(match[2]);
  if (month < 1 || month > 12) return value;
  return `${Number(match[3])} ${months[month - 1]} ${match[1]}`;
}

export default function MyKpiPage() {
  const [assignmentTab, setAssignmentTab] = React.useState<"active" | "inactive">("active");
  const [rows, setRows] = React.useState<KpiAssignment[]>([]);
  const [achievements, setAchievements] = React.useState<Achievement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const activeRows = rows.filter((row) => row.status === "active");
  const inactiveRows = rows.filter((row) => row.status !== "active");
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
    {loading && <div className="py-4"><Spinner label="Loading your KPI assignments" size="small" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && <TabList aria-label="KPI assignment status" selectedValue={assignmentTab} onTabSelect={(_, data) => setAssignmentTab(data.value as "active" | "inactive")}>
      <Tab value="active">Active ({activeRows.length})</Tab>
      <Tab value="inactive">Inactive ({inactiveRows.length})</Tab>
    </TabList>}
    {!loading && !error && assignmentTab === "active" && activeRows.length > 0 && <section className="space-y-3" aria-label="Active KPI assignments"><Text as="h2" size={400} weight="semibold">Active assignments</Text><div className="grid gap-3 lg:grid-cols-2">{activeRows.map((row) => {
      const achievement = achievements.find((item) => item.assignmentId === row.id);
      const status = achievement?.current?.status;
      return <Link key={row.id} href={`/dashboard/me/kpi/${row.id}`} className="kpi-assignment-card-link group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--colorBrandForeground1)]"><Card appearance="outline" className="flex min-w-0 flex-col gap-3 p-5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-3" aria-label="Reporting period dates"><CalendarLtr24Regular aria-hidden style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} /><Text as="span" size={600} weight="semibold" style={{ fontFamily: "var(--font-fredoka)" }}>{displayPeriodDate(row.period?.startDate)}</Text><ArrowRight20Regular aria-hidden style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} /><Text as="span" size={600} weight="semibold" style={{ fontFamily: "var(--font-fredoka)" }}>{displayPeriodDate(row.period?.endDate)}</Text></div><div className="flex flex-wrap gap-1"><KpiStatusBadge status={row.status} />{status && <KpiStatusBadge status={status} />}</div></div>
        <Text as="h3" size={500} weight="semibold" style={{ fontFamily: "var(--font-fredoka)" }}>{row.definitionVersion?.name ?? `KPI assignment #${row.id}`}</Text>
      </Card></Link>;
    })}</div></section>}
    {!loading && !error && assignmentTab === "active" && activeRows.length === 0 && <Card appearance="outline" className="p-5"><Text as="h2" size={400} weight="semibold">{rows.length === 0 ? "No KPIs assigned yet" : "No active KPI assignments"}</Text><Text as="p" size={300} style={{ color: tokens.colorNeutralForeground2 }}>{rows.length === 0 ? "HR or your manager will add your KPI assignments here." : "Your earlier assignments are available in the Inactive tab."}</Text></Card>}
    {!loading && !error && assignmentTab === "inactive" && inactiveRows.length === 0 && <Card appearance="outline" className="p-5"><Text as="h2" size={400} weight="semibold">No inactive assignments</Text><Text as="p" size={300} style={{ color: tokens.colorNeutralForeground2 }}>Inactive KPI assignments will appear here for reference.</Text></Card>}
    {!loading && !error && assignmentTab === "inactive" && inactiveRows.length > 0 && <section className="space-y-3" aria-label="Inactive KPI assignments"><Text as="h2" size={400} weight="semibold">Inactive assignments</Text><div className="grid gap-3 lg:grid-cols-2">{inactiveRows.map((row) => { const status = achievements.find((item) => item.assignmentId === row.id)?.current?.status; return <Link key={row.id} href={`/dashboard/me/kpi/${row.id}`} className="kpi-assignment-card-link group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--colorBrandForeground1)]"><Card appearance="outline" className="flex min-w-0 flex-col gap-3 p-5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-3" aria-label="Reporting period dates"><CalendarLtr24Regular aria-hidden style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} /><Text as="span" size={600} weight="semibold" style={{ fontFamily: "var(--font-fredoka)" }}>{displayPeriodDate(row.period?.startDate)}</Text><ArrowRight20Regular aria-hidden style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} /><Text as="span" size={600} weight="semibold" style={{ fontFamily: "var(--font-fredoka)" }}>{displayPeriodDate(row.period?.endDate)}</Text></div><div className="flex flex-wrap gap-1"><KpiStatusBadge status={row.status} />{status && <KpiStatusBadge status={status} />}</div></div><Text as="h3" size={500} weight="semibold" style={{ fontFamily: "var(--font-fredoka)" }}>{row.definitionVersion?.name ?? `KPI assignment #${row.id}`}</Text></Card></Link>; })}</div></section>}
  </main>;
}
