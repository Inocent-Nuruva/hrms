"use client"
import { onboardingActionMessage } from "@/lib/onboarding-action-feedback"

import * as React from "react"
import { Avatar, Badge as FluentBadge, Field } from "@fluentui/react-components"
import { Search, ArrowRight, SlidersHorizontal, ChevronDown, X } from "lucide-react"
import { ClipboardTaskColor } from "@fluentui/react-icons"
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  approveOnboardingRequest, rejectOnboardingRequest, approveOffboardingRequest, rejectOffboardingRequest,
  completeOnboardingTask, completeOffboardingTask, leaveRequestApprovalAction, reportMyActionItemIssue,
  listOnboardingDocuments, listOffboardingDocuments,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { formatDate, prettify, readString, rowId, StatusChip } from "./talent-visuals"
import { actionReference, actionSubject, defaultInboxFilters, filterAndGroupActions, isOpenAction, recordValue, type InboxFilters } from "./request-inbox-utils"
import { cn } from "@/lib/utils"

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
  const [error, setError] = React.useState("")
  const [documents, setDocuments] = React.useState<AdminRecord[]>([])
  const [documentsLoading, setDocumentsLoading] = React.useState(false)
  const [documentsError, setDocumentsError] = React.useState("")
  const [groupPage, setGroupPage] = React.useState(1)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const groups = React.useMemo(() => filterAndGroupActions(actions, filters), [actions, filters])
  const selected = actions.find((row) => rowId(row) === selectedId)
  const subject = selected ? actionSubject(selected) : null
  const siblings = selected ? actions.filter((row) => actionSubject(row).key === subject?.key) : []
  const reference = selected ? actionReference(selected) : null
  const context = recordValue(selected?.request_context)
  const metadata = recordValue(selected?.metadata)
  const comments = Array.isArray(metadata.issue_comments) ? metadata.issue_comments.map(recordValue) : []
  const isTask = reference && ["ONBOARDING_TASK", "OFFBOARDING_TASK"].includes(reference.type)
  const isApproval = reference && ["ONBOARDING_REQUEST", "OFFBOARDING_REQUEST", "LEAVE_REQUEST"].includes(reference.type) &&
    readString(selected, ["actionType", "action_type"]).toUpperCase() === "APPROVAL"
  const canAct = selected && isOpenAction(selected) && selected.is_actionable !== false && Boolean(reference?.requestId)
  const modules = [...new Set(actions.map((row) => readString(row, ["sourceModule", "source_module"])).filter(Boolean))].sort()
  const pages = Math.max(1, Math.ceil(groups.length / 12))
  const currentPage = Math.min(groupPage, pages)
  const evidenceRequired = context.completion_evidence_required === true
  const requestId = reference?.requestId
  const sourceType = reference?.type
  const advancedFilterCount = [filters.module, filters.kind, filters.priority, filters.due]
    .filter((value) => value !== "all").length
  const resultItemCount = groups.reduce((total, group) => total + group.items.length, 0)
  const hasSearchOrAdvancedFilters = Boolean(filters.search.trim()) || advancedFilterCount > 0
  const hasActiveFilters = hasSearchOrAdvancedFilters || filters.status !== defaultInboxFilters.status

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

  function updateFilter(key: keyof InboxFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setGroupPage(1)
  }
  function select(row: AdminRecord) {
    setSelectedId(rowId(row))
    setComment("")
    setEvidenceId("")
    setError("")
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
      const data = { comments: comment.trim(), approve: mode === "approve" }
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
        onboardingResult = await (mode === "approve" ? approveOnboardingRequest : rejectOnboardingRequest)(token, reference.requestId, data)
      } else if (reference.type === "OFFBOARDING_REQUEST") {
        await (mode === "approve" ? approveOffboardingRequest : rejectOffboardingRequest)(token, reference.requestId, data)
      } else if (reference.type === "LEAVE_REQUEST") {
        await leaveRequestApprovalAction(token, reference.requestId, { action: mode, comments: comment.trim() })
      } else {
        throw new Error("Open the full request to review this action.")
      }
      toast.success(onboardingActionMessage(onboardingResult, mode === "issue" ? "Issue saved and sent to HR. The item remains open." : mode === "complete" ? "Checklist item completed." : mode === "approve" ? "Request approved." : "Request declined."))
      setComment("")
      setEvidenceId("")
      await onRefresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save. Please try again.")
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 border-y bg-card py-2">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <div className="min-w-56 flex-1 sm:w-64 sm:flex-none">
            <Input
              type="search"
              size="medium"
              aria-label="Search requests"
              placeholder="Search requests"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              contentBefore={<Search aria-hidden />}
            />
          </div>
          <div className="w-40 shrink-0">
            <FluentSelect
              ariaLabel="Filter by status"
              size="small"
              value={filters.status}
              onChange={(value) => updateFilter("status", value)}
              options={[{ value: "open", label: "Awaiting action" }, { value: "all", label: "All statuses" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 shrink-0 gap-1.5", (filtersOpen || advancedFilterCount > 0) && "border-primary/40 bg-primary/5 text-primary")}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal data-icon="inline-start" aria-hidden />
            Filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
            <ChevronDown data-icon="inline-end" className={cn("transition-transform", filtersOpen && "rotate-180")} aria-hidden />
          </Button>
          {resultItemCount > 0 ? <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">{resultItemCount} {resultItemCount === 1 ? "item" : "items"}</span> : <span className="ml-auto" />}
          {hasSearchOrAdvancedFilters ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search and filters"
              title="Clear search and filters"
              onClick={() => { setFilters(defaultInboxFilters); setGroupPage(1); setFiltersOpen(false) }}
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>
        {filtersOpen ? <div className="grid gap-2 border-t px-1 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <FluentSelect ariaLabel="Filter by request type" size="small" value={filters.module} onChange={(value) => updateFilter("module", value)} options={[{ value: "all", label: "All request types" }, ...modules.map((value) => ({ value, label: prettify(value) }))]} />
          <FluentSelect ariaLabel="Filter by action" size="small" value={filters.kind} onChange={(value) => updateFilter("kind", value)} options={[{ value: "all", label: "All actions" }, { value: "APPROVAL", label: "Approvals" }, { value: "TASK", label: "Checklist tasks" }]} />
          <FluentSelect ariaLabel="Filter by priority" size="small" value={filters.priority} onChange={(value) => updateFilter("priority", value)} options={[{ value: "all", label: "All priorities" }, ...["URGENT", "HIGH", "MEDIUM", "LOW"].map((value) => ({ value, label: prettify(value) }))]} />
          <FluentSelect ariaLabel="Filter by due date" size="small" value={filters.due} onChange={(value) => updateFilter("due", value)} options={[{ value: "all", label: "Any due date" }, { value: "overdue", label: "Overdue" }, { value: "today", label: "Due today" }, { value: "none", label: "No due date" }]} />
        </div> : null}
      </div>
      {loading ? <p role="status" className="py-10 text-center text-muted-foreground">Loading assigned requests…</p> : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="font-semibold">{hasActiveFilters ? "No results" : "You’re all caught up"}</h2>
          {hasActiveFilters ? <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setFilters(defaultInboxFilters); setGroupPage(1); setFiltersOpen(false) }}>Clear filters</Button> : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.slice((currentPage - 1) * 12, currentPage * 12).map((group) => (
            <article key={group.subject.key} className="relative flex flex-col overflow-hidden rounded-xl border border-primary/20 bg-card shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary hover:-translate-y-px hover:shadow-md">
              <div className="flex items-start gap-3 border-b border-border/70 bg-primary/5 px-5 py-4">
                <Avatar name={group.subject.name} color="brand" size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Requested for</p>
                  <h2 className="mt-0.5 truncate text-lg font-semibold text-foreground">{group.subject.name}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{[group.subject.number, group.subject.department, group.subject.position].filter(Boolean).join(" · ") || "Employee details not provided"}</p>
                </div>
                <FluentBadge appearance="tint" color="brand" shape="rounded" size="medium">
                  {group.items.length} {group.items.length === 1 ? "item" : "items"}
                </FluentBadge>
              </div>
              <ul className="flex flex-col gap-2 px-5 py-4 text-sm">
                {group.items.slice(0, 3).map((row) => (
                  <li key={rowId(row)} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-background [&_svg]:size-5">
                      <ClipboardTaskColor aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{readString(row, ["title"], "Assigned request")}</span>
                    <Badge variant="secondary" className="shrink-0">{prettify(readString(row, ["sourceModule", "source_module"]))}</Badge>
                  </li>
                ))}
                {group.items.length > 3 ? <li className="px-3 text-xs text-muted-foreground">+{group.items.length - 3} more items</li> : null}
              </ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/15 px-5 py-3">
                <FluentBadge appearance="tint" color="warning" shape="rounded" size="medium">
                  {group.items.filter(isOpenAction).length} awaiting action
                </FluentBadge>
                <Button size="sm" className="gap-2" onClick={() => select(group.items[0])}>
                  Review requests
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {pages > 1 ? <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={currentPage === 1} onClick={() => setGroupPage(currentPage - 1)}>Previous</Button><span className="text-sm">{currentPage} / {pages}</span><Button variant="outline" disabled={currentPage === pages} onClick={() => setGroupPage(currentPage + 1)}>Next</Button></div> : null}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !busy) setSelectedId("") }}>
        <DialogPopup className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Requests for {subject?.name}</DialogTitle>
            <DialogDescription>{[subject?.number, subject?.department, subject?.position].filter(Boolean).join(" · ") || "Review the intended recipient before completing or approving any item."}</DialogDescription>
          </DialogHeader>
          {selected ? <div className="grid min-h-0 shrink-0 gap-5 px-5 pb-3 md:grid-cols-[220px_1fr]">
            <div className="md:hidden">
              <FluentSelect label="Employee requests" value={selectedId} disabled={busy} onChange={(value) => { const row = siblings.find((item) => rowId(item) === value); if (row) select(row) }} options={siblings.map((row) => ({ value: rowId(row), label: readString(row, ["title"], "Request") }))} />
            </div>
            <nav aria-label="Employee requests" className="hidden max-h-80 flex-col gap-2 overflow-auto md:flex">
              {siblings.map((row) => <button key={rowId(row)} type="button" disabled={busy} onClick={() => select(row)} aria-current={rowId(row) === selectedId ? "true" : undefined} className={cn("rounded-lg border p-3 text-left text-sm", rowId(row) === selectedId ? "border-primary bg-muted" : "hover:bg-muted")}>
                <span className="block font-medium">{readString(row, ["title"], "Request")}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{prettify(readString(row, ["sourceModule", "source_module"]))} · {prettify(readString(row, ["status"], "OPEN"))}</span>
              </button>)}
            </nav>
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{readString(selected, ["title"])}</h3><StatusChip value={readString(selected, ["status"], "OPEN")} /></div>
              <div className="rounded-lg bg-muted p-3 text-sm"><span className="text-muted-foreground">Provide this item / service to: </span><strong>{subject?.name}</strong>{subject?.number ? ` (${subject.number})` : ""}</div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{readString(selected, ["description"]) || "Review this assigned item and record your decision below."}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Due</dt><dd>{formatDate(selected.dueAt ?? selected.due_at)}</dd></div>
                <div><dt className="text-muted-foreground">Priority</dt><dd>{prettify(readString(selected, ["priority"], "MEDIUM"))}</dd></div>
                {context.reason ? <div className="col-span-2"><dt className="text-muted-foreground">Request reason</dt><dd className="whitespace-pre-wrap">{String(context.reason)}</dd></div> : null}
                {context.start_date ? <div className="col-span-2"><dt className="text-muted-foreground">Requested dates</dt><dd>{formatDate(context.start_date)} – {formatDate(context.end_date)}</dd></div> : null}
              </dl>
              {selected.is_actionable === false && isOpenAction(selected) ? <Alert><AlertDescription>This item is waiting for an earlier workflow step. You can still report an issue to HR.</AlertDescription></Alert> : null}
              {comments.length ? <section className="flex flex-col gap-2"><h4 className="text-sm font-medium">Reported issues</h4>{comments.map((entry, index) => <div key={readString(entry, ["id"], String(index))} className="rounded-lg border p-3"><p className="whitespace-pre-wrap text-sm">{readString(entry, ["comment"])}</p><p className="mt-1 text-xs text-muted-foreground">{readString(entry, ["author"])} · {formatDate(entry.created_at)}</p></div>)}</section> : null}
              {isOpenAction(selected) ? <>
                {isTask && evidenceRequired ? <div className="flex flex-col gap-2">
                  <FluentSelect label="Supporting document" value={evidenceId} onChange={setEvidenceId} disabled={busy || documentsLoading} placeholder={documentsLoading ? "Loading documents…" : "Select an attached document"} options={documents.map((document) => ({ value: rowId(document), label: readString(document, ["title", "name", "file_name", "document_type"], "Supporting document") }))} />
                  {documentsError || (!documentsLoading && documents.length === 0) ? <p className="text-sm text-muted-foreground">{documentsError || "No supporting documents are attached. Open the full request or ask HR to attach the required evidence."}</p> : null}
                </div> : null}
                <Field label="Comment or reason" hint="For example: We cannot provide a laptop because stock is unavailable. Reporting an issue keeps the item open.">
                  <Textarea aria-label="Comment or reason" value={comment} maxLength={1000} onChange={(event) => setComment(event.target.value)} disabled={busy} placeholder="Add completion notes, or explain what is preventing you from proceeding…" />
                </Field>
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {isApproval ? <><Button disabled={!canAct || busy || loading} onClick={() => void submit("approve")}>Approve request</Button><Button variant="outline" disabled={!canAct || busy || loading} onClick={() => void submit("reject")}>Decline with reason</Button></> : null}
                  {isTask ? <Button disabled={!canAct || busy || loading} onClick={() => void submit("complete")}>Mark item complete</Button> : null}
                  <Button variant="outline" disabled={busy || loading} onClick={() => void submit("issue")}>{busy ? "Saving…" : "Report issue to HR"}</Button>
                </div>
              </> : null}
              {readString(selected, ["actionUrl", "action_url"]).startsWith("/") && !readString(selected, ["actionUrl", "action_url"]).startsWith("//") ? <a className="text-sm text-primary underline" href={readString(selected, ["actionUrl", "action_url"])}>Open full request</a> : null}
            </div>
          </div> : null}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setSelectedId("")}>Close</Button></DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
