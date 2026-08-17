"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

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
  addMyFieldVisitExpense,
  checkInMyFieldVisit,
  checkOutMyFieldVisit,
  completeMyFieldFollowUp,
  createMyFieldVisitPlan,
  createMyUnplannedFieldVisit,
  listFieldParties,
  listMyFieldFollowUps,
  listMyFieldVisitPlans,
  listMyFieldVisits,
  submitMyFieldVisitPlan,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
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
  const [visits, setVisits] = React.useState<AdminRecord[]>([])
  const [plans, setPlans] = React.useState<AdminRecord[]>([])
  const [followUps, setFollowUps] = React.useState<AdminRecord[]>([])
  const [parties, setParties] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"plan" | "unplanned" | "expense" | "checkout">("plan")
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
      setError(first.reason instanceof Error ? first.reason.message : "Could not load your field visits.")
    }
    setLoading(false)
  }, [])

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
      } else if (createMode === "checkout") {
        if (!form.id || !form.discussion_notes || !form.outcome) throw new Error("Notes and outcome are required.")
        const position = await currentPosition()
        await checkOutMyFieldVisit(token, form.id, {
          client_request_id: newRequestId(),
          captured_at: new Date().toISOString(),
          latitude: position.latitude,
          longitude: position.longitude,
          discussion_notes: form.discussion_notes,
          outcome: form.outcome,
          follow_up_required: form.follow_up_required === "true",
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
        { key: "follow", label: "Follow-up", render: (row) => readString(row, ["title", "note", "description"], `Follow-up #${rowId(row)}`) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
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
                void completeMyFieldFollowUp(token, id, { completion_note: "Completed from dashboard." })
                  .then(() => { toast.success("Follow-up completed."); return load() })
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not complete."))
                  .finally(() => setBusyId(""))
              }}>{busyId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Complete"}</button>
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
                {busyId === `in-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Check in"}
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
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{activeTab === "plans" ? "Visit plans" : "Follow-ups"}</h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "plans" ? "Plan the day and submit it for review." : "Close the follow-ups left from earlier visits."}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
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
              {createMode === "plan" ? "New visit plan" : createMode === "unplanned" ? "Unplanned visit" : createMode === "expense" ? "Visit expense" : "Check out"}
            </DialogTitle>
            <DialogDescription>Uses the documented My Field Visit payloads.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "plan" || createMode === "unplanned" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Visit date</span><input type="date" className={inputClass} value={form.visit_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, visit_date: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Type</span>
                  <select className={inputClass} value={form.visit_type ?? "CUSTOMER_VISIT"} onChange={(event) => setForm((current) => ({ ...current, visit_type: event.target.value }))}>
                    {VISIT_TYPES.map((item) => <option key={item} value={item}>{prettify(item)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Party</span>
                  <select className={inputClass} value={form.field_party_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, field_party_id: event.target.value }))}>
                    <option value="">None</option>
                    {parties.map((party) => <option key={rowId(party)} value={rowId(party)}>{optionLabel(party)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Purpose</span><textarea className={textareaClass} value={form.purpose ?? ""} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "unplanned" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Why unplanned</span><textarea className={textareaClass} value={form.unplanned_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, unplanned_reason: event.target.value }))} /></label>
            ) : null}
            {createMode === "expense" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Amount</span><input className={inputClass} value={form.amount ?? ""} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><input className={inputClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "checkout" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Discussion notes</span><textarea className={textareaClass} value={form.discussion_notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, discussion_notes: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Outcome</span><input className={inputClass} value={form.outcome ?? ""} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /></label>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
