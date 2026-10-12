"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import {
  HeroBand,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
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
import {
  addMyFieldVisitEvidence,
  addMyFieldVisitExpense,
  cancelMyFieldFollowUp,
  checkInMyFieldVisit,
  checkOutMyFieldVisit,
  completeMyFieldFollowUp,
  createMyFieldFollowUp,
  createMyFieldVisitPlan,
  createMyUnplannedFieldVisit,
  listFieldParties,
  listMyFieldFollowUps,
  listMyFieldVisitPlans,
  listMyFieldVisits,
  updateMyFieldFollowUp,
  submitMyFieldVisitPlan,
  syncMyFieldWork,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type FieldSelfTab = "visits" | "plans" | "follow-ups"

const VISIT_TYPES = [
  "CUSTOMER_VISIT",
  "PROSPECT_VISIT",
  "BROKER_VISIT",
  "RENEWAL_FOLLOW_UP",
  "COLLECTION_FOLLOW_UP",
  "OTHER",
] as const

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`
}

async function currentPosition() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error("Could not read your location.")),
    )
  })
}

export function FieldSelfView({ activeTab }: { activeTab: FieldSelfTab }) {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [visits, setVisits] = React.useState<AdminRecord[]>([])
  const [plans, setPlans] = React.useState<AdminRecord[]>([])
  const [followUps, setFollowUps] = React.useState<AdminRecord[]>([])
  const [parties, setParties] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"plan" | "unplanned" | "expense" | "checkout" | "evidence" | "follow-up" | "complete-follow-up">("plan")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState("")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const tasks = [
      listMyFieldVisits(token).then(setVisits).catch((errorObject) => {
        setVisits([])
        throw errorObject
      }),
      listMyFieldVisitPlans(token).then(setPlans).catch(() => setPlans([])),
      listMyFieldFollowUps(token).then(setFollowUps).catch(() => setFollowUps([])),
      listFieldParties(token).then(setParties).catch(() => setParties([])),
    ]
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load your field visits.")
    }
    setLoading(false)
  }, [leaveIfForbidden])

  React.useEffect(() => {
    void load()
  }, [load])

  async function onCheckIn(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`in-${id}`)
    try {
      const position = await currentPosition()
      await checkInMyFieldVisit(token, id, {
        client_request_id: newRequestId(),
        captured_at: new Date().toISOString(),
        latitude: position.latitude,
        longitude: position.longitude,
      })
      toast.success("Checked in.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Check-in failed.")
    } finally {
      setBusyId("")
    }
  }

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "plan") {
        if (!form.visit_date || !form.purpose) throw new Error("Visit date and purpose are required.")
        await createMyFieldVisitPlan(token, {
          visit_date: form.visit_date,
          plan_summary: form.plan_summary || undefined,
          items: [
            {
              field_party_id: form.field_party_id ? Number(form.field_party_id) : undefined,
              visit_type: form.visit_type || "CUSTOMER_VISIT",
              purpose: form.purpose,
            },
          ],
        })
      } else if (createMode === "unplanned") {
        if (!form.visit_date || !form.purpose || !form.unplanned_reason) {
          throw new Error("Date, purpose, and reason are required.")
        }
        await createMyUnplannedFieldVisit(token, {
          visit_date: form.visit_date,
          visit_type: form.visit_type || "CUSTOMER_VISIT",
          purpose: form.purpose,
          unplanned_reason: form.unplanned_reason,
          field_party_id: form.field_party_id ? Number(form.field_party_id) : undefined,
          client_request_id: newRequestId(),
        })
      } else if (createMode === "expense") {
        if (!form.id || !form.amount || !form.description) throw new Error("Amount and description are required.")
        await addMyFieldVisitExpense(token, form.id, {
          expense_type: form.expense_type || "TRANSPORT",
          amount: form.amount,
          currency: form.currency || "TZS",
          description: form.description,
        })
      } else if (createMode === "evidence") {
        if (!form.id || !form.document_id) throw new Error("Document id is required.")
        await addMyFieldVisitEvidence(token, form.id, {
          evidence_type: form.evidence_type || "DOCUMENT",
          document_id: Number(form.document_id),
          description: form.description || undefined,
          client_request_id: newRequestId(),
        })
      } else if (createMode === "checkout") {
        if (!form.id || !form.discussion_notes || !form.outcome) throw new Error("Notes and outcome are required.")
        if (form.follow_up_required === "true" && !form.next_follow_up_date) throw new Error("Follow-up due date is required.")
        const position = await currentPosition()
        await checkOutMyFieldVisit(token, form.id, {
          client_request_id: newRequestId(),
          captured_at: new Date().toISOString(),
          latitude: position.latitude,
          longitude: position.longitude,
          discussion_notes: form.discussion_notes,
          outcome: form.outcome,
          follow_up_required: form.follow_up_required === "true",
          next_follow_up_date: form.follow_up_required === "true" ? form.next_follow_up_date || undefined : undefined,
        })
      } else if (createMode === "follow-up") {
        if (!form.field_visit_id || !form.due_date || !form.action?.trim()) {
          throw new Error("Visit, due date, and action are required.")
        }
        if (form.id) {
          await updateMyFieldFollowUp(token, form.id, {
            due_date: form.due_date,
            action: form.action.trim(),
          })
        } else {
          await createMyFieldFollowUp(token, {
            field_visit_id: Number(form.field_visit_id),
            due_date: form.due_date,
            action: form.action.trim(),
          })
        }
      } else if (createMode === "complete-follow-up") {
        if (!form.id) throw new Error("Follow-up is required.")
        await completeMyFieldFollowUp(token, form.id, {
          completion_note: form.completion_note?.trim() || undefined,
        })
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

  const rows = activeTab === "plans" ? plans : activeTab === "follow-ups" ? followUps : visits
  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "follow-ups") {
      return [
        { key: "follow", label: "Follow-up", render: (row) => readString(row, ["action", "title", "note", "description"], `Follow-up #${rowId(row)}`) },
        { key: "due", label: "Due", render: (row) => formatDate(row.dueDate ?? row.due_date) },
        { key: "visit", label: "Visit", render: (row) => readString(row, ["fieldVisitId", "field_visit_id"], "—") },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            const open = readString(row, ["status"], "OPEN").toUpperCase() === "OPEN"
            if (!open) return <span className="text-xs text-muted-foreground">—</span>
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    setCreateMode("complete-follow-up")
                    setForm({ id, completion_note: "" })
                    setFormError(null)
                    setCreateOpen(true)
                  }}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    setCreateMode("follow-up")
                    setForm({
                      id,
                      field_visit_id: readString(row, ["fieldVisitId", "field_visit_id"]),
                      due_date: String(row.dueDate ?? row.due_date ?? "").slice(0, 10),
                      action: readString(row, ["action"]),
                    })
                    setFormError(null)
                    setCreateOpen(true)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `cancel-${id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    const token = readStoredToken()
                    if (!token || !id) return
                    setBusyId(`cancel-${id}`)
                    void cancelMyFieldFollowUp(token, id)
                      .then(() => { toast.success("Follow-up cancelled."); return load() })
                      .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not cancel."))
                      .finally(() => setBusyId(""))
                  }}
                >
                  {busyId === `cancel-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Cancel"}
                </button>
              </div>
            )
          },
        },
      ]
    }
    if (activeTab === "plans") {
      return [
        { key: "plan", label: "Plan", render: (row) => readString(row, ["planSummary", "plan_summary"], `Plan #${rowId(row)}`) },
        { key: "date", label: "Date", render: (row) => formatDate(row.visitDate ?? row.visit_date) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            return (
              <button type="button" className={actionButtonClass} disabled={busyId === id} onClick={(event) => {
                event.stopPropagation()
                const token = readStoredToken()
                if (!token || !id) return
                setBusyId(id)
                void submitMyFieldVisitPlan(token, id)
                  .then(() => { toast.success("Plan submitted."); return load() })
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not submit."))
                  .finally(() => setBusyId(""))
              }}>Submit</button>
            )
          },
        },
      ]
    }
    return [
      { key: "visit", label: "Visit", render: (row) => prettify(readString(row, ["visitType", "visit_type", "purpose"], `Visit #${rowId(row)}`)) },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
      { key: "date", label: "Date", render: (row) => formatDate(row.visitDate ?? row.visit_date) },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row)
          return (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={actionButtonClass} disabled={busyId === `in-${id}`} onClick={(event) => { event.stopPropagation(); void onCheckIn(row) }}>
                {busyId === `in-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Check in"}
              </button>
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setCreateMode("checkout")
                setForm({ id, discussion_notes: "", outcome: "", follow_up_required: "false" })
                setCreateOpen(true)
              }}>Check out</button>
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setCreateMode("expense")
                setForm({ id, expense_type: "TRANSPORT", currency: "TZS" })
                setCreateOpen(true)
              }}>Expense</button>
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setCreateMode("evidence")
                setForm({ id, evidence_type: "DOCUMENT" })
                setCreateOpen(true)
              }}>Evidence</button>
            </div>
          )
        },
      },
    ]
  }, [activeTab, busyId, load])

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "visits" ? (
        <HeroBand
          eyebrow="My field"
          title="Today's visits"
          description="Check in, add expenses, and close the visit when you leave the site."
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
              <button type="button" className={actionButtonClass} onClick={() => {
                const token = readStoredToken()
                if (!token) return
                void syncMyFieldWork(token, {
                  sync_request_id: newRequestId(),
                  device_identifier: "web-dashboard",
                  items: [],
                }).then(() => toast.success("Field sync queued.")).catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Sync failed."))
              }}>Sync</button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{activeTab === "plans" ? "Visit plans" : "Follow-ups"}</h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "plans" ? "Plan the day and submit it for review." : "Create, update, complete, or cancel follow-ups from your visits."}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        </div>
      )}

      {activeTab === "visits" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Visits" value={visits.length} />
          <MetricTile label="Plans" value={plans.length} />
          <MetricTile label="Follow-ups" value={followUps.length} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {activeTab === "visits" ? (
          <button type="button" className={primaryButtonClass} onClick={() => { setCreateMode("unplanned"); setForm({ visit_type: "CUSTOMER_VISIT", visit_date: new Date().toISOString().slice(0, 10) }); setCreateOpen(true) }}>
            <PlusIcon className="size-4" /> Unplanned visit
          </button>
        ) : null}
        {activeTab === "plans" ? (
          <button type="button" className={primaryButtonClass} onClick={() => { setCreateMode("plan"); setForm({ visit_type: "CUSTOMER_VISIT", visit_date: new Date().toISOString().slice(0, 10) }); setCreateOpen(true) }}>
            <PlusIcon className="size-4" /> New plan
          </button>
        ) : null}
        {activeTab === "follow-ups" ? (
          <button type="button" className={primaryButtonClass} onClick={() => {
            setCreateMode("follow-up")
            setForm({
              due_date: new Date().toISOString().slice(0, 10),
              field_visit_id: visits[0] ? rowId(visits[0]) : "",
              action: "",
            })
            setFormError(null)
            setCreateOpen(true)
          }}>
            <PlusIcon className="size-4" /> New follow-up
          </button>
        ) : null}
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My field records"
          data={rows}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey={`me-field-${activeTab}`}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {createMode === "plan" ? "New visit plan" : createMode === "unplanned" ? "Unplanned visit" : createMode === "expense" ? "Visit expense" : createMode === "evidence" ? "Visit evidence" : createMode === "follow-up" ? (form.id ? "Edit follow-up" : "New follow-up") : createMode === "complete-follow-up" ? "Complete follow-up" : "Check out"}
            </DialogTitle>
            <DialogDescription>Add or update this field visit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "plan" || createMode === "unplanned" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Visit date</span><DateInput className={inputClass} value={form.visit_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, visit_date: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    className="w-full"
                    value={form.visit_type ?? "CUSTOMER_VISIT"}
                    onChange={(value) => setForm((current) => ({ ...current, visit_type: value }))}
                    options={VISIT_TYPES.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Party</span>
                  <FluentSelect
                    ariaLabel="Party"
                    className="w-full"
                    value={form.field_party_id ?? ""}
                    onChange={(value) => setForm((current) => ({ ...current, field_party_id: value }))}
                    placeholder="None"
                    options={[
                      { value: "", label: "None" },
                      ...parties.map((party) => ({ value: rowId(party), label: optionLabel(party) })),
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Purpose</span><Textarea className={textareaClass} value={form.purpose ?? ""} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "unplanned" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Why unplanned</span><Textarea className={textareaClass} value={form.unplanned_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, unplanned_reason: event.target.value }))} /></label>
            ) : null}
            {createMode === "expense" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Amount</span><input className={inputClass} value={form.amount ?? ""} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><input className={inputClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "evidence" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Document id</span><input className={inputClass} value={form.document_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, document_id: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    className="w-full"
                    value={form.evidence_type ?? "DOCUMENT"}
                    onChange={(value) => setForm((current) => ({ ...current, evidence_type: value }))}
                    options={[
                      { value: "DOCUMENT", label: "Document" },
                      { value: "PHOTO", label: "Photo" },
                      { value: "MEETING_NOTE", label: "Meeting note" },
                      { value: "RECEIPT", label: "Receipt" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                </label>
              </>
            ) : null}
            {createMode === "checkout" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Discussion notes</span><Textarea className={textareaClass} value={form.discussion_notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, discussion_notes: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Outcome</span><input className={inputClass} value={form.outcome ?? ""} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /></label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-sky-700" checked={form.follow_up_required === "true"} onChange={(event) => setForm((current) => ({ ...current, follow_up_required: event.target.checked ? "true" : "false" }))} />
                  <span>Create a follow-up from this visit</span>
                </label>
                {form.follow_up_required === "true" ? (
                  <label className="grid gap-1.5 text-sm"><span className="font-medium">Follow-up due date</span><DateInput className={inputClass} value={form.next_follow_up_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, next_follow_up_date: event.target.value }))} /></label>
                ) : null}
              </>
            ) : null}
            {createMode === "follow-up" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Linked visit</span>
                  <FluentSelect
                    ariaLabel="Linked visit"
                    className="w-full"
                    value={form.field_visit_id ?? ""}
                    disabled={Boolean(form.id)}
                    onChange={(value) => setForm((current) => ({ ...current, field_visit_id: value }))}
                    placeholder="Choose a visit"
                    options={[
                      { value: "", label: "Choose a visit" },
                      ...visits.map((visit) => ({
                        value: rowId(visit),
                        label: `${prettify(readString(visit, ["visitType", "visit_type", "purpose"], `Visit #${rowId(visit)}`))} · ${formatDate(visit.visitDate ?? visit.visit_date)}`,
                      })),
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Due date</span><DateInput className={inputClass} value={form.due_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Action</span><Textarea className={textareaClass} value={form.action ?? ""} onChange={(event) => setForm((current) => ({ ...current, action: event.target.value }))} placeholder="What needs to happen next?" /></label>
              </>
            ) : null}
            {createMode === "complete-follow-up" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Completion note</span><Textarea className={textareaClass} value={form.completion_note ?? ""} onChange={(event) => setForm((current) => ({ ...current, completion_note: event.target.value }))} placeholder="What was done?" /></label>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
