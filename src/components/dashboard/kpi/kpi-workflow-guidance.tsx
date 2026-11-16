"use client"

import * as React from "react"
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Badge, Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody, ProgressBar, Spinner, Text, Tooltip, tokens } from "@fluentui/react-components"
import { ArrowRight24Regular, CheckmarkCircle24Regular, LockClosed24Regular } from "@fluentui/react-icons"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { readKpiToken } from "@/lib/kpi-session"
import { useRouter } from "next/navigation"
import { kpiWorkflowApi, type KpiWorkflowAction, type KpiWorkflowGuidance, type KpiWorkflowRecord, type KpiWorkflowStageId } from "@/lib/kpi-workflow-api"

const recordStages: Record<KpiWorkflowRecord["kind"], KpiWorkflowStageId[]> = {
  definition: ["define", "assign", "track", "close"],
  assignment: ["assign", "track", "submit", "review", "approve", "close"],
  achievement: ["submit", "review", "approve"],
  scorecard: ["assign", "track", "submit", "review", "approve", "close"],
  evaluation: ["setup", "submit", "review", "approve", "close"],
}

export function KpiWorkflowProgress({ guidance, record, compact = false }: { guidance: KpiWorkflowGuidance; record: KpiWorkflowRecord; compact?: boolean }) {
  const steps = recordStages[record.kind]
  const current = steps.indexOf(record.stage)
  const exceptional = /returned|rejected|disputed|amended|archived|inactive|cancelled/.test(record.status)
  return <Card appearance="outline" className={`rounded-xl ${compact ? "space-y-2 p-3" : "space-y-3 p-4"}`} aria-label={`${record.kind} workflow progress`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><Text weight="semibold">{compact ? "Workflow" : `${record.kind.replace(/^./, (letter) => letter.toUpperCase())} #${record.id} · ${record.status.replaceAll("_", " ")}`}</Text><Badge color={exceptional ? "warning" : "brand"}>{guidance.stages.find((stage) => stage.id === record.stage)?.name ?? record.stage}</Badge></div>
    <ProgressBar value={exceptional ? undefined : (current + 1) / steps.length} aria-label="Workflow stage progress" />
    <ol className="flex flex-wrap gap-2" aria-label="Workflow stages">{guidance.stages.filter((stage) => steps.includes(stage.id)).map((stage) => {
      const index = steps.indexOf(stage.id)
      const completed = index < current && !exceptional
      const active = stage.id === record.stage
      const label = `${stage.name}: ${stage.description} Responsible: ${stage.roles.join(", ")}`
      return <li key={stage.id} aria-current={active ? "step" : undefined}><Tooltip content={label} relationship="description"><Badge appearance={active ? "filled" : "outline"} color={completed ? "success" : active ? "brand" : "informative"}>{completed ? <CheckmarkCircle24Regular fontSize={14} aria-hidden /> : index + 1} {stage.name}</Badge></Tooltip></li>
    })}</ol>
    <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{compact ? `Next step: ${guidance.stages.find((stage) => stage.id === record.stage)?.name ?? record.stage}. ${record.owner} is responsible.` : `Responsible: ${record.owner}. ${record.blockedReason ?? (exceptional ? "This record needs follow-up; its earlier result remains in history." : "Open the record for available actions.")}`}</Text>
    <Button as="a" href={record.href} appearance="secondary" size="small" className={compact ? "w-1/2 max-w-full" : undefined}>{compact ? `Open ${record.kind}` : <>Open {record.kind} <ArrowRight24Regular aria-hidden /></>}</Button>
  </Card>
}

export function KpiNextActions({ guidance, compact = false, onAction }: { guidance: KpiWorkflowGuidance; compact?: boolean; onAction?: (action: KpiWorkflowAction) => void }) {
  const router = useRouter()
  const available = guidance.actions.filter((action) => !action.blocked)
  const blocked = guidance.actions.filter((action) => action.blocked)
  if (compact) {
    const next = available[0]
    return <Card appearance="outline" className="gap-2 rounded-lg px-3 py-2 shadow-sm" aria-label="Your Next Actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2"><Text as="h2" size={300} weight="semibold">Your Next Actions</Text><Badge appearance="outline" color={available.length ? "brand" : "success"}>{available.length} available</Badge>{blocked.length > 0 && <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{blocked.length} waiting on prerequisites</Text>}</div>
        {next && (onAction && next.id === "create-assignment" ? <Button onClick={() => onAction(next)} appearance="primary" size="small">{next.title} <ArrowRight24Regular aria-hidden /></Button> : <Button onClick={() => router.push(next.href)} appearance="primary" size="small">{next.title} <ArrowRight24Regular aria-hidden /></Button>)}
      </div>
      {!available.length && !blocked.length && <Text size={200}>You&apos;re all caught up. No actions require your attention right now.</Text>}
      {(available.length > 1 || blocked.length > 0) && <Accordion collapsible><AccordionItem value="all-actions"><AccordionHeader>View all actions and prerequisites</AccordionHeader><AccordionPanel><div className="space-y-3 pb-2">{available.length > 1 && <div className="grid gap-2 md:grid-cols-2">{available.slice(1).map((action) => <ActionCard key={action.id} action={action} />)}</div>}{blocked.length > 0 && <><Text as="h3" weight="semibold">Waiting on prerequisites</Text><div className="grid gap-2 md:grid-cols-2">{blocked.map((action) => <ActionCard key={action.id} action={action} />)}</div></>}</div></AccordionPanel></AccordionItem></Accordion>}
    </Card>
  }
  return <Card appearance="outline" className="space-y-4 rounded-xl p-5" aria-label="Your Next Actions">
    <div className="flex flex-col gap-1"><Text as="h2" size={compact ? 400 : 500} weight="semibold">Your Next Actions</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Actions are based on records available to your current company and role.</Text></div>
    {!available.length && !blocked.length && <Text as="p">{guidance.waiting?.some((step) => step.status === "pending") ? "No action is available to you yet. The pending steps below show who can move this forward." : "You're all caught up. No actions require your attention right now."}</Text>}
    {available.length > 0 && <div className="grid gap-3 md:grid-cols-2">{available.slice(0, compact ? 4 : 12).map((action) => <ActionCard key={action.id} action={action} />)}</div>}
    {blocked.length > 0 && <div className="space-y-2"><Text as="h3" weight="semibold">Waiting on prerequisites</Text><div className="grid gap-3 md:grid-cols-2">{blocked.slice(0, compact ? 2 : 6).map((action) => <ActionCard key={action.id} action={action} />)}</div></div>}
  </Card>
}
function ActionCard({ action }: { action: KpiWorkflowAction }) {
  return <Card appearance="filled-alternative" className="flex flex-col gap-2 p-4">
    <div className="flex flex-wrap items-center gap-2"><Badge color={action.blocked ? "warning" : "brand"}>{action.stage}</Badge><Text weight="semibold">{action.title}</Text></div>
    <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{action.reason ?? action.description}</Text>
    <Text size={200}>Responsible: {action.owner}</Text>
    {action.dueDate && <Text size={200}>Due: {action.dueDate}</Text>}
    {action.blocked ? <div className="flex flex-wrap items-center gap-2"><Tooltip content={action.reason ?? "A prerequisite is missing"} relationship="description"><Button size="small" disabled icon={<LockClosed24Regular />}>Unavailable</Button></Tooltip>{action.resolveHref && <Button as="a" href={action.resolveHref} size="small" appearance="subtle">Resolve prerequisite</Button>}</div> : <Button as="a" href={action.href} size="small" appearance="primary" className="self-start">Continue <ArrowRight24Regular aria-hidden /></Button>}
  </Card>
}

export function KpiWorkflowGuidancePanel({ recordKind, recordId, compact = false, onGuidance, onAction }: { recordKind?: KpiWorkflowRecord["kind"]; recordId?: number; compact?: boolean; onGuidance?: (guidance: KpiWorkflowGuidance) => void; onAction?: (action: KpiWorkflowAction) => void }) {
  const actor = useDashboardActor()
  const [guidance, setGuidance] = React.useState<KpiWorkflowGuidance | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [reminderKey, setReminderKey] = React.useState<string | null>(null)
  const [reminderBusy, setReminderBusy] = React.useState(false)
  const [reminderMessage, setReminderMessage] = React.useState("")
  const [reminderError, setReminderError] = React.useState("")
  const load = React.useCallback(() => {
    if (!actor.ready) return
    const token = readKpiToken()
    if (!token) { setLoading(false); return }
    void kpiWorkflowApi.guidance(token).then((result) => { setGuidance(result); onGuidance?.(result); setError("") }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Workflow guidance unavailable")).finally(() => setLoading(false))
  }, [actor.ready, onGuidance])
  React.useEffect(() => {
    load()
    const refresh = () => load()
    window.addEventListener("hrms:refresh-page-data", refresh)
    window.addEventListener("focus", refresh)
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") refresh() }, 30000)
    return () => { window.removeEventListener("hrms:refresh-page-data", refresh); window.removeEventListener("focus", refresh); window.clearInterval(interval) }
  }, [load])
  if (!actor.ready || loading) return <Spinner size="small" label="Loading workflow guidance" />
  if (error) return <MessageBar intent="warning"><MessageBarBody>{error}</MessageBarBody></MessageBar>
  if (!guidance) return null
  const record = recordKind && recordId ? guidance.records.find((row) => row.kind === recordKind && row.id === recordId) : undefined
  const waiting = guidance.waiting ?? []
  const remind = async () => {
    if (!reminderKey || reminderBusy) return
    const token = readKpiToken()
    if (!token) { setReminderError("Sign in again to send a reminder."); return }
    setReminderBusy(true)
    setReminderError("")
    try {
      const result = await kpiWorkflowApi.remindHr(token, reminderKey)
      setReminderMessage(result.message)
      setReminderKey(null)
      load()
    } catch (cause) { setReminderError(cause instanceof Error ? cause.message : "The reminder could not be recorded.") }
    finally { setReminderBusy(false) }
  }
  return <div className="space-y-3">{record && <KpiWorkflowProgress guidance={guidance} record={record} compact={compact} />}{!recordKind && <KpiNextActions guidance={guidance} compact={compact} onAction={onAction} />}{!recordKind && waiting.length > 0 && <Card appearance="outline" className="space-y-3 rounded-xl p-5" aria-label="My KPI workflow status"><div className="flex flex-col gap-1"><Text as="h2" size={400} weight="semibold">My KPI workflow status</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>See who owns each step. HR setup is read-only here; your own achievement actions appear above when available.</Text></div><ol className="grid gap-2 md:grid-cols-2">{waiting.map((step) => <li key={step.id} className="flex flex-col gap-2 rounded-lg p-3" style={{ border: `1px solid ${tokens.colorNeutralStroke2}` }}><div className="flex flex-wrap items-center gap-2"><Badge color={step.status === "complete" ? "success" : step.status === "pending" ? "warning" : "informative"}>{step.status === "complete" ? "Complete" : step.status === "pending" ? "Pending" : "Not available yet"}</Badge><Text weight="semibold">{step.title}</Text></div><Text size={200}>{step.explanation}</Text><Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Responsible: {step.owner}</Text>{step.reminderKey && <><Button size="small" appearance="secondary" className="self-start" disabled={!!step.reminderBlockedReason} onClick={() => { setReminderError(""); setReminderKey(step.reminderKey ?? null) }}>{step.reminderStatus === "active" ? "Reminder Already Sent" : step.reminderStatus === "closed_unresolved" ? "Reminder Closed" : step.reminderStatus === "no_recipient" ? "Contact HR" : "Remind HR"}</Button>{step.reminderBlockedReason && <Text size={200}>{step.reminderBlockedReason}</Text>}</>}</li>)}</ol>{reminderMessage && <MessageBar intent="success"><MessageBarBody>{reminderMessage}</MessageBarBody></MessageBar>}{reminderError && <MessageBar intent="error"><MessageBarBody>{reminderError}</MessageBarBody></MessageBar>}</Card>}<Dialog open={!!reminderKey} onOpenChange={(_, data) => { if (!data.open && !reminderBusy) setReminderKey(null) }}><DialogSurface><DialogBody><DialogTitle>Remind HR?</DialogTitle><DialogContent>This records one shared in-app reminder for the unresolved HR activity. A second reminder stays unavailable while that issue remains active; no email or SMS is implied.</DialogContent><DialogActions><Button appearance="secondary" disabled={reminderBusy} onClick={() => setReminderKey(null)}>Cancel</Button><Button appearance="primary" disabled={reminderBusy} onClick={() => void remind()}>{reminderBusy ? "Sending…" : "Send reminder"}</Button></DialogActions></DialogBody></DialogSurface></Dialog></div>
}
