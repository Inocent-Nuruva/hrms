"use client"

import * as React from "react"
import { Badge, Button, Card, CardHeader, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody, ProgressBar, Spinner, Text } from "@fluentui/react-components"
import { CheckmarkCircle20Regular, Clock20Regular, ArrowRight20Regular } from "@fluentui/react-icons"
import { getOnboardingReadiness, type OnboardingReadiness, type OnboardingReadinessRequirement } from "@/lib/admin-api"

export function OnboardingReadinessOverview({ token, requestId, employeeName, canActivate, saving, onActivate, onNavigate, refreshKey, onDiscuss }: {
  token: string
  requestId: number
  employeeName: string
  canActivate: boolean
  saving: boolean
  onActivate: () => void
  onNavigate: (action: OnboardingReadinessRequirement["action"], requirementId: string) => void
  refreshKey?: string | number
  onDiscuss?: (requirementId: string, label: string) => void
}) {
  const [readiness, setReadiness] = React.useState<OnboardingReadiness | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [revision, setRevision] = React.useState(0)
  const [showCompleted, setShowCompleted] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    let sequence = 0
    const refresh = async () => {
      if (document.visibilityState === "hidden" || saving) return
      const current = ++sequence
      setLoading(true)
      setError("")
      try {
        const result = await getOnboardingReadiness(token, requestId)
        if (!cancelled && current === sequence) setReadiness(result)
      } catch (cause) {
        if (!cancelled && current === sequence) {
          setReadiness(null)
          setError(cause instanceof Error ? cause.message : "Could not check activation requirements.")
        }
      } finally {
        if (!cancelled && current === sequence) setLoading(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [token, requestId, revision, refreshKey, saving])
  const complete = (item: OnboardingReadinessRequirement) => ["complete", "skipped"].includes(item.status)
  const outstanding = readiness?.requirements.filter((item) => item.required && !complete(item)) ?? []
  const optional = readiness?.requirements.filter((item) => !item.required && !complete(item)) ?? []
  const completed = readiness?.requirements.filter(complete) ?? []
  const groups = new Map<string, OnboardingReadinessRequirement[]>()
  for (const requirement of outstanding) {
    const key = `${requirement.owner} · ${requirement.action === "payroll" ? "Payroll & salary" : requirement.group}`
    groups.set(key, [...(groups.get(key) ?? []), requirement])
  }
  const stages = [
    { label: "Registration & review", actions: ["details"] },
    { label: "Checklist & approvals", actions: ["tasks", "approvals"] },
    { label: "Payroll & salary", actions: ["payroll"] },
    { label: "Employment contract", actions: ["contracts"] },
  ]
  const title = readiness?.closed
    ? readiness.request_status === "completed" ? "Onboarding finalized" : "Onboarding closed"
    : readiness?.ready_to_activate ? "Ready for activation" : `${readiness?.blocker_count ?? 0} activation requirements outstanding`
  return (
    <section aria-label={`Activation overview · ${employeeName}`} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Activation overview · {employeeName}</h2><p className="text-sm text-muted-foreground">What is done, what is missing, and who can move things forward.</p></div>
        <Button disabled={loading || saving} onClick={() => setRevision((current) => current + 1)}>Refresh readiness</Button>
      </div>
      {error ? <MessageBar intent="error"><MessageBarBody><strong>Readiness unavailable</strong><p>{error} Activation is disabled until a fresh check succeeds.</p></MessageBarBody></MessageBar> : !readiness ? <Spinner label="Checking activation requirements…" /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Onboarding stages">
          {stages.map((stage) => {
            const items = readiness.requirements.filter((item) => item.required && stage.actions.includes(item.action))
            const remaining = items.filter((item) => !complete(item))
            return <Card key={stage.label}><CardHeader image={remaining.length ? <Clock20Regular /> : <CheckmarkCircle20Regular />} header={<Text weight="semibold">{stage.label}</Text>} description={items.length ? remaining.length ? `${remaining.length} remaining` : "Required checks complete" : "No required checks"} /></Card>
          })}
        </div>
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="order-2 flex min-w-0 flex-col gap-4 xl:order-1">
            {readiness.closed ? <MessageBar intent={readiness.request_status === "completed" ? "success" : "info"}><MessageBarBody><strong>{title}</strong><p>Employee status: {readiness.employee_status?.replaceAll("_", " ")}. The history remains available in Activity.</p><Button onClick={() => onNavigate("details", "employee-profile")}>Open employee profile</Button></MessageBarBody></MessageBar> : <MessageBar intent={readiness.ready_to_activate ? "success" : "info"}><MessageBarBody><strong>{readiness.ready_to_activate ? "All mandatory checks are satisfied" : "Next best action"}</strong><p>{readiness.next_action ? `${readiness.next_action.label} · Responsible: ${readiness.next_action.owner}` : "Authorized HR can review and activate this employee."}</p><p>Work can proceed together unless a workflow dependency says otherwise.</p></MessageBarBody></MessageBar>}
            {!readiness.closed && Array.from(groups, ([group, requirements]) => <Card key={group}>
              <CardHeader header={<Text weight="semibold">{group}</Text>} description={`${requirements.length} outstanding requirement${requirements.length === 1 ? "" : "s"}`} />
              <ul className="flex flex-col gap-4">{requirements.map((requirement) => <li key={requirement.id} className="flex min-w-0 flex-col gap-2 border-t border-border pt-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><p className="min-w-0 basis-full text-sm font-medium sm:basis-0 sm:flex-1">{requirement.label}</p><Badge appearance="tint" color={requirement.status === "blocked" ? "danger" : "warning"}>{requirement.status === "blocked" ? "Needs attention" : "Awaiting action"}</Badge></div>
                <p className="text-sm text-muted-foreground">Responsible: {requirement.owner}</p>
                {requirement.waiting_reason ? <p className="text-sm">Waiting on a prerequisite: {requirement.waiting_reason}</p> : requirement.actionable ? <p className="text-sm">Ready for the assigned owner to act.</p> : null}
                {requirement.due_date ? <p className="text-sm">Due {new Date(requirement.due_date).toLocaleString()}{new Date(requirement.due_date).getTime() < Date.now() ? " · Overdue" : ""}</p> : null}
                <div className="flex flex-wrap gap-2"><Button icon={<ArrowRight20Regular />} onClick={() => onNavigate(requirement.action, requirement.id)} aria-label={`Review ${requirement.label}`}>Review<span className="sr-only"> {requirement.label}</span></Button>{onDiscuss ? <Button appearance="subtle" onClick={() => onDiscuss(requirement.id, requirement.label)}>Notes & handoff</Button> : null}</div>
              </li>)}</ul>
            </Card>)}
            <Button appearance="subtle" aria-expanded={showCompleted} onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Hide completed requirements" : `Show completed requirements (${completed.length})`}</Button>
            {showCompleted ? <Card><ul className="flex flex-col gap-3">{completed.map((item) => <li key={item.id}><Text weight="semibold">✓ {item.label}</Text><p className="text-sm text-muted-foreground">{item.owner} · {item.status === "skipped" ? "Not applicable" : "Complete"}</p></li>)}</ul></Card> : null}
            {optional.length ? <Card><CardHeader header={<Text weight="semibold">Optional work still open</Text>} description="These items do not block activation." />{optional.map((item) => <Button key={item.id} onClick={() => onNavigate(item.action, item.id)}>{item.label} · {item.owner}</Button>)}</Card> : null}
          </div>
          <aside aria-label="Activation readiness" className="order-1 min-w-0 xl:sticky xl:top-4 xl:order-2"><Card>
            <CardHeader header={<Text weight="semibold">{title}</Text>} description={`Employee status: ${readiness.employee_status?.replaceAll("_", " ") || "Not available"}`} />
            <p className="text-sm">{readiness.completed_required} of {readiness.total_required} mandatory requirements currently satisfied.</p>
            <ProgressBar value={readiness.total_required ? readiness.completed_required / readiness.total_required : 0} aria-label="Activation readiness progress" color={readiness.ready_to_activate ? "success" : "brand"} />
            <p className="text-sm text-muted-foreground">Checklist completion alone does not activate the employee. Payroll, contract and other mandatory checks must also pass.</p>
            {canActivate && !readiness.closed ? <Button appearance="primary" disabled={!readiness.ready_to_activate || loading || saving} onClick={() => setConfirming(true)}>Activate employee</Button> : !readiness.closed ? <p className="text-sm">An authorized HR user must activate this employee.</p> : null}
            {!readiness.closed && !readiness.ready_to_activate ? <p className="text-sm">Activation blocked until the remaining requirements are satisfied.</p> : null}
          </Card></aside>
        </div>
      </>}
      <Dialog open={confirming} onOpenChange={(_, data) => setConfirming(data.open)}><DialogSurface><DialogBody>
        <DialogTitle>Review and activate {employeeName}</DialogTitle>
        <DialogContent>Activation finalizes onboarding and applies the configured employee provisioning and probation rules. The server rechecks every mandatory requirement and your permission before proceeding. Optional work may remain open.</DialogContent>
        <DialogActions><Button onClick={() => setConfirming(false)}>Keep reviewing</Button><Button appearance="primary" disabled={saving || loading || !readiness?.ready_to_activate || Boolean(error)} onClick={() => { setConfirming(false); onActivate() }}>Confirm activation</Button></DialogActions>
      </DialogBody></DialogSurface></Dialog>
    </section>
  )
}
