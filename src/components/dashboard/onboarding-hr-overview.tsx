"use client"

import * as React from "react"
import { Badge as FluentBadge, Button as FluentButton, CounterBadge, DrawerBody, DrawerFooter, DrawerHeader, DrawerHeaderTitle, OverlayDrawer, ProgressBar, Spinner, Tooltip } from "@fluentui/react-components"
import { ArrowClockwise20Regular, ArrowLeft20Regular, ArrowRight20Regular, Dismiss20Regular, DismissCircle20Regular, DocumentArrowDown20Regular, Filter20Regular, Info20Regular, Person20Regular, Scan20Regular, Wrench20Regular } from "@fluentui/react-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"
import { completeOnboardingRequest, extractProfilePhotoUrl, getEmployeeById, getOnboardingOverview, type OnboardingOverviewRow } from "@/lib/admin-api"
import { emptyOnboardingOverviewFilters, filterOnboardingOverview, groupOnboardingOverview, sortOnboardingOverview, type OnboardingOverviewFilters } from "@/lib/onboarding-overview"

export function OnboardingHrOverview({ token, detailsOpen, onOpen }: {
  token: string
  detailsOpen: boolean
  onOpen: (requestId: number, requirement?: OnboardingOverviewRow["readiness"]["requirements"][number]) => void
}) {
  const [rows, setRows] = React.useState<OnboardingOverviewRow[]>([])
  const [employeePhotos, setEmployeePhotos] = React.useState<Record<number, string>>({})
  const [filters, setFilters] = React.useState(emptyOnboardingOverviewFilters)
  const [order, setOrder] = React.useState<"newest" | "oldest">("newest")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [revision, setRevision] = React.useState(0)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [pagination, setPagination] = React.useState({ filterKey: "", page: 1 })
  const [scanRow, setScanRow] = React.useState<OnboardingOverviewRow | null>(null)
  const [scanStep, setScanStep] = React.useState(0)
  const [scanning, setScanning] = React.useState(false)
  const [selectedScanIssue, setSelectedScanIssue] = React.useState<OnboardingOverviewRow["readiness"]["requirements"][number] | null>(null)
  const [refreshingScan, setRefreshingScan] = React.useState(false)
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
      const activationResults = await Promise.allSettled(
        [...collected.values()]
          .filter((row) => row.readiness.ready_to_activate)
          .map((row) => completeOnboardingRequest(token, row.id)),
      )
      if (activationResults.some((result) => result.status === "fulfilled")) {
        collected.clear()
        after = 0
        while (!cancelled) {
          const result = await getOnboardingOverview(token, after)
          for (const row of result.data) collected.set(row.id, row)
          if (result.next_cursor === null) break
          if (result.next_cursor <= after) throw new Error("Overview pagination did not advance. Please refresh.")
          after = result.next_cursor
        }
      }
      if (!cancelled) setRows([...collected.values()])
      const photoEntries = await Promise.all(
        [...collected.values()].map(async (row) => {
          try {
            const employee = await getEmployeeById(row.employee_id, token)
            return [row.employee_id, extractProfilePhotoUrl(employee)] as const
          } catch {
            return [row.employee_id, null] as const
          }
        }),
      )
      if (!cancelled) {
        setEmployeePhotos(Object.fromEntries(photoEntries.filter((entry): entry is readonly [number, string] => Boolean(entry[1]))))
      }
    }
    void load().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load onboarding readiness.")
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, detailsOpen, revision])

  const visible = sortOnboardingOverview(filterOnboardingOverview(rows, filters), order)
  const filterKey = JSON.stringify([filters, order])
  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const page = Math.min(pagination.filterKey === filterKey ? pagination.page : 1, pageCount)
  const groups = groupOnboardingOverview(visible)
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
  const scanChecks = scanRow?.readiness.requirements ?? []
  const pendingScanChecks = scanChecks.filter((item) => item.required && item.status !== "complete" && item.status !== "skipped")

  React.useEffect(() => {
    if (!scanning || scanChecks.length === 0) return
    const timer = window.setTimeout(() => {
      if (scanStep >= scanChecks.length - 1) {
        setScanning(false)
        return
      }
      setScanStep((value) => value + 1)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [scanChecks.length, scanStep, scanning])

  async function fetchFreshRow(requestId: number) {
    let after = 0
    while (true) {
      const result = await getOnboardingOverview(token, after)
      const refreshed = result.data.find((row) => row.id === requestId)
      if (refreshed) {
        if (refreshed.readiness.ready_to_activate) {
          await completeOnboardingRequest(token, refreshed.id)
          return null
        }
        return refreshed
      }
      if (result.next_cursor === null || result.next_cursor <= after) return null
      after = result.next_cursor
    }
  }

  async function startScan(row: OnboardingOverviewRow) {
    setScanRow({ ...row, readiness: { ...row.readiness, requirements: [] } })
    setScanStep(0)
    setSelectedScanIssue(null)
    setScanning(true)
    try {
      const refreshed = await fetchFreshRow(row.id)
      if (!refreshed) {
        setScanRow(null)
        setScanning(false)
        setRevision((value) => value + 1)
        return
      }
      const current = refreshed ?? row
      setScanRow(current)
      setRows((rows) => rows.map((item) => item.id === current.id ? current : item))
      setScanStep(0)
      setScanning(current.readiness.requirements.length > 0)
    } catch (cause) {
      setScanRow(row)
      setScanning(false)
      setError(cause instanceof Error ? cause.message : "Could not refresh onboarding readiness.")
    }
  }

  async function returnToScanIssues() {
    if (!scanRow) return
    setRefreshingScan(true)
    try {
      const refreshed = await fetchFreshRow(scanRow.id)
      if (refreshed) {
        setScanRow(refreshed)
        setRows((current) => current.map((row) => row.id === refreshed.id ? refreshed : row))
      } else {
        setScanRow(null)
        setRevision((value) => value + 1)
      }
      setSelectedScanIssue(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh onboarding readiness.")
    } finally {
      setRefreshingScan(false)
    }
  }

  function exportScan() {
    if (!scanRow) return
    const escape = (value: string | number | boolean | null | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`
    const lines = [
      ["Employee", "Employee number", "Check", "Area", "Owner", "Status", "Waiting reason"],
      ...scanChecks.map((item) => [scanRow.employee_name, scanRow.employee_no, item.label, item.group, item.owner, item.status, item.waiting_reason ?? ""]),
    ]
    const blob = new Blob(["\uFEFF", lines.map((line) => line.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${scanRow.employee_no || "employee"}-onboarding-readiness.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Card size="sm">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <CardTitle className="text-base font-semibold">Onboarding readiness</CardTitle>
              <Tooltip relationship="description" content="The stage shows each request’s first mandatory blocker. Invitations and registration have separate tabs; completed requests remain in All requests.">
                <FluentButton appearance="subtle" size="small" icon={<Info20Regular />} aria-label="About onboarding readiness" />
              </Tooltip>
            </div>
            <CardDescription>See what’s blocking employee activation.</CardDescription>
          </div>
          {!loading && !error ? <div className="grid grid-cols-3 gap-2 sm:flex" aria-hidden="true">
            {[
              { label: "Open", value: rows.length, tone: "text-foreground" },
              { label: "Ready", value: rows.filter((row) => row.readiness.ready_to_activate).length, tone: "text-emerald-600 dark:text-emerald-400" },
              { label: "Overdue", value: rows.filter((row) => row.overdue).length, tone: "text-amber-600 dark:text-amber-400" },
            ].map((stat) => <div key={stat.label} className="min-w-20 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-center">
              <div className={`text-lg font-semibold tabular-nums ${stat.tone}`}>{stat.value}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</div>
            </div>)}
          </div> : null}
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">
        <div role="search" aria-label="Filter onboarding overview" className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1"><Input aria-label="Search onboarding overview" placeholder="Search employee or request…" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
            <FluentButton className="lg:hidden" icon={<Filter20Regular />} aria-label="Filters" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
              {activeFilters.length ? <CounterBadge size="small" aria-label={`${activeFilters.length} active filters`}>{activeFilters.length}</CounterBadge> : null}
            </FluentButton>
            <Tooltip relationship="label" content="Refresh overview"><FluentButton className="lg:hidden" icon={<ArrowClockwise20Regular />} aria-label="Refresh overview" disabled={loading} onClick={() => setRevision((value) => value + 1)} /></Tooltip>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:w-auto lg:items-center" aria-label="Quick filters and order">
            <div className="lg:w-44"><FluentSelect ariaLabel="Stage" size="small" value={filters.stage} options={filterFields[0].options} onChange={(stage) => setFilters((current) => ({ ...current, stage }))} /></div>
            <div className="lg:w-44"><FluentSelect ariaLabel="Department" size="small" value={filters.department} options={filterFields[1].options} onChange={(department) => setFilters((current) => ({ ...current, department }))} /></div>
            <div className="col-span-2 sm:col-span-1 lg:w-36"><FluentSelect ariaLabel="Order" size="small" value={order} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} onChange={(value) => setOrder(value === "oldest" ? "oldest" : "newest")} /></div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <FluentButton icon={<Filter20Regular />} aria-label="More filters" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
              Filters {activeFilters.length ? <CounterBadge size="small">{activeFilters.length}</CounterBadge> : null}
            </FluentButton>
            <Tooltip relationship="label" content="Refresh overview"><FluentButton icon={<ArrowClockwise20Regular />} aria-label="Refresh" disabled={loading} onClick={() => setRevision((value) => value + 1)} /></Tooltip>
          </div>
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
            <p role="status" className="text-xs text-muted-foreground">{visible.length} of {rows.length} open requests · {rows.filter((row) => row.readiness.ready_to_activate).length} ready for activation · {rows.filter((row) => row.overdue).length} overdue</p>
            {visible.length === 0 ? <p>No open requests match these filters.</p> : null}
            {pageRows.length ? <div className="overflow-hidden rounded-xl border border-border bg-background">
              <div aria-hidden="true" className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(200px,1.5fr)_minmax(120px,0.8fr)_auto] gap-4 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Employee</span><span>Stage &amp; readiness</span><span>Next required action</span><span>Status</span><span className="w-[190px] text-right">Actions</span>
              </div>
              <ul aria-label="Open onboarding requests and their next required actions" className="divide-y divide-border">
                {pageRows.map((row) => {
                  const nextAction = row.readiness.next_action ?? row.blockers[0]
                  const name = row.employee_name || row.employee_no
                  const done = row.readiness.completed_required
                  const total = row.readiness.total_required
                  const pct = total ? Math.round((done / total) * 100) : 0
                  return <li key={row.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(200px,1.5fr)_minmax(120px,0.8fr)_auto] lg:items-center lg:gap-4 lg:py-3">
                    <div className="flex min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-1">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 text-muted-foreground">
                        {employeePhotos[row.employee_id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={employeePhotos[row.employee_id]} alt="" className="size-full object-cover" />
                        ) : <Person20Regular />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground" title={name}>{name}</span>
                        <span className="block truncate text-xs text-muted-foreground" title={`${row.employee_no} · ${row.department} · ${row.onboarding_no}`}>{row.employee_no} · {row.department}</span>
                      </span>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex max-w-full items-center truncate rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary" title={row.stage}>{row.stage}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{done}/{total} · {pct}%</span>
                      </div>
                      <ProgressBar aria-label={`Readiness ${done} of ${total}`} value={total ? done / total : 0} thickness="medium" color={pct === 100 ? "success" : "brand"} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs text-muted-foreground lg:hidden">Next required action</span>
                      <span className="block text-sm font-medium leading-snug" title={nextAction?.label ?? "Ready for authorized HR to review and activate"}>{nextAction?.label ?? "Ready for HR activation"}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Responsible: {nextAction?.owner ?? "HR"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {row.overdue ? <FluentBadge appearance="tint" color="warning">Overdue</FluentBadge> : null}
                      {row.attention_reasons?.length ? <Tooltip relationship="description" content={row.attention_reasons.join(" · ")}><FluentBadge appearance="outline" color="warning" tabIndex={0}>Needs attention</FluentBadge></Tooltip> : null}
                      {!row.overdue && !row.attention_reasons?.length ? <FluentBadge appearance="tint" color="success">On track</FluentBadge> : null}
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end lg:w-[190px]">
                      <FluentButton className="flex-1 sm:flex-none" size="small" icon={<Scan20Regular />} aria-label={`Scan pending onboarding items for ${name}`} onClick={() => void startScan(row)}>Scan</FluentButton>
                      <FluentButton className="flex-1 sm:flex-none" size="small" appearance="primary" aria-label={`Review onboarding for ${name}`} onClick={() => onOpen(row.id)}>Review</FluentButton>
                    </div>
                  </li>
                })}
              </ul>
            </div> : null}
            {visible.length > pageSize ? <nav aria-label="Onboarding results pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p role="status" className="text-xs text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visible.length)} of {visible.length} · Page {page} of {pageCount}</p>
              <div className="flex gap-2">
                <FluentButton size="small" disabled={page === 1} onClick={() => setPagination({ filterKey, page: page - 1 })}>Previous page</FluentButton>
                <FluentButton size="small" disabled={page === pageCount} onClick={() => setPagination({ filterKey, page: page + 1 })}>Next page</FluentButton>
              </div>
            </nav> : null}
            <OverlayDrawer open={Boolean(scanRow)} onOpenChange={(_, data) => { if (!data.open) { setScanRow(null); setSelectedScanIssue(null); setScanning(false) } }} position="end" size="medium" style={{ width: "min(620px, 100vw)" }}>
              <DrawerHeader>
                <DrawerHeaderTitle action={<FluentButton appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close readiness scan" onClick={() => { setScanRow(null); setScanning(false) }} />}>
                  {selectedScanIssue ? "Complete onboarding step" : "Onboarding readiness scan"}
                </DrawerHeaderTitle>
              </DrawerHeader>
              <DrawerBody className="flex flex-col gap-5">
                {selectedScanIssue ? <>
                  <FluentButton className="self-start" appearance="subtle" icon={<ArrowLeft20Regular />} disabled={refreshingScan} onClick={() => void returnToScanIssues()}>{refreshingScan ? "Refreshing…" : "Back to remaining issues"}</FluentButton>
                  <div className="rounded-xl border border-border p-5">
                    <div className="flex items-start gap-3"><DismissCircle20Regular className="mt-0.5 shrink-0 text-red-600" /><div><h3 className="font-semibold">{selectedScanIssue.label}</h3><p className="mt-1 text-sm text-muted-foreground">Responsible: {selectedScanIssue.owner}</p></div></div>
                    <p className="mt-5 text-sm text-muted-foreground">Complete this requirement in its authorized workspace. This scan stays open; return here afterward and the remaining list will refresh automatically.</p>
                    <FluentButton className="mt-5" appearance="primary" icon={<ArrowRight20Regular />} onClick={() => { if (scanRow) onOpen(scanRow.id, selectedScanIssue) }}>
                      {selectedScanIssue.id === "bank account" ? "Open bank verification" : selectedScanIssue.id === "independently approved starting salary" ? "Open salary approval" : selectedScanIssue.id === "signed employment contract" ? "Open contract completion" : "Open step workspace"}
                    </FluentButton>
                  </div>
                </> : <>
                <div className="text-center">
                  <p className="font-semibold">{scanRow?.employee_name || scanRow?.employee_no}</p>
                  <p className="text-sm text-muted-foreground">{scanning ? "Scanning onboarding readiness" : "Scan complete"}</p>
                </div>
                {scanning ? <div className="flex min-h-64 flex-col items-center justify-center gap-6 text-center" aria-live="polite">
                  <Spinner size="huge" labelPosition="below" label="Scanning employee readiness" />
                  <div key={scanStep} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="font-medium">Checking {scanChecks[scanStep]?.label ?? "employee readiness"}…</p>
                    <p className="mt-1 text-sm text-muted-foreground">Reviewing {scanChecks[scanStep]?.owner ?? "assigned owner"} records and completion evidence</p>
                  </div>
                  <div className="w-full max-w-md">
                    <ProgressBar value={scanChecks.length ? (scanStep + 1) / scanChecks.length : 1} thickness="large" />
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">{Math.min(scanStep + 1, scanChecks.length)} of {scanChecks.length} checks</p>
                  </div>
                </div> : null}
                {!scanning ? (
                  <div className="rounded-lg border border-border p-4">
                    <p className="font-semibold">{pendingScanChecks.length ? `${pendingScanChecks.length} issue${pendingScanChecks.length === 1 ? "" : "s"} need attention` : "No pending issues found"}</p>
                    {pendingScanChecks.length ? <ul className="mt-3 divide-y divide-border text-sm">{pendingScanChecks.map((item) => <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><DismissCircle20Regular className="shrink-0 text-red-600" /><div className="min-w-0 flex-1"><p className="font-medium">{item.label}</p><p className="text-muted-foreground">{item.waiting_reason || `Responsible: ${item.owner}`}</p></div><FluentButton size="small" appearance="primary" icon={<Wrench20Regular />} onClick={() => setSelectedScanIssue(item)} aria-label={`Complete ${item.label}`}>Complete step</FluentButton></li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">All mandatory onboarding checks are complete.</p>}
                  </div>
                ) : null}
                </>}
              </DrawerBody>
              <DrawerFooter>
                {!selectedScanIssue ? <FluentButton icon={<DocumentArrowDown20Regular />} disabled={scanning || !scanRow} onClick={exportScan}>Export results</FluentButton> : null}
              </DrawerFooter>
            </OverlayDrawer>
          </>
        )}
      </CardContent>
    </Card>
  )
}
