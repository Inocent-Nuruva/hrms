"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOnboardingReadiness, type OnboardingReadiness, type OnboardingReadinessRequirement } from "@/lib/admin-api"

export function OnboardingReadinessOverview({
  token, requestId, employeeName, canActivate, saving, onActivate, onNavigate,
}: {
  token: string
  requestId: number
  employeeName: string
  canActivate: boolean
  saving: boolean
  onActivate: () => void
  onNavigate: (action: OnboardingReadinessRequirement["action"], requirementId: string) => void
}) {
  const [readiness, setReadiness] = React.useState<OnboardingReadiness | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [revision, setRevision] = React.useState(0)
  const [pendingOnly, setPendingOnly] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setReadiness(null)
    setError("")
    getOnboardingReadiness(token, requestId)
      .then((result) => { if (!cancelled) setReadiness(result) })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not check activation requirements.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, requestId, revision])

  const groups = new Map<string, OnboardingReadinessRequirement[]>()
  for (const requirement of readiness?.requirements ?? []) {
    if (pendingOnly && ["complete", "skipped"].includes(requirement.status)) continue
    groups.set(requirement.group, [...(groups.get(requirement.group) ?? []), requirement])
  }
  const activated = readiness?.request_status === "completed"
  const title = activated
    ? "Onboarding finalized"
    : readiness?.closed
      ? "Onboarding closed"
      : readiness?.ready_to_activate
        ? "Ready for activation"
        : `${readiness?.blocker_count ?? 0} activation requirements outstanding`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activation overview · {employeeName}</CardTitle>
        <CardDescription>Checklist progress is not activation readiness. Review the mandatory requirements, responsible teams, and next action here.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={loading || saving} onClick={() => setRevision((current) => current + 1)}>Refresh readiness</Button>
          <Button variant="outline" size="sm" aria-pressed={pendingOnly} onClick={() => setPendingOnly((current) => !current)}>
            {pendingOnly ? "Show all requirements" : "Show outstanding only"}
          </Button>
        </div>
        {loading ? <p role="status">Checking activation requirements…</p> : error ? (
          <Alert variant="destructive"><AlertTitle>Readiness unavailable</AlertTitle><AlertDescription>{error} Activation readiness has not been confirmed. Retry the check.</AlertDescription></Alert>
        ) : readiness ? (
          <>
            <Alert>
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>
                <p>Employee status: {readiness.employee_status.replaceAll("_", " ")}. {readiness.completed_required} of {readiness.total_required} mandatory requirements currently satisfied.</p>
                {!readiness.closed && readiness.next_action ? <p>Next: {readiness.next_action.label} · Responsible: {readiness.next_action.owner}</p> : null}
                {readiness.ready_to_activate ? <p>Final activation rechecks requirements and provisions the employee. {canActivate ? "You can activate this employee below." : "An authorized HR user must activate this employee."}</p> : null}
              </AlertDescription>
            </Alert>
            {canActivate && !readiness.closed ? (
              <Button disabled={!readiness.ready_to_activate || saving} onClick={onActivate}>Activate employee</Button>
            ) : null}
            {Array.from(groups, ([group, requirements]) => (
              <section key={group} aria-label={group} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{group}</h3>
                {requirements.map((requirement) => (
                  <div key={requirement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                      <p className="text-sm font-medium">{requirement.label}</p>
                      <p className="text-xs text-muted-foreground">Responsible: {requirement.owner}</p>
                    </div>
                    <Badge variant="outline">{requirement.required ? "Required" : "Optional"}</Badge>
                    <Badge variant={requirement.status === "blocked" ? "destructive" : "secondary"}>{requirement.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => onNavigate(requirement.action, requirement.id)}>Review<span className="sr-only"> {requirement.label}</span></Button>
                  </div>
                ))}
              </section>
            ))}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
