"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Badge, Button, Card, CardHeader, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody, ProgressBar, Spinner, Text, Tooltip } from "@fluentui/react-components"
import { ArrowClockwise20Regular, CheckmarkCircle20Regular, Clock20Regular, ArrowRight20Regular, Info20Regular } from "@fluentui/react-icons"
import { getOnboardingReadiness, type OnboardingReadiness, type OnboardingReadinessRequirement } from "@/lib/admin-api"

function requirementGuidance(requirement: OnboardingReadinessRequirement) {
  if (requirement.id === "bank account") return "Open payroll setup, review the employee bank details, select the verified account, and save the payroll profile."
  if (requirement.id === "independently approved starting salary") return "Open Salary approvals. The assigned approver—not the person who submitted the salary—must review and approve it."
  if (requirement.id === "signed employment contract") return "HR must issue and attach the contract PDF. The employee must then sign it from their onboarding dashboard."
  return requirement.actionable ? "Ready for the assigned owner to act." : "Open the relevant workspace to complete this requirement."
}

function requirementActionLabel(requirement: OnboardingReadinessRequirement) {
  if (requirement.id === "bank account") return "Open payroll setup"
  if (requirement.id === "independently approved starting salary") return "Open salary approvals"
  if (requirement.id === "signed employment contract") return "Manage contract"
  return "Open requirement"
}

export function OnboardingReadinessOverview({ token, requestId, employeeName, canActivate, canViewPayroll = false, canViewContracts = false, saving, onActivate, onNavigate, refreshKey, onDiscuss, summaryTargetId }: {
  token: string
  requestId: number
  employeeName: string
  canActivate: boolean
  canViewPayroll?: boolean
  canViewContracts?: boolean
  saving: boolean
  onActivate: () => void
  onNavigate: (action: OnboardingReadinessRequirement["action"], requirementId: string) => void
  refreshKey?: string | number
  onDiscuss?: (requirementId: string, label: string) => void
  summaryTargetId?: string
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
  const visibleRequirements = readiness?.requirements.filter((item) => {
    if (item.action === "payroll") return canViewPayroll
    if (item.action === "contracts") return canViewContracts
    return true
  }) ?? []
  const outstanding = visibleRequirements.filter((item) => item.required && !complete(item))
  const optional = visibleRequirements.filter((item) => !item.required && !complete(item))
  const completed = visibleRequirements.filter(complete)
  const visibleRequired = visibleRequirements.filter((item) => item.required)
  const visibleCompletedRequired = visibleRequired.filter(complete).length
  const groups = new Map<string, OnboardingReadinessRequirement[]>()
  for (const requirement of outstanding) {
    const key = `${requirement.owner} · ${requirement.action === "payroll" ? "Payroll & salary" : requirement.group}`
    groups.set(key, [...(groups.get(key) ?? []), requirement])
  }
  const stages = [
    { label: "Registration & review", actions: ["details"] },
    { label: "Checklist & approvals", actions: ["tasks", "approvals"] },
    ...(canViewPayroll ? [{ label: "Payroll & salary", actions: ["payroll"] }] : []),
    ...(canViewContracts ? [{ label: "Employment contract", actions: ["contracts"] }] : []),
  ]
  const title = readiness?.closed
    ? readiness.request_status === "completed" ? "Onboarding finalized" : "Onboarding closed"
    : outstanding.length === 0 ? "Visible requirements complete" : `${outstanding.length} activation requirements outstanding`
  const summary = readiness ? <div aria-label="Activation readiness" className="flex min-w-0 flex-col gap-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{visibleCompletedRequired}/{visibleRequired.length} visible checks complete · {readiness.employee_status?.replaceAll("_", " ")}</p></div>
      <Tooltip relationship="description" content="All mandatory checks must pass. Authorized HR workflow actions can activate automatically; when payroll or contracts finishes last, refresh and activate manually."><Button appearance="subtle" size="small" icon={<Info20Regular />} aria-label="About employee activation" /></Tooltip>
    </div>
    <ProgressBar value={visibleRequired.length ? visibleCompletedRequired / visibleRequired.length : 1} aria-label="Visible activation readiness progress" color={outstanding.length === 0 ? "success" : "brand"} />
    {canActivate && !readiness.closed && readiness.ready_to_activate ? <Button appearance="primary" size="small" disabled={loading || saving} onClick={() => setConfirming(true)}>Activate employee</Button> : null}
  </div> : null
  const summaryTarget = summaryTargetId && typeof document !== "undefined" ? document.getElementById(summaryTargetId) : null
  return (
    <section aria-label={`Activation overview · ${employeeName}`} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Activation overview · {employeeName}</h2>
        <Tooltip relationship="label" content="Refresh readiness">
          <Button
            appearance="subtle"
            aria-label="Refresh readiness"
            icon={<ArrowClockwise20Regular />}
            disabled={loading || saving}
            onClick={() => setRevision((current) => current + 1)}
          />
        </Tooltip>
      </div>
      {error ? <MessageBar intent="error"><MessageBarBody><strong>Readiness unavailable</strong><p>{error} Activation is disabled until a fresh check succeeds.</p></MessageBarBody></MessageBar> : !readiness ? <Spinner label="Checking activation requirements…" /> : <>
        <div className="grid overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border/70" aria-label="Onboarding stages">
          {stages.map((stage) => {
            const items = visibleRequirements.filter((item) => item.required && stage.actions.includes(item.action))
            const remaining = items.filter((item) => !complete(item))
            const stageComplete = items.length > 0 && remaining.length === 0
            const stageStatus = !items.length ? "No checks" : stageComplete ? "Complete" : `${remaining.length} left`
            return <div
              key={stage.label}
              className="group flex min-w-0 items-center gap-3 border-b border-border/70 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0"
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${stageComplete ? "bg-emerald-50 text-emerald-700" : remaining.length ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`} aria-hidden="true">
                {stageComplete ? <CheckmarkCircle20Regular /> : <Clock20Regular />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-5">{stage.label}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={`text-xs font-medium ${stageComplete ? "text-emerald-700" : remaining.length ? "text-amber-700" : "text-muted-foreground"}`}>{stageStatus}</span>
                  {items.length ? <span className="text-xs text-muted-foreground">{items.length - remaining.length}/{items.length}</span> : null}
                </div>
              </div>
              <span className={`size-1.5 shrink-0 rounded-full ${stageComplete ? "bg-emerald-500" : remaining.length ? "bg-amber-500" : "bg-muted-foreground/40"}`} aria-hidden="true" />
            </div>
          })}
        </div>
        {summaryTarget ? createPortal(summary, summaryTarget) : summary}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-4">
            {readiness.closed ? <MessageBar intent={readiness.request_status === "completed" ? "success" : "info"}><MessageBarBody><strong>{title}</strong><p>Employee status: {readiness.employee_status?.replaceAll("_", " ")}.</p><Button onClick={() => onNavigate("details", "employee-profile")}>Open employee profile</Button></MessageBarBody></MessageBar> : <MessageBar intent={outstanding.length === 0 ? "success" : "info"}><MessageBarBody><strong>{outstanding.length === 0 ? "All visible checks are satisfied" : "Next best action"}</strong><p>{outstanding[0] ? `${outstanding[0].label} · Responsible: ${outstanding[0].owner}` : canViewPayroll ? "Authorized HR can review and activate this employee." : "Additional restricted checks may remain for payroll or other authorized teams."}</p></MessageBarBody></MessageBar>}
            {!readiness.closed ? <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{Array.from(groups, ([group, requirements]) => <section key={group} className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-background via-background to-muted/45 shadow-sm">
              <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-3">
                <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{group}</h3><p className="text-xs text-muted-foreground">{requirements.length} outstanding</p></div>
                <span className="size-2.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]" aria-hidden="true" />
              </header>
              <ul className="divide-y divide-border/70">{requirements.map((requirement) => <li key={requirement.id} className="min-w-0 px-4 py-3">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold leading-5">{requirement.label}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">Responsible: {requirement.owner}{requirement.due_date ? ` · Due ${new Date(requirement.due_date).toLocaleDateString()}` : ""}</p></div><Badge appearance="tint" color={requirement.status === "blocked" ? "danger" : "warning"}>{requirement.status === "blocked" ? "Needs attention" : "Awaiting"}</Badge></div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5"><Button appearance="primary" size="small" icon={<ArrowRight20Regular />} onClick={() => onNavigate(requirement.action, requirement.id)} aria-label={`${requirementActionLabel(requirement)} for ${requirement.label}`}>{requirementActionLabel(requirement)}</Button><Tooltip relationship="description" content={requirement.waiting_reason ? `Waiting on a prerequisite: ${requirement.waiting_reason}` : requirementGuidance(requirement)}><Button appearance="subtle" size="small" icon={<Info20Regular />} aria-label={`More information about ${requirement.label}`}>Details</Button></Tooltip>{onDiscuss ? <Button appearance="subtle" size="small" onClick={() => onDiscuss(requirement.id, requirement.label)}>Handoff</Button> : null}</div>
              </li>)}</ul>
            </section>)}</div> : null}
            <Button appearance="subtle" aria-expanded={showCompleted} onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? "Hide completed requirements" : `Show completed requirements (${completed.length})`}</Button>
            {showCompleted ? <Card><ul className="flex flex-col gap-3">{completed.map((item) => <li key={item.id}><Text weight="semibold">✓ {item.label}</Text><p className="text-sm text-muted-foreground">{item.owner} · {item.status === "skipped" ? "Not applicable" : "Complete"}</p></li>)}</ul></Card> : null}
            {optional.length ? <Card><CardHeader header={<Text weight="semibold">Optional work still open</Text>} description="These items do not block activation." />{optional.map((item) => <Button key={item.id} onClick={() => onNavigate(item.action, item.id)}>{item.label} · {item.owner}</Button>)}</Card> : null}
          </div>
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
