"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Avatar, Badge, Button, Card, CardHeader, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody, ProgressBar, Spinner, Text, Tooltip } from "@fluentui/react-components"
import { ArrowClockwise20Regular, CheckmarkCircle20Regular, Clock20Regular, ArrowRight20Regular, Info20Regular } from "@fluentui/react-icons"
import { extractProfilePhotoUrl, getOnboardingReadiness, type AdminRecord, type OnboardingReadiness, type OnboardingReadinessRequirement } from "@/lib/admin-api"
import { personDisplayName } from "@/lib/onboarding-activity-labels"

function requirementGuidance(requirement: OnboardingReadinessRequirement) {
  if (requirement.id === "bank account") return "Open payroll setup, review the employee bank details, select the verified account, and save the payroll profile."
  if (requirement.id === "independently approved starting salary") return "Open Salary approvals. The assigned approver—not the person who submitted the salary—must review and approve it."
  if (requirement.id === "signed employment contract") return "HR must issue and attach the contract PDF. The employee must then sign it from their onboarding dashboard."
  return requirement.actionable ? "Ready for the assigned owner to act." : "Open the relevant workspace to complete this requirement."
}

export function requirementActionLabel(requirement: OnboardingReadinessRequirement) {
  if (requirement.id === "bank account") return "Open payroll setup"
  if (requirement.id === "independently approved starting salary") return "Open salary approvals"
  if (requirement.id === "signed employment contract") return "Manage contract"
  if (requirement.action === "details") return "Open employee details"
  if (requirement.action === "tasks") return "Open tasks"
  if (requirement.action === "approvals") return "Open approvals"
  if (requirement.action === "payroll") return "Open payroll"
  return "Open contracts"
}

export function OnboardingReadinessOverview({ token, requestId, employeeName, ownerDirectory = [], canActivate, canViewPayroll = false, canViewContracts = false, saving, onActivate, onNavigate, refreshKey, onDiscuss, summaryTargetId }: {
  token: string
  requestId: number
  employeeName: string
  ownerDirectory?: AdminRecord[]
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
  const ownerPhotos = new Map<string, string | null>()
  for (const user of ownerDirectory) {
    const name = personDisplayName(user).trim().toLocaleLowerCase()
    if (!name) continue
    ownerPhotos.set(name, ownerPhotos.has(name) ? null : extractProfilePhotoUrl(user))
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
    <section aria-label={`Activation overview · ${employeeName}`} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Onboarding progress</h2><p className="text-sm text-muted-foreground">Review the remaining steps to activate this employee.</p></div>
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
        {summaryTarget ? createPortal(summary, summaryTarget) : summary}
        <div className="grid overflow-hidden rounded-xl border border-border/80 bg-background sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border/70" aria-label="Onboarding stages">
          {stages.map((stage) => {
            const items = visibleRequirements.filter((item) => item.required && stage.actions.includes(item.action))
            const remaining = items.filter((item) => !complete(item))
            const stageComplete = items.length > 0 && remaining.length === 0
            const stageStatus = !items.length ? "No checks" : stageComplete ? "Complete" : `${remaining.length} left`
            return <div
              key={stage.label}
              className="flex min-w-0 items-center gap-2.5 border-b border-border/70 px-3 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0"
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
            </div>
          })}
        </div>
        {readiness.activation_failure && !readiness.closed ? <MessageBar intent="error"><MessageBarBody><strong>Activation failed</strong><p>The last activation attempt{readiness.activation_failure.failed_at ? ` on ${new Date(readiness.activation_failure.failed_at).toLocaleString()}` : ""} was rolled back: {readiness.activation_failure.message}</p><p>Nothing was applied. Fix the cause, then activate again.</p></MessageBarBody></MessageBar> : null}
        {summaryTarget ? createPortal(summary, summaryTarget) : summary}

        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-4">
            {readiness.closed ? <MessageBar intent={readiness.request_status === "completed" ? "success" : "info"}><MessageBarBody><strong>{title}</strong><p>Employee status: {readiness.employee_status?.replaceAll("_", " ")}.</p><Button onClick={() => onNavigate("details", "employee-profile")}>Open employee profile</Button></MessageBarBody></MessageBar> : null}
            {!readiness.closed ? <section className="min-w-0 rounded-xl border border-border/80 bg-background">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-3 py-2">
                <h3 className="text-sm font-semibold">Next steps</h3><p className="text-xs text-muted-foreground">{outstanding.length ? `${outstanding.length} required action${outstanding.length === 1 ? "" : "s"} remaining` : "All required actions complete"}</p>
              </header>
              <div className="max-w-full overflow-x-auto rounded-b-xl">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                  <caption className="sr-only">All required onboarding steps and their responsible owners</caption>
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>
                    <th scope="col" className="w-[37%] px-3 py-2 font-semibold">Requirement</th>
                    <th scope="col" className="w-[21%] px-2 py-2 font-semibold">Responsible</th>
                    <th scope="col" className="w-[12%] px-2 py-2 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border/70">{outstanding.map((requirement) => <tr key={requirement.id} className="hover:bg-muted/20">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal"><span className="font-medium">{requirement.label}</span>{requirement.due_date ? <span className="block text-xs text-muted-foreground">Due {new Date(requirement.due_date).toLocaleDateString()}</span> : null}</th>
                    <td className="px-2 py-1.5"><div className="flex items-center gap-2"><Avatar size={24} name={requirement.owner} image={ownerPhotos.get(requirement.owner.trim().toLocaleLowerCase()) ? { src: ownerPhotos.get(requirement.owner.trim().toLocaleLowerCase())! } : undefined} /><span className="min-w-0 truncate" title={requirement.owner}>{requirement.owner}</span></div></td>
                    <td className="px-2 py-1.5"><Badge appearance="tint" color={requirement.status === "blocked" ? "danger" : "warning"} size="small">{requirement.status === "blocked" ? "Needs attention" : "Awaiting"}</Badge></td>
                    <td className="px-3 py-1.5"><div className="flex items-center justify-end gap-0.5 whitespace-nowrap"><Button appearance="primary" size="small" icon={<ArrowRight20Regular />} onClick={() => onNavigate(requirement.action, requirement.id)} aria-label={`${requirementActionLabel(requirement)} for ${requirement.label}`}>{requirementActionLabel(requirement)}</Button><Tooltip relationship="description" content={requirement.waiting_reason ? `Waiting on a prerequisite: ${requirement.waiting_reason}` : requirementGuidance(requirement)}><Button appearance="subtle" size="small" icon={<Info20Regular />} aria-label={`More information about ${requirement.label}`} /></Tooltip>{onDiscuss ? <Button appearance="subtle" size="small" onClick={() => onDiscuss(requirement.id, requirement.label)}>Handoff</Button> : null}</div></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section> : null}
            {completed.length ? <section aria-label="Completed onboarding steps" className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
              <h3 className="text-sm font-semibold">Completed <span className="font-normal text-muted-foreground">({completed.length})</span></h3>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{completed.map((item) => <li key={item.id} className="flex min-w-0 items-start gap-2 text-sm"><CheckmarkCircle20Regular className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /><span className="min-w-0"><span className="block font-medium">{item.label}</span><span className="text-xs text-muted-foreground">{item.owner} · {item.status === "skipped" ? "Not applicable" : "Complete"}</span></span></li>)}</ul>
            </section> : null}
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
