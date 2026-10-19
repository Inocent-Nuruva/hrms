"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import { EmployeeProfileRequiredState } from "@/components/dashboard/employee-profile-required-state"
import * as React from "react"
import {
  Button as FluentButton,
  Card as FluentCard,
  Text as FluentText,
} from "@fluentui/react-components"
import {
  Add20Regular,
  ArrowClockwise20Regular,
  ArrowSync20Regular,
} from "@fluentui/react-icons"
import { toast } from "@/components/ui/fluent-toast-store"

import {
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
  addMyFieldVisitOpportunity,
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
  getMyFieldVisitCommercialPolicy,
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
  const [commercialPolicy, setCommercialPolicy] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"plan" | "unplanned" | "expense" | "opportunity" | "checkout" | "evidence" | "follow-up" | "complete-follow-up">("plan")
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
      getMyFieldVisitCommercialPolicy(token).then(setCommercialPolicy).catch(() => setCommercialPolicy(null)),
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

  const onCheckIn = React.useCallback(async (row: AdminRecord) => {
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
  }, [load])

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
      } else if (createMode === "opportunity") {
        if (!form.id || !form.title?.trim()) throw new Error("Visit and opportunity title are required.")
        await addMyFieldVisitOpportunity(token, form.id, {
          opportunity_type: form.opportunity_type || "LEAD",
          title: form.title.trim(),
          description: form.description?.trim() || undefined,
          potential_value: form.potential_value ? Number(form.potential_value) : undefined,
          currency: form.currency?.trim().toUpperCase() || undefined,
          premium_value: form.premium_value ? Number(form.premium_value) : undefined,
          premium_currency: form.premium_value ? (form.premium_currency?.trim().toUpperCase() || form.currency?.trim().toUpperCase() || undefined) : undefined,
          expected_close_date: form.expected_close_date || undefined,
          source_system: form.source_system?.trim() || undefined,
          external_reference: form.external_reference?.trim() || undefined,
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
  const profileRequired = Boolean(error?.toLowerCase().includes("employee profile"))
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
      { key: "opportunities", label: "Opportunities", render: (row) => {
        const opportunities = Array.isArray(row.opportunities) ? row.opportunities as AdminRecord[] : []
        return opportunities.length ? opportunities.map((item) => `${readString(item, ["title"], "Opportunity")}${item.potentialValue || item.potential_value ? ` · ${readString(item, ["currency"], "")} ${readString(item, ["potentialValue", "potential_value"], "")}` : ""}${item.premiumValue || item.premium_value ? ` · Premium ${readString(item, ["premiumCurrency", "premium_currency"], "")} ${readString(item, ["premiumValue", "premium_value"], "")}` : ""}`).join("; ") : "—"
      } },
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
              {commercialPolicy?.allowEmployeeOpportunityValues !== false && commercialPolicy?.allow_employee_opportunity_values !== false ? <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setCreateMode("opportunity")
                const defaultCurrency = readString(commercialPolicy ?? {}, ["defaultCurrency", "default_currency"], "TZS")
                setForm({ id, opportunity_type: "LEAD", currency: defaultCurrency, premium_currency: defaultCurrency })
                setCreateOpen(true)
              }}>Opportunity</button> : null}
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
  }, [activeTab, busyId, commercialPolicy, load, onCheckIn])

  if (profileRequired) {
    return <EmployeeProfileRequiredState description="Field work uses your employee profile to connect visits, plans, and follow-ups to you. Finish the required details once, then return here to continue." returnLabel="My visits" completionNote="Your field work records will be available after your profile is ready." />
  }

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <header className="flex min-w-0 flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">My field work</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {activeTab === "visits" ? "Visits" : activeTab === "plans" ? "Visit plans" : "Follow-ups"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {activeTab === "visits"
              ? "Check in at a site, record expenses and evidence, then capture the outcome when you leave."
              : activeTab === "plans"
                ? "Plan upcoming site visits and submit your plan for review."
                : "Keep track of actions due after your visits and record them as complete."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {activeTab === "visits" ? (
            <FluentButton
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => {
                setCreateMode("unplanned")
                setForm({ visit_type: "CUSTOMER_VISIT", visit_date: new Date().toISOString().slice(0, 10) })
                setCreateOpen(true)
              }}
            >
              Unplanned visit
            </FluentButton>
          ) : activeTab === "plans" ? (
            <FluentButton
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => {
                setCreateMode("plan")
                setForm({ visit_type: "CUSTOMER_VISIT", visit_date: new Date().toISOString().slice(0, 10) })
                setCreateOpen(true)
              }}
            >
              New plan
            </FluentButton>
          ) : (
            <FluentButton
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => {
                setCreateMode("follow-up")
                setForm({
                  due_date: new Date().toISOString().slice(0, 10),
                  field_visit_id: visits[0] ? rowId(visits[0]) : "",
                  action: "",
                })
                setFormError(null)
                setCreateOpen(true)
              }}
            >
              New follow-up
            </FluentButton>
          )}
          {activeTab === "visits" ? (
            <FluentButton
              appearance="secondary"
              icon={<ArrowSync20Regular />}
              onClick={() => {
                const token = readStoredToken()
                if (!token) return
                void syncMyFieldWork(token, {
                  sync_request_id: newRequestId(),
                  device_identifier: "web-dashboard",
                  items: [],
                })
                  .then(() => toast.success("Field sync queued."))
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Sync failed."))
              }}
            >
              Sync
            </FluentButton>
          ) : null}
          <FluentButton
            appearance="subtle"
            icon={loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <ArrowClockwise20Regular />}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </FluentButton>
        </div>
      </header>

      {activeTab === "visits" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: "Visits", value: visits.length, hint: "Recorded site visits" },
            { label: "Plans", value: plans.length, hint: "Visit plans" },
            { label: "Follow-ups", value: followUps.length, hint: "Actions to track" },
          ].map((metric) => (
            <FluentCard key={metric.label} appearance="outline" className="flex min-w-0 items-center justify-between gap-3 !rounded-lg !px-3 !py-2.5">
              <div className="min-w-0">
                <FluentText size={200} weight="semibold" className="block uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </FluentText>
                <p className="mt-0.5 text-xs text-muted-foreground">{metric.hint}</p>
              </div>
              <span className="text-2xl font-semibold tabular-nums text-foreground">{metric.value}</span>
            </FluentCard>
          ))}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-foreground">Field work could not be loaded</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </div>
          <FluentButton appearance="secondary" size="small" onClick={() => void load()} disabled={loading}>
            Try again
          </FluentButton>
        </div>
      ) : null}

      <ResizableTable
          title="My field records"
          data={rows}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          fluent
          sortIconOnly
          frameClassName="!border-0 !bg-transparent !shadow-none"
          storageKey={`me-field-${activeTab}`}
        />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {createMode === "plan" ? "New visit plan" : createMode === "unplanned" ? "Unplanned visit" : createMode === "expense" ? "Visit expense" : createMode === "opportunity" ? "Record opportunity" : createMode === "evidence" ? "Visit evidence" : createMode === "follow-up" ? (form.id ? "Edit follow-up" : "New follow-up") : createMode === "complete-follow-up" ? "Complete follow-up" : "Check out"}
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
            {createMode === "opportunity" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Type</span><FluentSelect ariaLabel="Opportunity type" className="w-full" value={form.opportunity_type ?? "LEAD"} onChange={(value) => setForm((current) => ({ ...current, opportunity_type: value }))} options={["LEAD", "QUOTATION", "NEW_BUSINESS", "RENEWAL", "COLLECTION", "CROSS_SELL", "DORMANT_ACCOUNT_REVIVAL", "OTHER"].map((item) => ({ value: item, label: prettify(item) }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Title</span><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Details</span><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="font-medium">Potential sales value</span><input type="number" min="0" step="0.01" className={inputClass} value={form.potential_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, potential_value: event.target.value }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Sales currency</span><FluentSelect ariaLabel="Sales currency" className="w-full" value={form.currency ?? readString(commercialPolicy ?? {}, ["defaultCurrency", "default_currency"], "TZS")} onChange={(value) => setForm((current) => ({ ...current, currency: value }))} options={Array.isArray(commercialPolicy?.supportedCurrencies ?? commercialPolicy?.supported_currencies) ? ((commercialPolicy?.supportedCurrencies ?? commercialPolicy?.supported_currencies) as string[]).map((currency) => ({ value: currency, label: currency })) : [{ value: "TZS", label: "TZS" }]} /></label></div>
                <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="font-medium">Premium value (if applicable)</span><input type="number" min="0" step="0.01" className={inputClass} value={form.premium_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, premium_value: event.target.value }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Premium currency</span><FluentSelect ariaLabel="Premium currency" className="w-full" value={form.premium_currency ?? readString(commercialPolicy ?? {}, ["defaultCurrency", "default_currency"], "TZS")} onChange={(value) => setForm((current) => ({ ...current, premium_currency: value }))} options={Array.isArray(commercialPolicy?.supportedCurrencies ?? commercialPolicy?.supported_currencies) ? ((commercialPolicy?.supportedCurrencies ?? commercialPolicy?.supported_currencies) as string[]).map((currency) => ({ value: currency, label: currency })) : [{ value: "TZS", label: "TZS" }]} /></label></div>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Expected close</span><DateInput className={inputClass} value={form.expected_close_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, expected_close_date: event.target.value }))} /></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="font-medium">Source system (optional)</span><input className={inputClass} value={form.source_system ?? ""} onChange={(event) => setForm((current) => ({ ...current, source_system: event.target.value }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">External reference</span><input className={inputClass} value={form.external_reference ?? ""} onChange={(event) => setForm((current) => ({ ...current, external_reference: event.target.value }))} /></label></div>
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
