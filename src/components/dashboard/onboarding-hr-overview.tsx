"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"
import { getOnboardingOverview, type OnboardingOverviewRow } from "@/lib/admin-api"
import { emptyOnboardingOverviewFilters, filterOnboardingOverview, groupOnboardingOverview } from "@/lib/onboarding-overview"

export function OnboardingHrOverview({ token, detailsOpen, onOpen }: {
  token: string
  detailsOpen: boolean
  onOpen: (requestId: number) => void
}) {
  const [rows, setRows] = React.useState<OnboardingOverviewRow[]>([])
  const [filters, setFilters] = React.useState(emptyOnboardingOverviewFilters)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    if (detailsOpen) return
    let cancelled = false
    setLoading(true)
    setRows([])
    setError("")
    async function load() {
      const collected = new Map<number, OnboardingOverviewRow>()
      let after = 0
      while (!cancelled) {
        const result = await getOnboardingOverview(token, after)
        for (const row of result.data) collected.set(row.id, row)
        if (result.next_cursor === null) break
        if (result.next_cursor <= after) throw new Error("Overview pagination did not advance. Please refresh.")
        after = result.next_cursor
      }
      if (!cancelled) setRows([...collected.values()])
    }
    void load().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load onboarding readiness.")
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, detailsOpen, revision])

  const visible = filterOnboardingOverview(rows, filters)
  const choices = (values: string[], label: string) => [
    { value: "", label },
    ...[...new Set(values)].sort().map((value) => ({ value, label: value })),
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding readiness</CardTitle>
        <CardDescription>Open onboarding requests grouped by the first outstanding mandatory stage. Other blockers remain visible. Invitations and registration are in their own tabs; completed requests remain in All requests.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh overview</Button>
          <Button variant="ghost" size="sm" onClick={() => setFilters(emptyOnboardingOverviewFilters)}>Clear filters</Button>
        </div>
        <div role="search" aria-label="Filter onboarding overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input aria-label="Search onboarding overview" placeholder="Search employee, request or blocker" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          <FluentSelect ariaLabel="Stage" value={filters.stage} options={choices(rows.map((row) => row.stage), "All stages")} onChange={(stage) => setFilters((current) => ({ ...current, stage }))} />
          <FluentSelect ariaLabel="Department" value={filters.department} options={choices(rows.map((row) => row.department), "All departments")} onChange={(department) => setFilters((current) => ({ ...current, department }))} />
          <FluentSelect ariaLabel="Responsible owner" value={filters.owner} options={choices(rows.flatMap((row) => row.owners), "All responsible owners")} onChange={(owner) => setFilters((current) => ({ ...current, owner }))} />
          <FluentSelect ariaLabel="Blocker type" value={filters.blocker} options={choices(rows.flatMap((row) => row.blockers.map((item) => item.group)), "All blocker types")} onChange={(blocker) => setFilters((current) => ({ ...current, blocker }))} />
          <FluentSelect ariaLabel="Overdue" value={filters.overdue} options={[{ value: "", label: "Any due date" }, { value: "overdue", label: "Overdue only" }, { value: "not_overdue", label: "Not overdue" }]} onChange={(overdue) => setFilters((current) => ({ ...current, overdue }))} />
        </div>
        {loading ? <p role="status">Checking all open requests…</p> : error ? (
          <Alert variant="destructive"><AlertTitle>Overview unavailable</AlertTitle><AlertDescription>{error} No readiness counts are shown until the complete overview loads. Refresh to retry.</AlertDescription></Alert>
        ) : (
          <>
            <p role="status">{visible.length} of {rows.length} open requests · {rows.filter((row) => row.readiness.ready_to_activate).length} ready for activation · {rows.filter((row) => row.overdue).length} overdue</p>
            {visible.length === 0 ? <p>No open requests match these filters.</p> : null}
            {groupOnboardingOverview(visible).map(([stage, requests]) => (
              <section key={stage} aria-label={stage} className="flex flex-col gap-3">
                <h3 className="font-semibold">{stage} ({requests.length})</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {requests.map((row) => (
                    <Card key={row.id}>
                      <CardHeader>
                        <CardTitle>{row.employee_name || row.employee_no}</CardTitle>
                        <CardDescription>{row.employee_no} · {row.department} · {row.onboarding_no}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{row.readiness.completed_required}/{row.readiness.total_required} required checks</Badge>
                          {row.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                        </div>
                        <p className="text-sm">Responsible: {row.owners.join(", ") || "Authorized HR — activation"}</p>
                        {row.planned_completion_date ? <p className="text-sm">Target completion: {row.planned_completion_date}</p> : null}
                        {row.blockers.length ? (
                          <ul className="flex list-inside list-disc flex-col gap-1 text-sm">
                            {row.blockers.slice(0, 3).map((item) => <li key={item.id}>{item.label} · {item.owner}</li>)}
                            {row.blockers.length > 3 ? <li>{row.blockers.length - 3} more requirements in details</li> : null}
                          </ul>
                        ) : <p className="text-sm">Ready for authorized HR to review and activate. Activation rechecks all requirements.</p>}
                        <Button variant="outline" onClick={() => onOpen(row.id)}>Review onboarding<span className="sr-only"> for {row.employee_name}</span></Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
