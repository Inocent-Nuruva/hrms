"use client"
import { onboardingActionMessage } from "@/lib/onboarding-action-feedback"

import * as React from "react"
import { Avatar, Badge as FluentBadge, Field, Tab, TabList } from "@fluentui/react-components"
import { Search, ChevronRight, X } from "lucide-react"
import { CheckmarkCircle20Regular, DismissCircle20Regular, Circle20Regular, CalendarLtrRegular, FilterRegular, FlagRegular, OpenRegular, PersonRegular } from "@fluentui/react-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  approveOnboardingRequest, rejectOnboardingRequest, approveOffboardingRequest, rejectOffboardingRequest,
  completeOnboardingTask, completeOffboardingTask, leaveRequestApprovalAction, reportMyActionItemIssue,
  getOnboardingRequest, listOnboardingDocuments, listOffboardingDocuments,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { formatDate, prettify, readString, rowId, StatusChip } from "./talent-visuals"
import { useActionInboxLiveRefresh } from "@/hooks/use-action-inbox-live-refresh"
import { actionReference, actionSubject, defaultInboxFilters, filterAndGroupActions, groupsForInboxTab, isOpenAction, recordValue, type InboxFilters } from "./request-inbox-utils"
import { cn } from "@/lib/utils"

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-2 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function RequestActionInbox({ actions, loading, onRefresh }: {
  actions: AdminRecord[]
  loading: boolean
  onRefresh: () => Promise<void>
}) {
  const [filters, setFilters] = React.useState<InboxFilters>(defaultInboxFilters)
  const [selectedId, setSelectedId] = React.useState("")
  const [comment, setComment] = React.useState("")
  const [evidenceId, setEvidenceId] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  useActionInboxLiveRefresh(onRefresh, busy)
  const [error, setError] = React.useState("")
  const [documents, setDocuments] = React.useState<AdminRecord[]>([])
  const [documentsLoading, setDocumentsLoading] = React.useState(false)
  const [documentsError, setDocumentsError] = React.useState("")
  const [reviewDetails, setReviewDetails] = React.useState<AdminRecord | null>(null)
  const [reviewDetailsLoading, setReviewDetailsLoading] = React.useState(false)
  const [reviewDetailsError, setReviewDetailsError] = React.useState("")
  const [groupPage, setGroupPage] = React.useState(1)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({})
  const [settledId, setSettledId] = React.useState("")
  const groups = React.useMemo(() => groupsForInboxTab(actions, filters), [actions, filters])
  const selected = groups.flatMap((group) => group.items).find((row) => rowId(row) === selectedId)
  const statusTabs = [
    { value: "open", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "all", label: "All" },
  ].map((tab) => ({
    ...tab,
    count: filterAndGroupActions(actions, { ...defaultInboxFilters, status: tab.value })
      .reduce((total, group) => total + group.items.length, 0),
  }))
  const subject = selected ? actionSubject(selected) : null
  const reference = selected ? actionReference(selected) : null
  const context = recordValue(selected?.request_context)
  const metadata = recordValue(selected?.metadata)
  const comments = Array.isArray(metadata.issue_comments) ? metadata.issue_comments.map(recordValue) : []
  const requiresDetailedReview = readString(metadata, ["stage"]) === "employee_details_review"
  const isTask = reference && ["ONBOARDING_TASK", "OFFBOARDING_TASK"].includes(reference.type)
  const isReminder = readString(selected, ["actionType", "action_type"]).toUpperCase() === "REMINDER"
  const isApproval = reference && ["ONBOARDING_REQUEST", "OFFBOARDING_REQUEST", "LEAVE_REQUEST"].includes(reference.type) &&
    readString(selected, ["actionType", "action_type"]).toUpperCase() === "APPROVAL"
  const canAct = selected && isOpenAction(selected) && selected.is_actionable !== false && Boolean(reference?.requestId) && !requiresDetailedReview
  const modules = [...new Set(actions.map((row) => readString(row, ["sourceModule", "source_module"])).filter(Boolean))].sort()
  const pages = Math.max(1, Math.ceil(groups.length / 12))
  const currentPage = Math.min(groupPage, pages)
  const visibleGroups = React.useMemo(() => groups.slice((currentPage - 1) * 12, currentPage * 12), [currentPage, groups])
  const evidenceRequired = context.completion_evidence_required === true
  const requestId = reference?.requestId
  const sourceType = reference?.type
  const employeeDetailsReview = recordValue(reviewDetails?.employee_details_review)
  const reviewSections = Array.isArray(employeeDetailsReview.sections)
    ? employeeDetailsReview.sections.map(recordValue)
    : []
  const advancedFilterCount = [filters.module, filters.kind, filters.priority, filters.due]
    .filter((value) => value !== "all").length
  const resultItemCount = groups.reduce((total, group) => total + group.items.length, 0)
  const hasSearchOrAdvancedFilters = Boolean(filters.search.trim()) || advancedFilterCount > 0
  const hasActiveFilters = hasSearchOrAdvancedFilters || filters.status !== defaultInboxFilters.status
  const actionUrl = readString(selected, ["actionUrl", "action_url"])
  const safeActionUrl = actionUrl.startsWith("/") && !actionUrl.startsWith("//")
    ? actionUrl
    : requiresDetailedReview && requestId
      ? `/dashboard/employees/onboarding?request_id=${requestId}&workspace_tab=employee-details`
      : ""
  const sourceModule = prettify(readString(selected, ["sourceModule", "source_module"], "Request"))
  const priority = prettify(readString(selected, ["priority"], "MEDIUM"))
  const dueDate = formatDate(selected?.dueAt ?? selected?.due_at)
  const selectedStatus = readString(selected, ["status"], "OPEN")
  const displayStatus = requiresDetailedReview && selected && isOpenAction(selected) ? "Awaiting review" : selectedStatus
  const justSettled = settledId !== "" && (!selected || settledId === selectedId)
  const decisionHelp = justSettled || (selected && !isOpenAction(selected))
    ? selectedStatus.toUpperCase() === "CANCELLED"
      ? "This item is closed and no longer needs action."
      : "This item has been completed. No further action is needed."
    : requiresDetailedReview
    ? "Open the onboarding workspace and review every submitted section. Approve complete sections or return individual sections with clear correction notes."
    : isReminder
      ? "This reminder stays open until the required report is submitted. Review the details below and report a blocker to HR when follow-up is required."
    : reference?.type === "ONBOARDING_REQUEST"
    ? "Confirm that the employee-submitted onboarding information is complete and ready for HR to continue. Approval moves the request to the next onboarding stage; declining returns it with your reason."
    : isApproval
      ? "Review the request details and confirm whether it should proceed. Add a clear reason when declining so the requester knows what must change."
      : "Confirm that the assigned work has actually been completed for this employee. If it cannot be completed, report the blocker instead of marking it complete."

  React.useEffect(() => {
    const selectionIsVisible = visibleGroups.some((group) => group.items.some((item) => rowId(item) === selectedId))
    const next = visibleGroups.flatMap((group) => group.items).find(isOpenAction) ?? visibleGroups[0]?.items[0]
    if (!selectionIsVisible && next && !busy && !settledId) select(next)
  }, [busy, selectedId, settledId, visibleGroups])

  React.useEffect(() => {
    if (!evidenceRequired || !requestId || !sourceType) return
    let cancelled = false
    setDocuments([])
    setDocumentsError("")
    setDocumentsLoading(true)
    const listDocuments = sourceType === "ONBOARDING_TASK" ? listOnboardingDocuments : listOffboardingDocuments
    void listDocuments(readStoredSessionTokens().accessToken, requestId).then((rows) => {
      if (!cancelled) setDocuments(rows)
    }).catch(() => {
      if (!cancelled) setDocumentsError("Supporting documents could not be loaded. Open the full request or ask HR to attach the required evidence.")
    }).finally(() => { if (!cancelled) setDocumentsLoading(false) })
    return () => { cancelled = true }
  }, [evidenceRequired, requestId, sourceType])

  React.useEffect(() => {
    if (!requiresDetailedReview || !requestId) {
      setReviewDetails(null)
      setReviewDetailsError("")
      return
    }
    let cancelled = false
    setReviewDetails(null)
    setReviewDetailsError("")
    setReviewDetailsLoading(true)
    void getOnboardingRequest(readStoredSessionTokens().accessToken, requestId)
      .then((details) => { if (!cancelled) setReviewDetails(details) })
      .catch((failure) => {
        if (!cancelled) setReviewDetailsError(failure instanceof Error ? failure.message : "Submitted details could not be loaded.")
      })
      .finally(() => { if (!cancelled) setReviewDetailsLoading(false) })
    return () => { cancelled = true }
  }, [requestId, requiresDetailedReview])

  function updateFilter(key: keyof InboxFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setGroupPage(1)
  }
  function select(row: AdminRecord) {
    setSelectedId(rowId(row))
    setSettledId("")
    setComment("")
    setEvidenceId("")
    setError("")
  }
  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? true),
    }))
  }
  async function submit(mode: "approve" | "reject" | "complete" | "issue") {
    if (!selected || !reference || busy) return
    const token = readStoredSessionTokens().accessToken
    if (!token) { setError("Please sign in again."); return }
    if ((mode === "issue" || mode === "reject") && !comment.trim()) {
      setError("Explain the reason in the comment before continuing.")
      return
    }
    if (mode === "complete" && context.completion_evidence_required === true && !/^[1-9]\d*$/.test(evidenceId)) {
      setError("Select a supporting document before completing this item.")
      return
    }
    setBusy(true)
    setError("")
    try {
      let onboardingResult: unknown
      const comments = comment.trim()
      if (mode === "issue") {
        await reportMyActionItemIssue(token, selectedId, comment.trim())
      } else if (mode === "complete") {
        const complete = reference.type === "ONBOARDING_TASK" ? completeOnboardingTask : completeOffboardingTask
        const result = await complete(token, reference.requestId, reference.id, {
          ...(reference.type === "ONBOARDING_TASK" ? { completion_notes: comment.trim() } : { remarks: comment.trim() }),
          ...(evidenceId ? { evidence_document_id: Number(evidenceId) } : {}),
        })
        if (reference.type === "ONBOARDING_TASK") onboardingResult = result
      } else if (reference.type === "ONBOARDING_REQUEST") {
        onboardingResult = mode === "approve"
          ? await approveOnboardingRequest(token, reference.requestId, { approve: true, comments })
          : await rejectOnboardingRequest(token, reference.requestId, { comments })
      } else if (reference.type === "OFFBOARDING_REQUEST") {
        await (mode === "approve" ? approveOffboardingRequest : rejectOffboardingRequest)(token, reference.requestId, { comments })
      } else if (reference.type === "LEAVE_REQUEST") {
        await leaveRequestApprovalAction(token, reference.requestId, { action: mode, comments })
      } else {
        throw new Error("Open the full request to review this action.")
      }
      toast.success(onboardingActionMessage(onboardingResult, mode === "issue" ? "Issue saved and sent to HR. The item remains open." : mode === "complete" ? "Checklist item completed." : mode === "approve" ? "Request approved." : "Request declined."))
      setComment("")
      setEvidenceId("")
      if (mode !== "issue") setSettledId(selectedId)
      await onRefresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save. Please try again.")
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TabList
        aria-label="Request status"
        selectedValue={filters.status === "cancelled" ? "all" : filters.status}
        onTabSelect={(_event, data) => {
          updateFilter("status", String(data.value))
          setSelectedId("")
          setComment("")
          setEvidenceId("")
          setError("")
        }}
        className="shrink-0 border-b bg-card px-2"
      >
        {statusTabs.map((tab) => (
          <Tab key={tab.value} value={tab.value} disabled={busy}>
            {tab.label} <span className="ml-1 text-xs tabular-nums text-muted-foreground">{tab.count}</span>
          </Tab>
        ))}
      </TabList>
      <div className="grid min-h-0 flex-1 overflow-hidden border-b bg-card lg:grid-cols-[minmax(300px,36%)_1fr]">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r">
          <div className="relative z-20 shrink-0 border-b bg-card px-2 py-2">
            <div className="group/search min-w-0">
              <Input
                type="search"
                size="medium"
                aria-label="Search requests"
                placeholder="Search requests"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                contentBefore={<Search aria-hidden />}
                contentAfter={(
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon-sm" className={cn("rounded-sm opacity-0 transition-opacity group-hover/search:opacity-100 group-focus-within/search:opacity-100", (filtersOpen || hasActiveFilters) && "bg-primary/5 text-primary opacity-100")} aria-expanded={filtersOpen} aria-controls="request-search-filters" aria-label="Search filters" title="Search filters" onClick={() => setFiltersOpen((open) => !open)}><FilterRegular aria-hidden /></Button>
                    {hasActiveFilters ? <Button variant="ghost" size="icon-sm" className="rounded-sm" aria-label="Clear search and filters" title="Clear search and filters" onClick={() => { setFilters(defaultInboxFilters); setGroupPage(1); setFiltersOpen(false) }}><X aria-hidden /></Button> : null}
                  </div>
                )}
                className="rounded-none border-0 shadow-none focus-within:ring-0"
              />
            </div>
            {filtersOpen ? <div id="request-search-filters" className="absolute left-0 right-0 top-full z-30 border-b bg-card px-4 py-3 shadow-xl">
              <div className="divide-y">
                <FilterRow label="Status"><FluentSelect ariaLabel="Filter by status" size="small" value={filters.status} onChange={(value) => updateFilter("status", value)} options={[{ value: "open", label: "Awaiting action" }, { value: "all", label: "All statuses" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} /></FilterRow>
                <FilterRow label="Request type"><FluentSelect ariaLabel="Filter by request type" size="small" value={filters.module} onChange={(value) => updateFilter("module", value)} options={[{ value: "all", label: "All request types" }, ...modules.map((value) => ({ value, label: prettify(value) }))]} /></FilterRow>
                <FilterRow label="Action"><FluentSelect ariaLabel="Filter by action" size="small" value={filters.kind} onChange={(value) => updateFilter("kind", value)} options={[{ value: "all", label: "All actions" }, { value: "APPROVAL", label: "Approvals" }, { value: "TASK", label: "Checklist tasks" }]} /></FilterRow>
                <FilterRow label="Priority"><FluentSelect ariaLabel="Filter by priority" size="small" value={filters.priority} onChange={(value) => updateFilter("priority", value)} options={[{ value: "all", label: "All priorities" }, ...["URGENT", "HIGH", "MEDIUM", "LOW"].map((value) => ({ value, label: prettify(value) }))]} /></FilterRow>
                <FilterRow label="Due date"><FluentSelect ariaLabel="Filter by due date" size="small" value={filters.due} onChange={(value) => updateFilter("due", value)} options={[{ value: "all", label: "Any due date" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "none", label: "No due date" }]} /></FilterRow>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
                <span className="text-xs text-muted-foreground" aria-live="polite">{resultItemCount} {resultItemCount === 1 ? "item" : "items"}</span>
                <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => { setFilters(defaultInboxFilters); setGroupPage(1) }}>Clear</Button><Button size="sm" onClick={() => setFiltersOpen(false)}>Apply</Button></div>
              </div>
            </div> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {loading ? <p role="status" className="py-10 text-center text-muted-foreground">Loading assigned requests…</p> : groups.length === 0 ? (
        <div className="p-10 text-center">
          <h2 className="font-semibold">{hasSearchOrAdvancedFilters ? "No results" : filters.status === "open" ? "You’re all caught up" : filters.status === "completed" ? "No completed requests yet" : "No requests yet"}</h2>
          {hasSearchOrAdvancedFilters ? <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setFilters({ ...defaultInboxFilters, status: filters.status }); setGroupPage(1); setFiltersOpen(false) }}>Clear filters</Button> : null}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/80">
          {visibleGroups.map((group) => {
            const active = group.items.some((item) => rowId(item) === selectedId)
            const pendingCount = group.items.filter(isOpenAction).length
            const completedCount = group.items.filter((item) => readString(item, ["status"]).toUpperCase() === "COMPLETED").length
            const unattended = pendingCount > 0
            const expanded = expandedGroups[group.subject.key] ?? true
            return <div key={group.subject.key} className={cn("relative before:absolute before:inset-y-0 before:left-0 before:w-1", active ? "bg-primary/10 before:bg-primary" : "before:bg-transparent")}>
              <div className="flex items-center transition hover:bg-muted/60">
                  <button type="button" className="ml-2 flex size-8 shrink-0 items-center justify-center rounded text-foreground hover:bg-muted" aria-label={`${expanded ? "Collapse" : "Expand"} requests for ${group.subject.name}`} aria-expanded={expanded} onClick={() => toggleGroup(group.subject.key)}>
                    <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90", active && "text-primary")} aria-hidden />
                  </button>
                <button type="button" aria-label={`Review requests for ${group.subject.name}`} aria-current={active ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-4 pl-1 pr-3 text-left" onClick={() => select(group.items.find(isOpenAction) ?? group.items[0])}>
                  <Avatar name={group.subject.name} image={group.subject.photoUrl ? { src: group.subject.photoUrl } : undefined} color="brand" size={48} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-foreground">{group.subject.name}</h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{[group.subject.number, group.subject.department, group.subject.position].filter(Boolean).join(" · ") || "Employee profile"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{pendingCount} pending · {completedCount} completed{group.items.length > pendingCount + completedCount ? ` · ${group.items.length - pendingCount - completedCount} closed` : ""}</p>
                  </div>
                  <FluentBadge appearance="tint" color={unattended ? "warning" : "success"} size="small" className="shrink-0">
                    {unattended ? `${pendingCount} to complete` : completedCount === group.items.length ? "Completed" : "Closed"}
                  </FluentBadge>
                </button>
              </div>
              {expanded ? <div className="divide-y border-t bg-background/80 pl-5 sm:pl-12">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">{unattended ? "Items to complete" : "Request history"}</p>
                {[...group.items].sort((a, b) => Number(isOpenAction(b)) - Number(isOpenAction(a))).map((item) => {
                  const itemActive = rowId(item) === selectedId
                  const itemUnattended = isOpenAction(item)
                  return <button key={rowId(item)} type="button" aria-label={`Review ${readString(item, ["title"], "request")}`} aria-current={itemActive ? "true" : undefined} className={cn("flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/60", itemActive && "bg-primary/5")} onClick={() => select(item)}>
                    {itemUnattended ? <Circle20Regular aria-hidden className="shrink-0 text-primary" /> : readString(item, ["status"]).toUpperCase() === "COMPLETED" ? <CheckmarkCircle20Regular aria-hidden className="shrink-0 text-muted-foreground" /> : <DismissCircle20Regular aria-hidden className="shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-normal break-words text-sm font-medium text-foreground">{readString(item, ["title"], "Assigned request")}</p>
                      <p className="mt-0.5 whitespace-normal break-words text-xs text-muted-foreground">{readString(item, ["description"]) || prettify(readString(item, ["sourceModule", "source_module"], "Request"))}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground">{formatDate(item.dueAt ?? item.due_at)}</span>
                      <FluentBadge appearance="tint" color={itemUnattended ? "warning" : "success"} size="small">
                        {itemUnattended ? item.is_actionable === false ? "Waiting" : "To complete" : prettify(readString(item, ["status"], "Closed"))}
                      </FluentBadge>
                    </div>
                  </button>
                })}
              </div> : null}
            </div>
          })}
        </div>
      )}
          </div>
      {pages > 1 ? <div className="flex items-center justify-center gap-3 border-t p-3"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setGroupPage(currentPage - 1)}>Previous</Button><span className="text-sm">{currentPage} / {pages}</span><Button variant="outline" size="sm" disabled={currentPage === pages} onClick={() => setGroupPage(currentPage + 1)}>Next</Button></div> : null}
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
          <header className="flex min-h-10 shrink-0 items-center border-b px-5 py-2">
            <h2 className="font-semibold">{selected ? readString(selected, ["title"], "Review assigned request") : "Review assigned request"}</h2>
          </header>
          {selected ? <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4"><div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-xl border border-primary/20 bg-card">
                <div className="flex flex-col gap-4 bg-primary/5 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={subject?.name} image={subject?.photoUrl ? { src: subject.photoUrl } : undefined} color="brand" size={48} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{requiresDetailedReview ? "Detailed review required" : isApproval ? "Decision required" : "Assigned work"}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{decisionHelp}</p>
                    </div>
                  </div>
                  <StatusChip value={displayStatus} />
                </div>
                <dl className="grid border-t sm:grid-cols-3">
                  <div className="flex gap-3 border-b p-4 sm:border-b-0 sm:border-r">
                    <PersonRegular className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <div><dt className="text-xs font-medium text-muted-foreground">Employee</dt><dd className="mt-0.5 font-medium">{subject?.name}</dd><dd className="text-xs text-muted-foreground">{[subject?.number, subject?.department, subject?.position].filter(Boolean).join(" · ") || "No employee details"}</dd></div>
                  </div>
                  <div className="flex gap-3 border-b p-4 sm:border-b-0 sm:border-r">
                    <CalendarLtrRegular className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <div><dt className="text-xs font-medium text-muted-foreground">Due date</dt><dd className="mt-0.5 font-medium">{dueDate === "—" ? "No deadline set" : dueDate}</dd><dd className="text-xs text-muted-foreground">{sourceModule}</dd></div>
                  </div>
                  <div className="flex gap-3 p-4">
                    <FlagRegular className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <div><dt className="text-xs font-medium text-muted-foreground">Priority</dt><dd className="mt-0.5 font-medium">{priority}</dd><dd className="text-xs text-muted-foreground">Assigned to you</dd></div>
                  </div>
                </dl>
              </section>
              {!requiresDetailedReview ? <section className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-primary">{isOpenAction(selected) ? "Required action" : "Completed / closed action"}</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold">{readString(selected, ["title"], "Review this assigned request")}</p>
                    {readString(selected, ["description"]) ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{readString(selected, ["description"])}</p> : null}
                    {isOpenAction(selected) && evidenceRequired ? <p className="mt-3 text-xs font-medium text-primary">Supporting evidence is required before completing this item.</p> : null}
                  </div>
                </div>
                {context.reason || context.start_date ? <dl className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                  {context.reason ? <div className="sm:col-span-2"><dt className="font-medium">Reason provided</dt><dd className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(context.reason)}</dd></div> : null}
                  {context.start_date ? <div><dt className="font-medium">Requested period</dt><dd className="mt-1 text-muted-foreground">{formatDate(context.start_date)} – {formatDate(context.end_date)}</dd></div> : null}
                </dl> : null}
              </section> : null}
              {requiresDetailedReview ? <section className="overflow-hidden rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h4 className="font-semibold">Submitted onboarding sections</h4>
                    <p className="mt-0.5 text-sm text-muted-foreground">Review the employee’s information below. Section decisions are recorded in the onboarding workspace.</p>
                  </div>
                  {safeActionUrl ? <Button render={<a href={safeActionUrl} />} size="sm"><OpenRegular data-icon="inline-start" aria-hidden />Review sections</Button> : null}
                </div>
                {reviewDetailsLoading ? <p role="status" className="p-4 text-sm text-muted-foreground">Loading submitted sections…</p> : reviewDetailsError ? <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p role="alert" className="font-medium text-destructive">Submitted sections are unavailable</p>
                    <p className="mt-1 text-sm text-muted-foreground">{reviewDetailsError} Open the onboarding workspace to verify whether this request still exists.</p>
                  </div>
                  {safeActionUrl ? <Button render={<a href={safeActionUrl} />} variant="outline" size="sm"><OpenRegular data-icon="inline-start" aria-hidden />Open onboarding</Button> : null}
                </div> : reviewSections.length ? <div className="divide-y">
                  {reviewSections.map((section) => {
                    const fields = Array.isArray(section.fields) ? section.fields.map(recordValue) : []
                    const status = readString(section, ["status"], "pending")
                    return <div key={readString(section, ["key", "label"])} className="grid gap-2 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-start">
                      <div>
                        <p className="font-medium">{readString(section, ["label"], "Onboarding section")}</p>
                        {readString(section, ["comment"]) ? <p className="mt-1 text-xs text-muted-foreground">{readString(section, ["comment"])}</p> : null}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{fields.map((field) => `${readString(field, ["label"])}: ${readString(field, ["value"], "Not provided")}`).join(" · ") || "No information submitted"}</p>
                      <StatusChip value={status} />
                    </div>
                  })}
                </div> : <p className="p-4 text-sm text-muted-foreground">No submitted sections were returned for this request.</p>}
              </section> : null}
              {selected.is_actionable === false && isOpenAction(selected) ? <Alert><AlertDescription>This item is waiting for an earlier workflow step. You can still report an issue to HR.</AlertDescription></Alert> : null}
              {comments.length ? <section className="flex flex-col gap-2"><h4 className="text-sm font-medium">Reported issues</h4>{comments.map((entry, index) => <div key={readString(entry, ["id"], String(index))} className="rounded-lg border p-3"><p className="whitespace-pre-wrap text-sm">{readString(entry, ["comment"])}</p><p className="mt-1 text-xs text-muted-foreground">{readString(entry, ["author"])} · {formatDate(entry.created_at)}</p></div>)}</section> : null}
              {isOpenAction(selected) && !justSettled ? <>
                {isTask && evidenceRequired ? <div className="flex flex-col gap-2">
                  <FluentSelect label="Supporting document" value={evidenceId} onChange={setEvidenceId} disabled={busy || documentsLoading} placeholder={documentsLoading ? "Loading documents…" : "Select an attached document"} options={documents.map((document) => ({ value: rowId(document), label: readString(document, ["title", "name", "file_name", "document_type"], "Supporting document") }))} />
                  {documentsError || (!documentsLoading && documents.length === 0) ? <p className="text-sm text-muted-foreground">{documentsError || "No supporting documents are attached. Open the full request or ask HR to attach the required evidence."}</p> : null}
                </div> : null}
                {!requiresDetailedReview ? <Field label={isApproval ? "Decision note" : isReminder ? "Issue or follow-up note" : "Completion note or blocker"} hint={isApproval ? "Required when declining. Add a note when approval needs useful context." : isReminder ? "Explain the blocker or follow-up needed before reporting this issue to HR." : "Describe what was completed, or explain the blocker before reporting an issue."}>
                  <Textarea aria-label="Comment or reason" value={comment} maxLength={1000} onChange={(event) => setComment(event.target.value)} disabled={busy} placeholder={isApproval ? "Add context for your approval, or explain what must be corrected…" : isReminder ? "Explain why the report is still missing or what support is required…" : "Summarize the completed work or explain what is preventing completion…"} />
                </Field> : null}
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {isApproval && !requiresDetailedReview ? <><Button disabled={!canAct || busy || loading} onClick={() => void submit("approve")}>Approve and continue</Button><Button variant="outline" disabled={!canAct || busy || loading} onClick={() => void submit("reject")}>Return for correction</Button></> : null}
                  {isTask ? <Button disabled={!canAct || busy || loading} onClick={() => void submit("complete")}>Mark item complete</Button> : null}
                  {!requiresDetailedReview ? <Button variant="outline" disabled={busy || loading} onClick={() => void submit("issue")}>{busy ? "Saving…" : "Report issue to HR"}</Button> : null}
                </div>
              </> : null}
          </div></div> : <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">{justSettled ? "This item has been completed. No further action is needed." : "Select a request to review its details."}</div>}
        </section>
      </div>
    </div>
  )
}
