"use client"

import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "@/components/ui/fluent-toast-store"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  MetricTile,
  StatusChip,
  StatusStack,
  TalentDoodleSprites,
  actionButtonClass,
  employeeLabel,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  statusChartItems,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  createActivityCategory,
  createActivityPolicy,
  deactivateActivityCategory,
  updateActivityCategory,
  updateActivityPolicy,
  getManagerActivitiesDashboard,
  getManagerActivityReport,
  listActivityCategories,
  listActivityPolicies,
  listHrActivities,
  listHrActivityExceptions,
  listManagerPendingActivityReviews,
  listManagerTeamActivities,
  reviewManagerActivityReport,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type ActivityOpsTab = "overview" | "reports" | "reviews" | "exceptions" | "setup"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function ActivityOperationsView({ activeTab }: { activeTab: ActivityOpsTab }) {
  const actor = useDashboardActor()
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/activities/overview", actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [reports, setReports] = React.useState<AdminRecord[]>([])
  const [teamReports, setTeamReports] = React.useState<AdminRecord[]>([])
  const [pending, setPending] = React.useState<AdminRecord[]>([])
  const [exceptions, setExceptions] = React.useState<AdminRecord[]>([])
  const [categories, setCategories] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"review" | "category" | "policy">("review")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [setupKind, setSetupKind] = React.useState<"categories" | "policies">("categories")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const tasks: Array<Promise<unknown>> = []
    if (activeTab === "overview") {
      tasks.push(
        getManagerActivitiesDashboard(token).then(setDashboard).catch(() => setDashboard(null)),
        listHrActivities(token, { limit: 50 }).then(setReports).catch(() => setReports([])),
        listManagerPendingActivityReviews(token, { limit: 20 }).then(setPending).catch(() => setPending([])),
      )
    }
    if (activeTab === "reports") {
      tasks.push(
        listHrActivities(token, { limit: 50 }).then(setReports).catch(() => setReports([])),
        listManagerTeamActivities(token, { limit: 50 }).then(setTeamReports).catch(() => setTeamReports([])),
      )
    }
    if (activeTab === "reviews") {
      tasks.push(
        listManagerPendingActivityReviews(token, { limit: 50 }).then(setPending).catch((errorObject) => {
          setPending([])
          throw errorObject
        }),
      )
    }
    if (activeTab === "exceptions") {
      tasks.push(
        listHrActivityExceptions(token, { limit: 50 }).then(setExceptions).catch((errorObject) => {
          setExceptions([])
          throw errorObject
        }),
      )
    }
    if (activeTab === "setup") {
      tasks.push(
        listActivityCategories(token).then(setCategories).catch(() => setCategories([])),
        listActivityPolicies(token).then(setPolicies).catch(() => setPolicies([])),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load activity data.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const reportRows = reports.length > 0 ? reports : teamReports
  const rows =
    activeTab === "reviews"
      ? pending
      : activeTab === "exceptions"
        ? exceptions
        : activeTab === "setup"
          ? setupKind === "policies"
            ? policies
            : categories
          : reportRows
  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "review") {
        if (!form.id || !form.decision || !form.comments) throw new Error("Decision and comments are required.")
        await reviewManagerActivityReport(token, form.id, {
          decision: form.decision,
          comments: form.comments,
          rating: form.rating || undefined,
        })
      } else if (createMode === "category") {
        if (!form.code || !form.name) throw new Error("Code and name are required.")
        const payload = {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          requires_time: form.requires_time === "true",
          requires_outcome: form.requires_outcome === "true",
          is_field_activity: form.is_field_activity === "true",
        }
        if (form.id) await updateActivityCategory(token, form.id, payload)
        else await createActivityCategory(token, payload)
      } else {
        if (!form.effective_from && !form.id) throw new Error("Effective from is required.")
        const payload = {
          effective_from: form.effective_from || undefined,
          daily_submission_required: form.daily_submission_required !== "false",
          manager_review_required: form.manager_review_required !== "false",
          minimum_activity_count: form.minimum_activity_count ? Number(form.minimum_activity_count) : undefined,
        }
        if (form.id) await updateActivityPolicy(token, form.id, payload)
        else await createActivityPolicy(token, payload)
      }
      toast.success("Saved.")
      setCreateOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "setup") {
      return [
        { key: "name", label: "Name", render: (row) => optionLabel(row) },
        { key: "code", label: "Code", render: (row) => readString(row, ["code"], "—") },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} /> },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setCreateMode(setupKind === "policies" ? "policy" : "category")
                setForm({
                  id: rowId(row),
                  code: readString(row, ["code"]),
                  name: readString(row, ["name"]),
                  description: readString(row, ["description"]),
                  effective_from: readString(row, ["effectiveFrom", "effective_from"]),
                })
                setCreateOpen(true)
              }}>Edit</button>
              {setupKind === "categories" ? (
                <button type="button" className={actionButtonClass} onClick={(event) => {
                  event.stopPropagation()
                  const token = readStoredToken()
                  const id = rowId(row)
                  if (!token || !id) return
                  void deactivateActivityCategory(token, id)
                    .then(() => { toast.success("Deactivated."); return load() })
                    .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not deactivate."))
                }}>Deactivate</button>
              ) : null}
            </div>
          ),
        },
      ]
    }
    if (activeTab === "exceptions") {
      return [
        { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
        { key: "date", label: "Date", render: (row) => formatDate(row.activityDate ?? row.activity_date ?? row.date) },
        { key: "reason", label: "Reason", render: (row) => readString(row, ["reason", "exceptionType", "exception_type", "message"], "—") },
      ]
    }
    return [
      {
        key: "report",
        label: "Report",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{employeeLabel(row)}</p>
            <p className="text-xs text-muted-foreground">{formatDate(row.activityDate ?? row.activity_date)}</p>
          </div>
        ),
      },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
      { key: "entries", label: "Entries", render: (row) => String(readNumber(row, ["entryCount", "entry_count", "entries_count"]) ?? "—") },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <button
            type="button"
            className={actionButtonClass}
            onClick={(event) => {
              event.stopPropagation()
              setCreateMode("review")
              setForm({ id: rowId(row), decision: "APPROVE", comments: "" })
              setCreateOpen(true)
            }}
          >
            Review
          </button>
        ),
      },
    ]
  }, [activeTab, load, setupKind])

  if (!canAccess) return null

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Activities"
            title="Daily activity operations"
            description="Team reports, pending manager reviews, and exceptions — shown only if you have the grant."
            actions={
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            }
          />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Reports" value={readNumber(dashboard, ["reports", "total", "count"]) ?? reports.length} />
            <MetricTile label="Pending reviews" value={readNumber(dashboard, ["pending_reviews", "pendingReviews"]) ?? pending.length} />
            <MetricTile label="Submitted" value={readNumber(dashboard, ["submitted", "submittedCount"]) ?? "—"} />
            <MetricTile label="Exceptions" value={readNumber(dashboard, ["exceptions", "exceptionCount"]) ?? "—"} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Report mix</h2>
            <div className="mt-4"><StatusStack items={statusChartItems(reports.length > 0 ? reports : pending)} /></div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "reports"
                ? "Activity reports"
                : activeTab === "reviews"
                  ? "Pending reviews"
                  : activeTab === "exceptions"
                    ? "Activity exceptions"
                    : "Activity setup"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "setup"
                ? "Categories and policies used by daily reports."
                : "Review and operate on activity records you are allowed to see."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            {activeTab === "setup" ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setCreateMode(setupKind === "policies" ? "policy" : "category")
                  setForm({})
                  setCreateOpen(true)
                }}
              >
                <PlusIcon className="size-4" /> New
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === "setup" ? (
        <div className="flex flex-wrap gap-1.5">
          {(["categories", "policies"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setSetupKind(kind)}
              className={setupKind === kind ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold !text-white" : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"}
            >
              {prettify(kind)}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Activity records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`activities-${activeTab}-${setupKind}`}
              onRowSelect={(_, row) => {
                if (!row) return
                setDetail(row)
                const token = readStoredToken()
                const id = rowId(row)
                if (token && id && (activeTab === "reports" || activeTab === "reviews")) {
                  void getManagerActivityReport(token, id)
                    .then((record) => record && setDetail(record))
                    .catch(() => undefined)
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail) || employeeLabel(detail)} row={detail} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup
          from="bottom"
          className="flex max-h-[calc(100dvh-0.75rem)] w-[calc(100%-0.75rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90dvh,42rem)] sm:w-[calc(100%-2rem)]"
        >
          <DialogHeader className="m-0 shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-5">
            <DialogTitle>{createMode === "review" ? "Review report" : createMode === "policy" ? "Activity policy" : "Activity category"}</DialogTitle>
            <DialogDescription>Save this activity setup item.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="grid gap-3">
            {createMode === "review" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Decision</span>
                  <FluentSelect
                    ariaLabel="Decision"
                    value={form.decision ?? "APPROVE"}
                    onChange={(value) => setForm((current) => ({ ...current, decision: value }))}
                    options={[
                      { value: "APPROVE", label: "Approve" },
                      { value: "RETURN", label: "Return" },
                      { value: "REJECT", label: "Reject" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Rating</span>
                  <input className={inputClass} value={form.rating ?? ""} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Comments</span>
                  <Textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
                </label>
              </>
            ) : null}
            {createMode === "category" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Code</span><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Name</span><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "policy" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Effective from</span><DateInput className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Minimum activities</span><input type="number" className={inputClass} value={form.minimum_activity_count ?? ""} onChange={(event) => setForm((current) => ({ ...current, minimum_activity_count: event.target.value }))} /></label>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
            </div>
          </div>
          <DialogFooter className="m-0 shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
