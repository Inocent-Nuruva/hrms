"use client"

import * as React from "react"
import { PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react"
import { fluentConfirm, fluentPrompt } from "@/components/ui/fluent-dialog-service"
import { useRecordForm, type RecordFormField } from "@/components/dashboard/profile-records/record-form-dialog"
import { adminRequest, type AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/fluent-toast-store"

export type ProfileRecordType =
  | "contact"
  | "address"
  | "relative"
  | "identification"
  | "bank_account"
  | "academic_qualification"
  | "professional_qualification"
  | "experience"

type FieldSpec = RecordFormField

const opts = (...values: string[]) =>
  values.map((value) => ({ value, label: value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) }))

/** Needs HR approval before it takes effect (create, edit or delete). */
export const SENSITIVE_RECORD_TYPES: ProfileRecordType[] = ["relative", "identification", "bank_account"]

export const RECORD_LABELS: Record<ProfileRecordType, string> = {
  contact: "Contact",
  address: "Address",
  relative: "Next of kin / relative",
  identification: "Identification",
  bank_account: "Bank account",
  academic_qualification: "Academic qualification",
  professional_qualification: "Professional qualification",
  experience: "Work experience",
}

const RECORD_FIELDS: Record<ProfileRecordType, FieldSpec[]> = {
  contact: [
    { name: "contact_type", label: "Contact type", required: true, defaultValue: "personal", options: opts("work", "personal", "mobile", "home", "whatsapp", "other") },
    { name: "phone_number", label: "Phone number" },
    { name: "email", label: "Email" },
    { name: "notes", label: "Notes" },
  ],
  address: [
    { name: "address_type", label: "Address type", required: true, defaultValue: "home", options: opts("home", "temporary", "work", "mailing", "other") },
    { name: "address_line_1", label: "Address line 1" },
    { name: "address_line_2", label: "Address line 2" },
    { name: "city", label: "City" },
    { name: "state", label: "State / region" },
    { name: "postal_code", label: "Postal code" },
    { name: "country", label: "Country" },
  ],
  relative: [
    { name: "full_name", label: "Full name", required: true },
    { name: "relationship", label: "Relationship", required: true },
    { name: "phone", label: "Phone" },
    { name: "email", label: "Email" },
    { name: "address", label: "Address" },
    { name: "occupation", label: "Occupation" },
  ],
  identification: [
    { name: "identification_type", label: "Identification type", required: true, defaultValue: "national_id", options: opts("national_id", "passport", "tax_id", "social_security", "driver_license", "work_permit", "other") },
    { name: "identification_number", label: "Number", required: true },
    { name: "issued_country", label: "Issuing country" },
    { name: "issuing_authority", label: "Issuing authority" },
    { name: "issue_date", label: "Issue date" },
    { name: "expiry_date", label: "Expiry date" },
  ],
  bank_account: [
    { name: "bank_name", label: "Bank name" },
    { name: "account_name", label: "Account name" },
    { name: "account_number", label: "Account number", required: true },
    { name: "branch_name", label: "Branch" },
    { name: "account_currency", label: "Currency", defaultValue: "TZS" },
    { name: "swift_code", label: "SWIFT code" },
  ],
  academic_qualification: [
    { name: "education_level", label: "Education level", required: true },
    { name: "institution_name", label: "Institution", required: true },
    { name: "degree_or_certificate", label: "Degree / certificate", required: true },
    { name: "field_of_study", label: "Field of study", required: true },
    { name: "country_of_residence", label: "Country", required: true },
    { name: "start_date", label: "Start date", required: true },
    { name: "end_date", label: "End date", required: true },
  ],
  professional_qualification: [
    { name: "programme_name", label: "Programme", required: true },
    { name: "institution_name", label: "Institution", required: true },
    { name: "issuing_organization", label: "Issuing organization", required: true },
    { name: "country_of_residence", label: "Country", required: true },
    { name: "issue_date", label: "Issue date", required: true },
    { name: "expiry_date", label: "Expiry date" },
  ],
  experience: [
    { name: "company_name", label: "Company", required: true },
    { name: "job_title", label: "Job title", required: true },
    { name: "responsibilities_description", label: "Responsibilities", required: true },
    { name: "start_date", label: "Start date", required: true },
    { name: "end_date", label: "End date", hint: "Leave empty if you still work there." },
  ],
}

// ───────────────────────────── API ─────────────────────────────

type ChangeResult = AdminRecord & { status?: string }

function unwrapList(payload: unknown): AdminRecord[] {
  if (Array.isArray(payload)) return payload as AdminRecord[]
  const inner = (payload as { data?: unknown } | null)?.data
  return Array.isArray(inner) ? (inner as AdminRecord[]) : []
}

async function unwrapOne(promise: Promise<unknown>): Promise<ChangeResult | null> {
  const payload = (await promise) as { data?: unknown; status?: unknown } | null
  if (payload && typeof payload.status !== 'string' && payload.data && typeof payload.data === 'object') {
    return payload.data as ChangeResult
  }
  return payload as ChangeResult | null
}

export function createMyRecord(token: string, type: ProfileRecordType, data: AdminRecord, reason?: string) {
  return unwrapOne(adminRequest<unknown>(`/api/me/profile-records/${type}`, {
    method: "POST",
    token,
    body: { data, reason },
  }))
}

function updateMyRecord(token: string, type: ProfileRecordType, id: number, data: AdminRecord, reason?: string) {
  return unwrapOne(adminRequest<unknown>(`/api/me/profile-records/${type}/${id}`, {
    method: "PATCH",
    token,
    body: { data, reason },
  }))
}

function deleteMyRecord(token: string, type: ProfileRecordType, id: number, reason?: string) {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : ""
  return unwrapOne(adminRequest<unknown>(`/api/me/profile-records/${type}/${id}${query}`, {
    method: "DELETE",
    token,
  }))
}

export function listMyRecordChanges(token: string) {
  return adminRequest<unknown>(`/api/me/profile-records/changes`, { token }).then(unwrapList)
}

function requestRollback(token: string, changeId: number, reason?: string) {
  return unwrapOne(adminRequest<unknown>(`/api/me/profile-records/changes/${changeId}/rollback`, {
    method: "POST",
    token,
    body: { reason },
  }))
}

function cancelMyChange(token: string, changeId: number) {
  return unwrapOne(adminRequest<unknown>(`/api/me/profile-records/changes/${changeId}/cancel`, {
    method: "POST",
    token,
  }))
}

export function listHrRecordChanges(token: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return adminRequest<unknown>(`/api/hr/profile-record-changes${query}`, { token }).then(unwrapList)
}

function reviewHrRecordChange(token: string, id: number, decision: "approve" | "reject", comment?: string) {
  return unwrapOne(adminRequest<unknown>(`/api/hr/profile-record-changes/${id}/${decision}`, {
    method: "POST",
    token,
    body: { comment },
  }))
}

// ─────────────────────────── helpers ───────────────────────────

function toInputValue(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text
}

function cleanForm(values: Record<string, string>, editing: boolean): AdminRecord {
  const out: AdminRecord = {}
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim()
    if (value) out[key] = value
    else if (editing) out[key] = null
  }
  return out
}

function resultMessage(result: ChangeResult | null, verb: string) {
  return result?.status === "PENDING_HR"
    ? `Sent to HR for approval. The ${verb} takes effect once HR approves it.`
    : `Saved.`
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

export function recordIdOf(record: AdminRecord | null | undefined) {
  const id = Number(record?.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

// ───────────────────────────── UI ─────────────────────────────

type Notify = (message: string, tone: "success" | "error") => void
const defaultNotify: Notify = (message, tone) => toast[tone](message)

async function askReason(type: ProfileRecordType, action: string) {
  if (!SENSITIVE_RECORD_TYPES.includes(type)) return ""
  const reason = await fluentPrompt(
    `HR needs to approve this ${action}. Add a short reason (optional).`,
    "",
    { title: "Reason for HR", confirmLabel: "Continue" },
  )
  return reason === null ? null : reason
}

/** "Add" button for a section. */
export function AddProfileRecordButton({
  type,
  token,
  onChanged,
  notify = defaultNotify,
  className,
}: {
  type: ProfileRecordType
  token: string
  onChanged: () => void | Promise<void>
  notify?: Notify
  className?: string
}) {
  const [busy, setBusy] = React.useState(false)
  const sensitive = SENSITIVE_RECORD_TYPES.includes(type)
  const form = useRecordForm()

  const handleAdd = async () => {
    const result = await form.open(RECORD_FIELDS[type], {
      title: `Add ${RECORD_LABELS[type]} Record`,
      description: sensitive
        ? "Fill in the details. HR will review this before it appears on your profile."
        : `Fill in the details to add a new ${RECORD_LABELS[type].toLowerCase()} record.`,
      confirmLabel: sensitive ? "Send to HR" : "Add",
      reasonLabel: sensitive ? "Reason for HR" : undefined,
    })
    if (!result) return
    const { values, reason } = result
    setBusy(true)
    try {
      const result = await createMyRecord(token, type, cleanForm(values, false), reason || undefined)
      notify(resultMessage(result, "addition"), "success")
      await onChanged()
    } catch (error) {
      notify(errorText(error), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    {form.dialog}
    <button
      type="button"
      onClick={() => void handleAdd()}
      disabled={busy || !token}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50",
        className,
      )}
    >
      <PlusIcon className="size-3.5" aria-hidden="true" />
      Add
    </button>
    </>
  )
}

/** Edit / delete buttons for one record. */
export function ProfileRecordActions({
  type,
  record,
  token,
  onChanged,
  notify = defaultNotify,
  pending,
}: {
  type: ProfileRecordType
  record: AdminRecord
  token: string
  onChanged: () => void | Promise<void>
  notify?: Notify
  /** True when a request on this record is already waiting for HR. */
  pending?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const form = useRecordForm()
  const id = recordIdOf(record)
  const sensitive = SENSITIVE_RECORD_TYPES.includes(type)
  if (!id) return null
  if (pending) {
    return (
      <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Awaiting HR
      </span>
    )
  }

  const run = async (work: () => Promise<ChangeResult | null>, verb: string) => {
    setBusy(true)
    try {
      const result = await work()
      notify(resultMessage(result, verb), "success")
      await onChanged()
    } catch (error) {
      notify(errorText(error), "error")
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = async () => {
    const fields = RECORD_FIELDS[type].map((field) => ({
      ...field,
      defaultValue: toInputValue(record[field.name]) || field.defaultValue,
    }))
    const result = await form.open(fields, {
      title: `Edit ${RECORD_LABELS[type]} Record`,
      description: sensitive
        ? "Update the details. HR will review this change before it is applied."
        : `Update your ${RECORD_LABELS[type].toLowerCase()} information.`,
      confirmLabel: sensitive ? "Send to HR" : "Save",
      reasonLabel: sensitive ? "Reason for HR" : undefined,
    })
    if (!result) return
    const { values, reason } = result
    const changed: AdminRecord = {}
    for (const [key, value] of Object.entries(cleanForm(values, true))) {
      if (toInputValue(record[key]) !== toInputValue(value)) changed[key] = value
    }
    if (!Object.keys(changed).length) {
      notify("Nothing changed.", "success")
      return
    }
    await run(() => updateMyRecord(token, type, id, changed, reason || undefined), "change")
  }

  const handleDelete = async () => {
    const ok = await fluentConfirm(
      sensitive
        ? "HR must approve this deletion. A copy is kept in your change history so it can be restored."
        : "A copy is kept in your change history so you can ask HR to restore it later.",
      { title: `Delete ${RECORD_LABELS[type].toLowerCase()}?`, confirmLabel: sensitive ? "Request deletion" : "Delete" },
    )
    if (!ok) return
    const reason = await askReason(type, "deletion")
    if (reason === null) return
    await run(() => deleteMyRecord(token, type, id, reason || undefined), "deletion")
  }

  return (
    <span className="inline-flex items-center gap-1">
      {form.dialog}
      <button
        type="button"
        aria-label={`Edit ${RECORD_LABELS[type]}`}
        title="Edit"
        disabled={busy}
        onClick={() => void handleEdit()}
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <PencilIcon className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Delete ${RECORD_LABELS[type]}`}
        title="Delete"
        disabled={busy}
        onClick={() => void handleDelete()}
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </span>
  )
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Added",
  UPDATE: "Edited",
  DELETE: "Deleted",
  ROLLBACK: "Rollback",
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_HR: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  APPLIED: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  REJECTED: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_HR: "Awaiting HR",
  APPLIED: "Done",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
}

function summarize(change: AdminRecord) {
  const data = (change.requested_values ?? change.after ?? change.before) as AdminRecord | null
  if (!data) return ""
  const preferred = [
    "full_name",
    "identification_number",
    "account_number",
    "email",
    "phone_number",
    "phone",
    "institution_name",
    "company_name",
    "city",
  ]
  for (const key of preferred) {
    if (data[key]) return String(data[key])
  }
  return ""
}

function ChangeDiff({ change }: { change: AdminRecord }) {
  const before = (change.before ?? {}) as AdminRecord
  const after = (change.requested_values ?? change.after ?? {}) as AdminRecord
  const keys = Object.keys({ ...before, ...after }).filter(
    (key) =>
      !["verification_status", "is_primary", "is_verified", "verified_at", "verified_by_user_id"].includes(key) &&
      toInputValue(before[key]) !== toInputValue(after[key]) &&
      (change.action !== "DELETE" ? key in after : true),
  )
  if (change.action === "DELETE" || change.action === "ROLLBACK" || !keys.length) return null
  return (
    <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
      {keys.slice(0, 8).map((key) => (
        <div key={key} className="min-w-0">
          <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
          <dd className="truncate">
            {change.action === "UPDATE" ? (
              <>
                <span className="text-muted-foreground line-through">{toInputValue(before[key]) || "—"}</span>{" "}
                → {toInputValue(after[key]) || "—"}
              </>
            ) : (
              toInputValue(after[key]) || "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Employee's own change history with rollback / cancel. */
export function MyProfileRecordHistory({
  token,
  refreshKey,
  onChanged,
  notify = defaultNotify,
}: {
  token: string
  refreshKey?: number
  onChanged: () => void | Promise<void>
  notify?: Notify
}) {
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await listMyRecordChanges(token)
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void load()
  }, [load, refreshKey])

  const act = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work()
      notify(message, "success")
      await load()
      await onChanged()
    } catch (error) {
      notify(errorText(error), "error")
    }
  }

  const handleRollback = async (change: AdminRecord) => {
    const reason = await fluentPrompt(
      "HR will review your rollback request. Tell them why you want to undo this change (optional).",
      "",
      { title: "Request rollback", confirmLabel: "Send to HR" },
    )
    if (reason === null) return
    await act(
      () => requestRollback(token, Number(change.id), reason || undefined),
      "Rollback request sent to HR.",
    )
  }

  if (!rows.length) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        {loading ? "Loading change history…" : "No changes yet. Edits you make to your records will appear here."}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border/50">
      {rows.map((change) => {
        const status = String(change.status ?? "")
        return (
          <li key={String(change.id)} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {ACTION_LABEL[String(change.action)] ?? String(change.action)} · {String(change.record_label ?? "")}
                {summarize(change) ? <span className="text-muted-foreground"> — {summarize(change)}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {change.created_at ? new Date(String(change.created_at)).toLocaleString() : ""}
                {change.rolled_back_by_change_id ? " · rolled back" : ""}
                {change.review_comment ? ` · HR: ${String(change.review_comment)}` : ""}
              </p>
              <ChangeDiff change={change} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_STYLE[status])}>
                {STATUS_LABEL[status] ?? status}
              </span>
              {status === "PENDING_HR" ? (
                <button
                  type="button"
                  onClick={() => void act(() => cancelMyChange(token, Number(change.id)), "Request cancelled.")}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <XIcon className="size-3" /> Cancel
                </button>
              ) : null}
              {change.can_roll_back ? (
                <button
                  type="button"
                  onClick={() => void handleRollback(change)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  <RotateCcwIcon className="size-3" /> Roll back
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** HR queue: approve / reject employee profile record changes. */
export function HrProfileRecordApprovals({ token, notify = defaultNotify }: { token: string; notify?: Notify }) {
  const [status, setStatus] = React.useState("PENDING_HR")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await listHrRecordChanges(token, status || undefined)
      setRows(Array.isArray(data) ? data : [])
    } catch (error) {
      setRows([])
      notify(errorText(error), "error")
    } finally {
      setLoading(false)
    }
  }, [notify, status, token])

  React.useEffect(() => {
    void load()
  }, [load])

  const review = async (change: AdminRecord, decision: "approve" | "reject") => {
    const comment =
      decision === "reject"
        ? await fluentPrompt("Tell the employee why this was rejected.", "", {
            title: "Reject request",
            confirmLabel: "Reject",
          })
        : await fluentPrompt("Optional note for the employee.", "", {
            title: "Approve request",
            confirmLabel: "Approve",
          })
    if (comment === null) return
    if (decision === "reject" && !comment.trim()) {
      notify("A rejection reason is required.", "error")
      return
    }
    try {
      await reviewHrRecordChange(token, Number(change.id), decision, comment || undefined)
      notify(decision === "approve" ? "Approved and applied." : "Rejected.", "success")
      await load()
    } catch (error) {
      notify(errorText(error), "error")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {[
          ["PENDING_HR", "Awaiting HR"],
          ["APPLIED", "Applied"],
          ["REJECTED", "Rejected"],
          ["", "All"],
        ].map(([value, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              status === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No requests here."}
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {rows.map((change) => {
              const s = String(change.status ?? "")
              return (
                <li key={String(change.id)} className="flex flex-col gap-2 px-3 py-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {String(change.employee_name ?? `Employee #${change.employee_id}`)}
                      {change.employee_no ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{String(change.employee_no)}</span>
                      ) : null}
                    </p>
                    <p className="text-sm">
                      {change.action === "ROLLBACK"
                        ? `Wants to roll back change #${String(change.rollback_of_change_id)}`
                        : `${ACTION_LABEL[String(change.action)]} ${String(change.record_label ?? "").toLowerCase()}`}
                      {summarize(change) ? <span className="text-muted-foreground"> — {summarize(change)}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {change.created_at ? new Date(String(change.created_at)).toLocaleString() : ""}
                      {change.reason ? ` · Reason: ${String(change.reason)}` : ""}
                    </p>
                    <ChangeDiff change={change} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_STYLE[s])}>
                      {STATUS_LABEL[s] ?? s}
                    </span>
                    {s === "PENDING_HR" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void review(change, "reject")}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void review(change, "approve")}
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Approve
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
