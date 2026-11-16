"use client";

import * as React from "react";
import Link from "next/link";
import {
  Accordion, AccordionHeader, AccordionItem, AccordionPanel, Badge, Button, Card,
  Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  ProgressBar, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, tokens,
} from "@fluentui/react-components";
import {
  ArrowRight20Regular, CheckmarkCircle20Regular, Clock20Regular,
  DocumentBulletList20Regular, History20Regular, LockClosed20Regular,
  Target20Regular,
} from "@fluentui/react-icons";
import { achievementApi, type Achievement } from "@/lib/achievement-api";
import { evaluationApi, type Evaluation } from "@/lib/evaluation-api";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { kpiAnalyticsApi, type ScorecardTrend } from "@/lib/kpi-analytics-api";
import { readKpiToken } from "@/lib/kpi-session";
import { kpiWorkflowApi, type KpiWorkflowGuidance, type KpiWorkflowWaitingStep } from "@/lib/kpi-workflow-api";
import { scorecardApi, type Scorecard } from "@/lib/scorecard-api";
import {
  selectCurrentPersonalEvaluation, selectCurrentPersonalScorecard,
  selectPersonalNextStep, selectPersonalPeriod,
} from "@/lib/personal-performance";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import { PersonalPerformanceIllustration } from "./personal-performance-illustration";
import styles from "./personal-performance-dashboard.module.css";

type PersonalData = {
  assignments: KpiAssignment[];
  achievements: Achievement[];
  scorecards: Scorecard[];
  evaluations: Evaluation[];
  trend: ScorecardTrend | null;
};

type JourneyState = "complete" | "current" | "waiting" | "upcoming";
type JourneyStep = { id: string; title: string; state: JourneyState; owner: string; explanation: string; badgeLabel?: string };

function journeyFromGuidance(guidance: KpiWorkflowGuidance, evaluation: Evaluation | null): JourneyStep[] {
  const steps = new Map((guidance.waiting ?? []).map((step) => [step.id, step]));
  const combined = (ids: string[], title: string, fallbackOwner: string): JourneyStep => {
    const items = ids.map((id) => steps.get(id)).filter((step): step is KpiWorkflowWaitingStep => !!step);
    const pending = items.find((step) => step.status === "pending");
    const state: JourneyState = items.length === ids.length && items.every((step) => step.status === "complete")
      ? "complete" : pending ? pending.owner === "Employee" ? "current" : "waiting" : "upcoming";
    const lead = pending ?? items.find((step) => step.status === "unavailable") ?? items[0];
    return { id: ids.join("-"), title, state, owner: lead?.owner ?? fallbackOwner, explanation: lead?.explanation ?? "This step becomes available when its prerequisites are complete.", badgeLabel: lead?.id === "assignment" && state === "waiting" ? "You’re not assigned" : undefined };
  };
  const evaluationState: JourneyState = !evaluation ? "upcoming" : evaluation.status === "finalized" ? "complete" : ["self_draft", "self_returned"].includes(evaluation.status) ? "current" : "waiting";
  return [
    combined(["period", "definition"], "KPI Setup", "HR"),
    combined(["assignment", "target"], "Assignment", "HR or authorized manager"),
    combined(["achievement"], "Achievement", "Employee"),
    combined(["manager_review"], "Review", "Authorized manager"),
    { id: "evaluation", title: "Evaluation", state: evaluationState, owner: !evaluation ? "HR or authorized manager" : evaluationState === "current" ? "Employee" : evaluation.status === "finalized" ? "Employee" : "Assigned manager or HR", explanation: !evaluation ? "HR starts an evaluation when the applicable cycle and scorecard are ready." : evaluation.status === "finalized" ? "The finalized result is preserved in your evaluation history." : evaluationState === "current" ? "Your self-assessment needs your input." : "Your evaluation is with its assigned reviewer." },
  ];
}

function PerformanceMetric({ title, icon, children, href, linkText }: { title: string; icon: React.ReactNode; children: React.ReactNode; href: string; linkText: string }) {
  return <section className="flex min-w-0 flex-col gap-2 py-4 sm:px-4 first:sm:pl-0 last:sm:pr-0">
    <div className="flex items-center gap-2"><span aria-hidden="true" style={{ color: tokens.colorBrandForeground1 }}>{icon}</span><Text as="h2" size={300} weight="semibold">{title}</Text></div>
    <div className="flex min-h-14 flex-col gap-1">{children}</div>
    <Button as="a" href={href} appearance="subtle" size="small" className="self-start">{linkText} <ArrowRight20Regular aria-hidden /></Button>
  </section>;
}

export function PersonalPerformanceDashboard() {
  const [data, setData] = React.useState<PersonalData | null>(null);
  const [guidance, setGuidance] = React.useState<KpiWorkflowGuidance | null>(null);
  const [guidanceError, setGuidanceError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [reminder, setReminder] = React.useState<KpiWorkflowWaitingStep | null>(null);
  const [reminderBusy, setReminderBusy] = React.useState(false);
  const [reminderNotice, setReminderNotice] = React.useState("");
  const [reminderError, setReminderError] = React.useState("");
  const load = React.useCallback(async () => {
    const token = readKpiToken();
    if (!token) { setError("Sign in to view your performance."); setLoading(false); return; }
    setLoading(true);
    try {
      const [assignments, achievements, scorecards, evaluations, guidanceResult] = await Promise.all([
        kpiApi.mine(token), achievementApi.mine(token), scorecardApi.mine(token), evaluationApi.mine(token),
        kpiWorkflowApi.guidance(token).catch(() => null),
      ]);
      const trend = scorecards.length ? await kpiAnalyticsApi.scorecardTrends(token).catch(() => null) : null;
      setData({ assignments, achievements, scorecards, evaluations, trend });
      setGuidance(guidanceResult);
      setGuidanceError(guidanceResult ? "" : "Workflow guidance is temporarily unavailable. Your records below are still current.");
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
  const sendReminder = async () => {
    if (!reminder?.reminderKey || reminderBusy) return;
    const token = readKpiToken();
    if (!token) { setReminderError("Sign in again before sending a reminder."); return; }
    setReminderBusy(true);
    setReminderError("");
    try {
      const result = await kpiWorkflowApi.remindHr(token, reminder.reminderKey);
      setReminderNotice(result.message);
      setReminder(null);
      const refreshed = await kpiWorkflowApi.guidance(token);
      setGuidance(refreshed);
    } catch (cause) { setReminderError(cause instanceof Error ? cause.message : "The reminder could not be recorded."); }
    finally { setReminderBusy(false); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const period = data ? selectPersonalPeriod(data.assignments, data.scorecards, today) : null;
  const periodIsCurrent = !!period && period.startDate <= today && today <= period.endDate;
  const assignments = data?.assignments.filter((row) => row.status === "active" && !!row.period?.startDate && !!row.period?.endDate && row.period.startDate <= today && today <= row.period.endDate) ?? [];
  const upcomingAssignments = data?.assignments.filter((row) => row.status === "active" && !!row.period?.startDate && row.period.startDate > today) ?? [];
  const pastAssignments = data?.assignments.filter((row) => !!row.period?.endDate && row.period.endDate < today).sort((a, b) => (b.period?.endDate ?? "").localeCompare(a.period?.endDate ?? "")) ?? [];
  const currentScorecard = data && periodIsCurrent ? selectCurrentPersonalScorecard(data.scorecards, period.id) : null;
  const currentEvaluation = data ? selectCurrentPersonalEvaluation(data.evaluations) : null;
  const achievementByAssignment = new Map(data?.achievements.map((row) => [row.assignmentId, row]) ?? []);
  const approved = assignments.filter((row) => achievementByAssignment.get(row.id)?.approvedRevisionId).length;
  const pending = assignments.filter((row) => ["submitted", "under_review"].includes(achievementByAssignment.get(row.id)?.current?.status ?? "")).length;
  const returned = assignments.filter((row) => achievementByAssignment.get(row.id)?.current?.status === "returned").length;
  const next = data ? selectPersonalNextStep(guidance, data.assignments, data.scorecards) : null;
  const journey = guidance ? journeyFromGuidance(guidance, currentEvaluation) : [];
  const finishedSteps = journey.filter((step) => step.state === "complete").length;
  const hasCurrent = assignments.length > 0 || !!currentScorecard || !!(currentEvaluation && currentEvaluation.status !== "finalized");
  const hasHistory = !!data && (data.scorecards.some((row) => row.id !== currentScorecard?.id) || data.evaluations.some((row) => row.status === "finalized"));
  const history = data?.trend?.points.filter((point) => point.scorecardId !== currentScorecard?.id).slice(-3).reverse() ?? [];
  const periodLabel = periodIsCurrent ? `${period.label} · ${period.startDate}–${period.endDate}` : null;
  const performanceStatus = currentScorecard?.performanceStatus === "scored" && currentScorecard.overallScore != null
    ? `Live approved score ${currentScorecard.overallScore}%` : currentScorecard ? `${currentScorecard.completenessPercent ?? "0"}% data complete` : null;
  const nextAssignmentId = next?.href?.match(/\/(\d+)(?:[?#].*)?$/)?.[1];
  const nextAssignment = nextAssignmentId ? data?.assignments.find((row) => row.id === Number(nextAssignmentId)) : undefined;
  const achievementAction = next?.kind === "action" && /^\/dashboard\/me\/kpi\/\d+/.test(next.href ?? "");
  const nextHref = achievementAction ? "/dashboard/me/kpi" : next?.href;
  const nextActionLabel = achievementAction ? "Choose a KPI" : next?.actionLabel;
  const nextDescription = achievementAction
    ? "Choose the KPI and reporting period you want to submit an achievement for."
    : next && nextAssignment
    ? next.description.replaceAll(`KPI assignment #${nextAssignment.id}`, nextAssignment.definitionVersion?.name ?? "your assigned KPI")
    : next?.description;
  const illustrationKind = next?.kind === "waiting" ? next.reminder?.id === "manager_review" || next.reminder?.id === "hr_finalization" ? "review" : "setup" : next?.kind === "complete" ? approved > 0 ? "approved" : hasHistory ? "history" : "setup" : "review";

  return <main className="space-y-5 pt-3" aria-label="My Performance dashboard">
    <KpiPageHeader title="My Performance" section="YOUR PERFORMANCE" description="See your assigned KPIs, submit results and follow manager review and evaluation." actions={<><Link href="/dashboard/me/kpi">My KPIs</Link><Link href="/dashboard/me/evaluations">My evaluations</Link></>} />
    <div className="flex flex-wrap gap-2">{periodLabel && <Badge appearance="outline">{periodLabel}</Badge>}{performanceStatus && <Badge appearance="filled" color={currentScorecard?.performanceStatus === "scored" ? "success" : "informative"}>{performanceStatus}</Badge>}</div>
    {loading && <div className="py-5"><Spinner label="Loading your performance" size="medium" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && data && <>
      <Card appearance="outline" className={`${styles.enter} ${styles.delayOne} overflow-hidden p-4 sm:p-6`} style={{ background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1}, ${tokens.colorBrandBackground2})` }}>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div className="flex max-w-2xl flex-col gap-2"><Text as="p" size={200} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>YOUR NEXT STEP</Text><Text as="h2" size={500} weight="semibold">{next?.kind === "complete" && approved > 0 ? "Your achievement has been approved" : next?.title ?? "Next step temporarily unavailable"}</Text><Text as="p" size={300} style={{ color: tokens.colorNeutralForeground2 }}>{nextDescription ?? guidanceError}</Text>{next && <Text as="p" size={200}>Responsible: {next.owner}</Text>}
          <div className="mt-2 flex flex-wrap items-center gap-2">{next?.kind === "action" && nextHref && <Link href={nextHref} className="inline-flex"><Button appearance="primary">{nextActionLabel} <ArrowRight20Regular aria-hidden /></Button></Link>}{next?.reminder?.reminderKey && <Button appearance="secondary" disabled={!!next.reminder.reminderBlockedReason} onClick={() => setReminder(next.reminder ?? null)}>{next.reminder.reminderStatus === "active" ? "HR has already been notified" : next.reminder.reminderStatus === "closed_unresolved" ? "Reminder closed" : "Remind HR"}</Button>}{next?.reminder?.reminderBlockedReason && <Text size={200}>{next.reminder.reminderBlockedReason}</Text>}{next?.kind === "complete" && hasHistory && <Link href="/dashboard/me/scorecards" className="inline-flex"><Button appearance="secondary">View history <ArrowRight20Regular aria-hidden /></Button></Link>}</div>
        </div><PersonalPerformanceIllustration kind={illustrationKind} className={styles.illustration} /></div>
      </Card>
      {reminderNotice && <KpiFeedback intent="success">{reminderNotice}</KpiFeedback>}
      {reminderError && <KpiFeedback intent="error">{reminderError}</KpiFeedback>}
      {guidanceError && <KpiFeedback intent="warning">{guidanceError}</KpiFeedback>}
      {!hasCurrent && !hasHistory && upcomingAssignments.length === 0 && pastAssignments.length === 0 && <section className="border-y border-border py-6"><Text as="h2" size={400} weight="semibold">No KPI activity yet</Text><Text as="p" size={300} className="mt-1 text-muted-foreground">When HR or your manager assigns a KPI, it will appear here with its target and reporting period.</Text></section>}
      {hasCurrent && <div className={`${styles.enter} ${styles.delayTwo} grid divide-y divide-border border-y border-border md:grid-cols-2 md:divide-y-0 xl:grid-cols-4`}>
        <PerformanceMetric title="My active KPIs" icon={<Target20Regular />} href="/dashboard/me/kpi" linkText="View assigned KPIs"><Text size={500} weight="semibold">{assignments.length}</Text><Text size={200}>{assignments.length ? "Across all active reporting periods" : period?.label ?? "No current period"}</Text>{assignments.length > 0 && <Text size={200}>{approved} with approved results</Text>}</PerformanceMetric>
        <PerformanceMetric title="Achievement status" icon={<DocumentBulletList20Regular />} href="/dashboard/me/kpi" linkText="Open achievements"><Text size={300}>{approved} approved · {pending} in review</Text>{returned > 0 && <Text size={200}>{returned} returned for correction</Text>}{assignments.length > 0 && <ProgressBar value={approved / assignments.length} aria-label={`${approved} of ${assignments.length} KPIs have approved results`} />}</PerformanceMetric>
        <PerformanceMetric title="Current scorecard" icon={<CheckmarkCircle20Regular />} href={currentScorecard ? `/dashboard/me/scorecards/${currentScorecard.id}` : "/dashboard/me/scorecards"} linkText="View scorecard"><Text size={400} weight="semibold">{currentScorecard?.performanceStatus === "scored" && currentScorecard.overallScore != null ? `${currentScorecard.overallScore}% live score` : "Awaiting approved data"}</Text><Text size={200}>{currentScorecard ? `${currentScorecard.completenessPercent ?? "0"}% data complete` : "No published scorecard yet"}</Text></PerformanceMetric>
        <PerformanceMetric title="My evaluation" icon={<DocumentBulletList20Regular />} href={currentEvaluation ? `/dashboard/me/evaluations/${currentEvaluation.id}` : "/dashboard/me/evaluations"} linkText="View evaluation"><Text size={300} weight="semibold">{currentEvaluation ? currentEvaluation.status.replaceAll("_", " ") : "Not started"}</Text><Text size={200}>{currentEvaluation?.status === "finalized" ? currentEvaluation.ackStatus ? `Receipt ${currentEvaluation.ackStatus}` : "Acknowledgement available" : currentEvaluation ? "Open for the next step" : "HR starts evaluation cycles"}</Text></PerformanceMetric>
      </div>}
      {journey.length > 0 && <section className={`${styles.enter} ${styles.delayTwo} space-y-3 border-t border-border pt-5`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-col gap-1"><Text as="h2" size={400} weight="semibold">Your KPI journey</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>See what is complete and who owns the next step.</Text></div><Badge appearance="outline">{finishedSteps} of {journey.length} steps complete</Badge></div><ProgressBar value={finishedSteps / journey.length} aria-label={`${finishedSteps} of ${journey.length} KPI journey steps complete`} /><Accordion collapsible multiple>{journey.map((step) => <AccordionItem key={step.id} value={step.id}><AccordionHeader><span className="flex flex-wrap items-center gap-2"><span aria-hidden="true" style={{ color: step.state === "complete" ? tokens.colorPaletteGreenForeground1 : tokens.colorBrandForeground1 }}>{step.state === "complete" ? <CheckmarkCircle20Regular /> : step.state === "upcoming" ? <LockClosed20Regular /> : <Clock20Regular />}</span><Text weight="semibold">{step.title}</Text>{step.badgeLabel ? <Badge appearance="outline" color="informative">{step.badgeLabel}</Badge> : <KpiStatusBadge status={step.state} />}</span></AccordionHeader><AccordionPanel><div className={styles.journeyPanel}><Text as="p" size={300}>{step.explanation}</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Responsible: {step.owner}</Text></div></AccordionPanel></AccordionItem>)}</Accordion></section>}
      {upcomingAssignments.length > 0 && <section className={`${styles.enter} ${styles.delayTwo} space-y-3 border-t border-border pt-5`}><div className="flex flex-wrap items-center justify-between gap-2"><div><Text as="h2" size={400} weight="semibold">Upcoming KPI assignments</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>These KPIs become active when their reporting periods start.</Text></div><Button as="a" href="/dashboard/me/kpi" appearance="secondary" size="small">View all My KPIs</Button></div><div className="overflow-x-auto"><Table aria-label="Upcoming KPI assignments" size="small" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell>KPI</TableHeaderCell><TableHeaderCell>Reporting period</TableHeaderCell><TableHeaderCell>Starts</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell></TableRow></TableHeader><TableBody>{upcomingAssignments.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.definitionVersion?.name ?? `KPI assignment #${row.id}`}</TableCell><TableCell>{row.period?.label ?? "—"}</TableCell><TableCell>{row.period?.startDate ?? "—"}</TableCell><TableCell>{row.currentTarget ? Object.entries(row.currentTarget.target).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "Not set"}</TableCell></TableRow>)}</TableBody></Table></div></section>}
      {pastAssignments.length > 0 && <section className={`${styles.enter} ${styles.delayTwo} space-y-3 border-t border-border pt-5`}><div className="flex flex-wrap items-center justify-between gap-2"><div><Text as="h2" size={400} weight="semibold">Previous reporting periods</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Each period has its own assignment and result. Corrections to a result are kept in its revision history.</Text></div><Button as="a" href="/dashboard/me/kpi" appearance="secondary" size="small">View all assignments</Button></div><div className="overflow-x-auto"><Table aria-label="KPI assignments from previous reporting periods" size="small" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell>KPI</TableHeaderCell><TableHeaderCell>Reporting period</TableHeaderCell><TableHeaderCell>Result status</TableHeaderCell><TableHeaderCell>Actual</TableHeaderCell><TableHeaderCell /></TableRow></TableHeader><TableBody>{pastAssignments.map((row) => { const achievement = achievementByAssignment.get(row.id); return <TableRow key={row.id}><TableCell className="font-medium">{row.definitionVersion?.name ?? "KPI"}</TableCell><TableCell>{row.period?.label ?? "—"}</TableCell><TableCell>{achievement?.current.status.replaceAll("_", " ") ?? "No result submitted"}</TableCell><TableCell>{achievement?.current.actual == null ? "—" : typeof achievement.current.actual === "object" ? Object.entries(achievement.current.actual as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : String(achievement.current.actual)}</TableCell><TableCell><Link href={`/dashboard/me/kpi/${row.id}`} className="text-primary underline">View</Link></TableCell></TableRow>})}</TableBody></Table></div></section>}
      {hasHistory && <section className={`${styles.enter} ${styles.delayTwo} space-y-3 border-t border-border pt-5`}><div className="flex flex-wrap items-center gap-2"><History20Regular aria-hidden style={{ color: tokens.colorBrandForeground1 }} /><Text as="h2" size={400} weight="semibold">Your performance history</Text></div><Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Approved results can change after corrections; finalized evaluations keep their original snapshot.</Text>{history.length > 0 && <div className="divide-y divide-border">{history.map((point) => <div key={point.scorecardId} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><Text weight="semibold">{data.scorecards.find((row) => row.id === point.scorecardId)?.currentVersion.name ?? "Scorecard"} · {point.periodLabel}</Text><Text size={200}>Live: {point.comparable && point.liveScore != null ? `${point.liveScore}%` : "Incomplete or not comparable"}</Text><Text size={200}>Finalized: {point.finalizedScore != null ? `${point.finalizedScore}%` : "None"}</Text>{point.reason && <Text size={200} className="text-muted-foreground sm:col-span-3">{point.reason}</Text>}</div>)}</div>}<div className="flex flex-wrap gap-2"><Button as="a" href="/dashboard/me/scorecards" appearance="secondary" size="small">Scorecards</Button><Button as="a" href="/dashboard/me/evaluations" appearance="secondary" size="small">Evaluations</Button><Button as="a" href="/dashboard/me/kpi/reports" appearance="secondary" size="small">My KPI report</Button></div></section>}
    </>}
    <Dialog open={!!reminder} onOpenChange={(_, state) => { if (!state.open && !reminderBusy) setReminder(null); }}><DialogSurface><DialogBody><DialogTitle>Remind HR?</DialogTitle><DialogContent>This records one shared in-app reminder for the unresolved activity. The backend prevents duplicate active reminders.</DialogContent><DialogActions><Button appearance="secondary" disabled={reminderBusy} onClick={() => setReminder(null)}>Cancel</Button><Button appearance="primary" disabled={reminderBusy} onClick={() => void sendReminder()}>{reminderBusy ? "Sending…" : "Send reminder"}</Button></DialogActions></DialogBody></DialogSurface></Dialog>
  </main>;
}
