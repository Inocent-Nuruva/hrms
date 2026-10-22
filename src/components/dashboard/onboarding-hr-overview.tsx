"use client"

import * as React from "react"
import { Badge as FluentBadge, Button as FluentButton, CounterBadge, DrawerBody, DrawerFooter, DrawerHeader, DrawerHeaderTitle, OverlayDrawer, Tooltip } from "@fluentui/react-components"
import { ArrowClockwise20Regular, Dismiss20Regular, Filter20Regular, Info20Regular } from "@fluentui/react-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"
import { getOnboardingOverview, type OnboardingOverviewRow } from "@/lib/admin-api"
import { emptyOnboardingOverviewFilters, filterOnboardingOverview, groupOnboardingOverview, type OnboardingOverviewFilters } from "@/lib/onboarding-overview"

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
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [pagination, setPagination] = React.useState({ filterKey: "", page: 1 })
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
  const filterKey = JSON.stringify(filters)
  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const page = Math.min(pagination.filterKey === filterKey ? pagination.page : 1, pageCount)
  const groups = groupOnboardingOverview(visible)
  const groupCounts = new Map(groups.map(([stage, requests]) => [stage, requests.length]))
  const pageRows = groups.flatMap(([, requests]) => requests).slice((page - 1) * pageSize, page * pageSize)
  const choices = (values: string[], label: string) => [
    { value: "", label },
    ...[...new Set(values)].sort().map((value) => ({ value, label: value })),
  ]
  const filterFields: { key: Exclude<keyof OnboardingOverviewFilters, "search">; label: string; options: { value: string; label: string }[] }[] = [
    { key: "stage", label: "Stage", options: choices(rows.map((row) => row.stage), "All stages") },
    { key: "department", label: "Department", options: choices(rows.map((row) => row.department), "All departments") },
    { key: "owner", label: "Responsible owner", options: choices(rows.flatMap((row) => row.owners), "All responsible owners") },
    { key: "blocker", label: "Blocker type", options: choices(rows.flatMap((row) => row.blockers.map((item) => item.group)), "All blocker types") },
    { key: "overdue", label: "Overdue", options: [{ value: "", label: "Any due date" }, { value: "overdue", label: "Overdue only" }, { value: "not_overdue", label: "Not overdue" }] },
    { key: "attention", label: "Needs attention", options: [{ value: "", label: "All attention levels" }, { value: "any", label: "Needs attention" }, ...choices(rows.flatMap((row) => row.attention_reasons ?? []), "").slice(1)] },
  ]
  const activeFilters = filterFields.filter((field) => Boolean(filters[field.key]))
  const hasFilters = Boolean(filters.search) || activeFilters.length > 0
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Onboarding readiness</CardTitle>
          <Tooltip relationship="description" content="Open requests are grouped by their first mandatory blocker. Invitations and registration have separate tabs; completed requests remain in All requests.">
            <FluentButton appearance="subtle" size="small" icon={<Info20Regular />} aria-label="About onboarding readiness" />
          </Tooltip>
        </div>
        <CardDescription>See what’s blocking employee activation.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">
        <div role="search" aria-label="Filter onboarding overview" className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1"><Input aria-label="Search onboarding overview" placeholder="Search employee or request…" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
          <FluentButton icon={<Filter20Regular />} aria-label="Filters" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            Filters {activeFilters.length ? <CounterBadge size="small" aria-label={`${activeFilters.length} active filters`}>{activeFilters.length}</CounterBadge> : null}
          </FluentButton>
          <Tooltip relationship="label" content="Refresh overview"><FluentButton icon={<ArrowClockwise20Regular />} aria-label="Refresh overview" disabled={loading} onClick={() => setRevision((value) => value + 1)} /></Tooltip>
        </div>
        {hasFilters ? <div className="flex flex-wrap items-center gap-2" aria-label="Active onboarding filters">
          {activeFilters.map((field) => {
            const value = field.options.find((option) => option.value === filters[field.key])?.label ?? filters[field.key]
            return <FluentButton key={field.key} size="small" icon={<Dismiss20Regular />} iconPosition="after" aria-label={`Remove ${field.label} filter: ${value}`} onClick={() => setFilters((current) => ({ ...current, [field.key]: "" }))}><span className="max-w-56 truncate" title={`${field.label}: ${value}`}>{field.label}: {value}</span></FluentButton>
          })}
          <FluentButton appearance="subtle" size="small" aria-label="Clear filters" onClick={() => setFilters(emptyOnboardingOverviewFilters)}>Clear</FluentButton>
        </div> : null}
        <OverlayDrawer open={filtersOpen} onOpenChange={(_, data) => setFiltersOpen(data.open)} position="end" size="medium" style={{ width: "min(560px, 100vw)" }}>
          <DrawerHeader><DrawerHeaderTitle action={<FluentButton appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}>Filter onboarding</DrawerHeaderTitle></DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Filters apply immediately. Close this panel to review matching employees.</p>
            <div className="grid gap-4 min-[480px]:grid-cols-2">
              {filterFields.map((field) => <FluentSelect key={field.key} label={field.label} value={filters[field.key] ?? ""} options={field.options} onChange={(value) => setFilters((current) => ({ ...current, [field.key]: value }))} />)}
            </div>
            {!loading && !error ? <p role="status" className="text-sm">{visible.length} of {rows.length} requests match</p> : null}
          </DrawerBody>
          <DrawerFooter><FluentButton appearance="primary" onClick={() => setFiltersOpen(false)}>Show results</FluentButton>{hasFilters ? <FluentButton onClick={() => setFilters(emptyOnboardingOverviewFilters)}>Clear filters</FluentButton> : null}</DrawerFooter>
        </OverlayDrawer>
        {loading ? <p role="status">Checking all open requests…</p> : error ? (
          <Alert variant="destructive"><AlertTitle>Overview unavailable</AlertTitle><AlertDescription>{error} No readiness counts are shown until the complete overview loads. Refresh to retry.</AlertDescription></Alert>
        ) : (
          <>
            <p role="status">{visible.length} of {rows.length} open requests · {rows.filter((row) => row.readiness.ready_to_activate).length} ready for activation · {rows.filter((row) => row.overdue).length} overdue</p>
            {visible.length === 0 ? <p>No open requests match these filters.</p> : null}
            {groupOnboardingOverview(pageRows).map(([stage, requests]) => (
              <section key={stage} aria-label={stage} className="flex flex-col gap-2">
                <h3 className="font-semibold">{stage} ({groupCounts.get(stage)})</h3>
                <ul className="flex flex-col gap-2" aria-label={`${stage} employees`}>
                  {requests.map((row) => {
                    const nextAction = row.readiness.next_action ?? row.blockers[0]
                    return (
                      <li key={row.id} className="min-w-0 rounded-md border border-border border-l-2 border-l-primary/40 bg-muted/20 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium" title={row.employee_name || row.employee_no}>{row.employee_name || row.employee_no}</p>
                            <p className="truncate text-xs text-muted-foreground" title={`${row.employee_no} · ${row.department} · ${row.onboarding_no}`}>{row.employee_no} · {row.department}</p>
                          </div>
                          <FluentButton size="small" appearance="subtle" aria-label={`Review onboarding for ${row.employee_name || row.employee_no}`} onClick={() => onOpen(row.id)}>Review</FluentButton>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <FluentBadge appearance="tint" color={row.readiness.ready_to_activate ? "success" : "informative"}>{row.readiness.completed_required}/{row.readiness.total_required} checks</FluentBadge>
                          {row.overdue ? <FluentBadge appearance="tint" color="warning">Overdue</FluentBadge> : null}
                          {row.attention_reasons?.length ? <Tooltip relationship="description" content={row.attention_reasons.join(" · ")}><FluentBadge appearance="outline" color="warning" tabIndex={0}>Needs attention</FluentBadge></Tooltip> : null}
                          <p className="min-w-0 flex-1 basis-48 truncate text-xs text-muted-foreground" title={nextAction ? `Next: ${nextAction.label} · Responsible: ${nextAction.owner}` : "Ready for authorized HR to review and activate"}>
                            {nextAction ? `Next: ${nextAction.label} · Responsible: ${nextAction.owner}` : "Ready for HR activation"}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            {visible.length > pageSize ? <nav aria-label="Onboarding results pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p role="status" className="text-xs text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visible.length)} of {visible.length} · Page {page} of {pageCount}</p>
              <div className="flex gap-2">
                <FluentButton size="small" disabled={page === 1} onClick={() => setPagination({ filterKey, page: page - 1 })}>Previous page</FluentButton>
                <FluentButton size="small" disabled={page === pageCount} onClick={() => setPagination({ filterKey, page: page + 1 })}>Next page</FluentButton>
              </div>
            </nav> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
