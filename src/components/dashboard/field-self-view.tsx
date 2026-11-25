"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import { EmployeeProfileRequiredState } from "@/components/dashboard/employee-profile-required-state"
import * as React from "react"
import Link from "next/link"
import {
  Button as FluentButton,
  Card as FluentCard,
  Text as FluentText,
} from "@fluentui/react-components"
import {
  Add20Regular,
  ArrowClockwise20Regular,
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
  uploadMyFieldAttachment,
  downloadFieldAttachment,
  fileToBase64UploadDto,
  addMyFieldVisitExpense,
  addMyFieldVisitOpportunity,
  cancelMyFieldFollowUp,
  checkInMyFieldVisit,
  checkOutMyFieldVisit,
  completeMyFieldFollowUp,
  createMyFieldFollowUp,
  createMyFieldVisitPlan,
  updateMyFieldVisitPlan,
  suggestMyFieldPlanRoute,
  repeatMyFieldPlan,
  createMyUnplannedFieldVisit,
  listFieldParties,
  listMyFieldFollowUps,
  listMyFieldVisitPlans,
  listMyFieldVisits,
  getMyFieldVisitCommercialPolicy,
  getMyFieldVisit,
  getMyFieldAttendancePolicy,
  getMyAttendanceToday,
  retryMyFieldAttendance,
  setMyFieldVisitDisposition,
  requestMyFieldCheckoutCorrection,
  reviseMyFieldVisitOutcome,
  updateMyFieldFollowUp,
  submitMyFieldVisitPlan,
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
  "INTERMEDIARY_VISIT",
  "RENEWAL_FOLLOW_UP",
  "COLLECTION_FOLLOW_UP",
  "CLAIM_INSPECTION",
  "RISK_INSPECTION",
  "RECOVERY_VISIT",
  "BRANCH_VISIT",
  "REGULATORY_VISIT",
  "SPECIAL_ASSIGNMENT",
  "OTHER",
] as const

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`
}

function fieldDeviceIdentifier() {
  const key = "hrms.attendance.installation-id"
  let id = window.localStorage.getItem(key)
  if (!id) { id = newRequestId(); window.localStorage.setItem(key, id) }
  return `web-${id}`
}

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function weekDates(offset: number) {
  const current = new Date()
  current.setHours(12, 0, 0, 0)
  current.setDate(current.getDate() - ((current.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(current)
    date.setDate(current.getDate() + index)
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, label: date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) }
  })
}

async function currentPosition() {
  return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
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
  const [attendancePolicy, setAttendancePolicy] = React.useState<AdminRecord | null>(null)
  const [attendanceToday, setAttendanceToday] = React.useState<AdminRecord | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [route, setRoute] = React.useState<AdminRecord | null>(null)
  const [range, setRange] = React.useState<"today" | "week" | "all">("today")
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [followFilter, setFollowFilter] = React.useState<"active" | "overdue" | "today" | "upcoming" | "completed" | "all">("active")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"plan" | "unplanned" | "expense" | "opportunity" | "checkout" | "evidence" | "follow-up" | "complete-follow-up" | "disposition" | "repeat-plan" | "checkout-correction" | "revise-outcome" | "checkin-exception">("plan")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [additionalVisits, setAdditionalVisits] = React.useState<Array<Record<string, string>>>([])
  const [evidenceFile, setEvidenceFile] = React.useState<File | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState("")

  const planHasOverlap = React.useMemo(() => {
    if (createMode !== "plan") return false
    const timed = [form, ...additionalVisits].filter((item) => item.start_time && item.end_time).sort((a, b) => a.start_time.localeCompare(b.start_time))
    return timed.some((item, index) => index > 0 && item.start_time < timed[index - 1].end_time)
  }, [createMode, form, additionalVisits])

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
      getMyFieldAttendancePolicy(token).then(setAttendancePolicy).catch(() => setAttendancePolicy(null)),
      getMyAttendanceToday(token).then((value) => setAttendanceToday(value as AdminRecord)).catch(() => setAttendanceToday(null)),
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
      const result = await checkInMyFieldVisit(token, id, {
        client_request_id: newRequestId(),
        captured_at: new Date().toISOString(),
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy_meters: position.accuracy,
        device_identifier: fieldDeviceIdentifier(),
      })
      const attendance = (result as AdminRecord)?.attendance as AdminRecord | undefined
      setNotice(attendance?.status === "FAILED" ? `Visit checked in. Attendance was not recorded: ${attendance.message}. Open the visit to retry.` : attendance?.message ? String(attendance.message) : null)
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
        const entries = [form, ...additionalVisits]
        const items = entries.map((entry, index) => {
          if (!entry.purpose?.trim()) throw new Error(`Visit ${index + 1} requires a purpose.`)
          if (entry.start_time && entry.end_time && entry.end_time <= entry.start_time) throw new Error(`Visit ${index + 1}: end time must be after start time.`)
          if ((entry.latitude && (!Number.isFinite(Number(entry.latitude)) || Math.abs(Number(entry.latitude)) > 90)) || (entry.longitude && (!Number.isFinite(Number(entry.longitude)) || Math.abs(Number(entry.longitude)) > 180))) throw new Error(`Visit ${index + 1}: enter valid coordinates.`)
          const timestamp = (time?: string) => time ? new Date(`${form.visit_date}T${time}`).toISOString() : undefined
          return {
            id: entry.item_id ? Number(entry.item_id) : undefined,
            visit_name: entry.visit_name?.trim() || undefined,
            priority: entry.priority || "NORMAL",
            field_party_id: entry.field_party_id ? Number(entry.field_party_id) : undefined,
            visit_type: entry.visit_type || "CUSTOMER_VISIT",
            purpose: entry.purpose.trim(),
            planned_start_time: timestamp(entry.start_time),
            planned_end_time: timestamp(entry.end_time),
            expected_outcome: entry.expected_outcome?.trim() || undefined,
            planned_address: entry.planned_address || undefined,
            latitude: entry.latitude ? Number(entry.latitude) : undefined,
            longitude: entry.longitude ? Number(entry.longitude) : undefined,
            display_order: index,
          }
        })
        const payload = { visit_date: form.visit_date, plan_summary: form.plan_summary || undefined, items }
        if (form.plan_id) await updateMyFieldVisitPlan(token, form.plan_id, payload)
        else await createMyFieldVisitPlan(token, payload)
      } else if (createMode === "unplanned") {
        if (!form.visit_date || !form.purpose || !form.unplanned_reason) {
          throw new Error("Date, purpose, and reason are required.")
        }
        await createMyUnplannedFieldVisit(token, {
          visit_date: form.visit_date,
          visit_type: form.visit_type || "CUSTOMER_VISIT",
          purpose: form.purpose,
          visit_name: form.visit_name?.trim() || undefined,
          priority: form.priority || "NORMAL",
          unplanned_reason: form.unplanned_reason,
          field_party_id: form.field_party_id ? Number(form.field_party_id) : undefined,
          client_request_id: newRequestId(),
        })
      } else if (createMode === "repeat-plan") {
        const weeks = Number(form.weeks)
        if (!form.id || !Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new Error("Choose between 1 and 12 weeks.")
        const result = await repeatMyFieldPlan(token, form.id, weeks)
        const results = Array.isArray(result?.results) ? result.results as AdminRecord[] : []
        setNotice(results.map((item) => `${item.date}: ${item.status}${item.message ? ` (${item.message})` : ""}`).join("; ") || "No repeat results were returned.")
      } else if (createMode === "checkin-exception") {
        if (!form.id || !form.gps_reason?.trim()) throw new Error("A location exception reason is required.")
        const position = await currentPosition()
        const result = await checkInMyFieldVisit(token, form.id, { client_request_id: newRequestId(), captured_at: new Date().toISOString(), latitude: position.latitude, longitude: position.longitude, accuracy_meters: position.accuracy, device_identifier: fieldDeviceIdentifier(), location_exception_reason: form.gps_reason.trim() })
        const attendance = (result as AdminRecord)?.attendance as AdminRecord | undefined
        setNotice(attendance?.status === "FAILED" ? `Visit checked in. Attendance was not recorded: ${attendance.message}. Open the visit to retry.` : "Field check-in saved. An inaccurate GPS event requires manager review.")
      } else if (createMode === "revise-outcome") {
        if (!form.id || !form.discussion_notes?.trim() || !form.outcome?.trim()) throw new Error("Notes and outcome are required.")
        await reviseMyFieldVisitOutcome(token, form.id, { discussion_notes: form.discussion_notes.trim(), outcome: form.outcome.trim() })
      } else if (createMode === "checkout-correction") {
        if (!form.id || !form.checkout_at || !form.reason?.trim() || !form.discussion_notes?.trim() || !form.outcome?.trim()) throw new Error("Checkout time, reason, notes and outcome are required.")
        await requestMyFieldCheckoutCorrection(token, form.id, { requested_checkout_at: new Date(form.checkout_at).toISOString(), reason: form.reason.trim(), discussion_notes: form.discussion_notes.trim(), outcome: form.outcome.trim() })
      } else if (createMode === "disposition") {
        if (!form.id || !form.reason?.trim()) throw new Error("A reason is required.")
        await setMyFieldVisitDisposition(token, form.id, { status: form.status, reason: form.reason.trim(), reschedule_date: form.status === "DEFERRED" ? form.reschedule_date || undefined : undefined })
      } else if (createMode === "expense") {
        if (!form.id || !form.amount || !form.description) throw new Error("Amount and description are required.")
        const amount = Number(form.amount)
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount greater than zero.")
        await addMyFieldVisitExpense(token, form.id, {
          expense_type: form.expense_type || "TRANSPORT",
          amount,
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
        if (!form.id || !evidenceFile) throw new Error("Choose a file to upload.")
        if (evidenceFile.size > 10 * 1024 * 1024) throw new Error("The file must be 10 MB or smaller.")
        await uploadMyFieldAttachment(token, form.id, {
          file: await fileToBase64UploadDto(evidenceFile),
          description: form.description || undefined,
        })
      } else if (createMode === "checkout") {
        if (!form.id || !form.discussion_notes || !form.outcome) throw new Error("Notes and outcome are required.")
        if (form.follow_up_required === "true" && !form.next_follow_up_date) throw new Error("Follow-up due date is required.")
        const position = await currentPosition()
        const result = await checkOutMyFieldVisit(token, form.id, {
          client_request_id: newRequestId(),
          captured_at: new Date().toISOString(),
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy_meters: position.accuracy,
          device_identifier: fieldDeviceIdentifier(),
          end_workday: form.end_workday === "true",
          location_exception_reason: form.gps_reason?.trim() || undefined,
          discussion_notes: form.discussion_notes,
          outcome: form.outcome,
          follow_up_required: form.follow_up_required === "true",
          next_follow_up_date: form.follow_up_required === "true" ? form.next_follow_up_date || undefined : undefined,
        })
        const attendance = (result as AdminRecord)?.attendance as AdminRecord | undefined
        setNotice(attendance?.status === "FAILED" ? `Visit checked out. Attendance was not recorded: ${attendance.message}. Open the visit to retry.` : attendance?.message ? String(attendance.message) : null)
      } else if (createMode === "follow-up") {
        if (!form.field_visit_id || !form.due_date || !form.action?.trim()) {
          throw new Error("Visit, due date, and action are required.")
        }
        if (form.id) {
          await updateMyFieldFollowUp(token, form.id, {
            due_date: form.due_date,
            action: form.action.trim(),
            action_type: form.action_type || "OTHER", priority: form.priority || "NORMAL",
            due_at: form.due_time ? new Date(`${form.due_date}T${form.due_time}`).toISOString() : null,
          })
        } else {
          await createMyFieldFollowUp(token, {
            field_visit_id: Number(form.field_visit_id),
            due_date: form.due_date,
            action: form.action.trim(),
            action_type: form.action_type || "OTHER", priority: form.priority || "NORMAL",
            due_at: form.due_time ? new Date(`${form.due_date}T${form.due_time}`).toISOString() : undefined,
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

  const today = localDate()
  const weekEndDate = new Date(`${today}T12:00:00`)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`
  const rows = activeTab === "plans" ? plans : activeTab === "follow-ups" ? followUps.filter((row) => {
    const date = String(row.dueDate ?? row.due_date ?? "").slice(0, 10)
    const status = readString(row, ["status"], "OPEN").toUpperCase()
    if (followFilter === "all") return true
    if (followFilter === "completed") return status === "COMPLETED"
    if (status !== "OPEN") return false
    if (followFilter === "overdue") return date < today
    if (followFilter === "today") return date === today
    if (followFilter === "upcoming") return date > today
    return true
  }) : visits.filter((row) => {
    const date = String(row.visitDate ?? row.visit_date ?? "").slice(0, 10)
    return range === "all" || (range === "today" ? date === today : date >= today && date <= weekEnd)
  })
  const profileRequired = Boolean(error?.toLowerCase().includes("employee profile"))
  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "follow-ups") {
      return [
        { key: "follow", label: "Follow-up", render: (row) => readString(row, ["action", "title", "note", "description"], `Follow-up #${rowId(row)}`) },
        { key: "due", label: "Due", render: (row) => formatDate(row.dueDate ?? row.due_date) },
        { key: "visit", label: "Visit", render: (row) => readString(row, ["visit_name", "visitName", "fieldVisitId", "field_visit_id"], "-") },
        { key: "priority", label: "Priority", render: (row) => prettify(readString(row, ["priority"], "NORMAL")) },
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
                      action_type: readString(row, ["actionType", "action_type"], "OTHER"),
                      priority: readString(row, ["priority"], "NORMAL"),
                      due_time: row.dueAt || row.due_at ? (() => { const date = new Date(String(row.dueAt ?? row.due_at)); return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` })() : "",
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
        { key: "items", label: "Itinerary", render: (row) => Array.isArray(row.items) ? (row.items as AdminRecord[]).map((item) => { const start = item.plannedStartTime ?? item.planned_start_time; const end = item.plannedEndTime ?? item.planned_end_time; const time = (value: unknown) => value ? new Date(String(value)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; return `${readString(item, ["visitName", "visit_name", "purpose"], "Visit")}${start ? ` (${time(start)}${end ? ` - ${time(end)}` : ""})` : ""}` }).join("; ") : "-" },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
        { key: "comments", label: "Manager comments", render: (row) => readString(row, ["managerComments", "manager_comments"], "-") },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            const editable = ["DRAFT", "RETURNED"].includes(readString(row, ["status"], "DRAFT").toUpperCase())
            return (
              <div className="flex gap-1">
              <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); const token = readStoredToken(); if (token) void suggestMyFieldPlanRoute(token, id).then(setRoute).catch((err) => toast.error(err instanceof Error ? err.message : "Route unavailable.")) }}>Route</button>
              <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("repeat-plan"); setForm({ id, weeks: "4" }); setFormError(null); setCreateOpen(true) }}>Repeat</button>
              {editable ? <>
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                const items = Array.isArray(row.items) ? row.items as AdminRecord[] : []
                const convert = (item: AdminRecord): Record<string, string> => {
                  const time = (value: unknown) => {
                    if (!value) return ""
                    const date = new Date(String(value))
                    return Number.isNaN(date.getTime()) ? "" : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
                  }
                  return {
                    item_id: rowId(item), visit_name: readString(item, ["visitName", "visit_name"], ""),
                    priority: readString(item, ["priority"], "NORMAL"),
                    visit_type: readString(item, ["visitType", "visit_type"], "CUSTOMER_VISIT"),
                    field_party_id: readString(item, ["fieldPartyId", "field_party_id"], ""),
                    purpose: readString(item, ["purpose"], ""), expected_outcome: readString(item, ["expectedOutcome", "expected_outcome"], ""),
                    planned_address: readString(item, ["plannedAddress", "planned_address"], ""),
                    latitude: readString(item, ["plannedLatitude", "planned_latitude"], ""), longitude: readString(item, ["plannedLongitude", "planned_longitude"], ""),
                    start_time: time(item.plannedStartTime ?? item.planned_start_time), end_time: time(item.plannedEndTime ?? item.planned_end_time),
                  }
                }
                const entries = items.map(convert)
                setForm({ ...(entries[0] ?? {}), plan_id: id, visit_date: String(row.visitDate ?? row.visit_date ?? "").slice(0, 10), plan_summary: readString(row, ["planSummary", "plan_summary"], "") })
                setAdditionalVisits(entries.slice(1)); setFormError(null); setCreateMode("plan"); setCreateOpen(true)
              }}>Edit</button>
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
              </> : null}
              </div>
            )
          },
        },
      ]
    }
    return [
      { key: "visit", label: "Visit", render: (row) => prettify(readString(row, ["visitName", "visit_name", "purpose", "visitType", "visit_type"], `Visit #${rowId(row)}`)) },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
      { key: "priority", label: "Priority", render: (row) => prettify(readString(row, ["priority"], "NORMAL")) },
      { key: "opportunities", label: "Opportunities", render: (row) => {
        const opportunities = Array.isArray(row.opportunities) ? row.opportunities as AdminRecord[] : []
        return opportunities.length ? opportunities.map((item) => `${readString(item, ["title"], "Opportunity")}${item.potentialValue || item.potential_value ? ` · ${readString(item, ["currency"], "")} ${readString(item, ["potentialValue", "potential_value"], "")}` : ""}${item.premiumValue || item.premium_value ? ` · Premium ${readString(item, ["premiumCurrency", "premium_currency"], "")} ${readString(item, ["premiumValue", "premium_value"], "")}` : ""}`).join("; ") : "—"
      } },
      { key: "date", label: "Date", render: (row) => formatDate(row.visitDate ?? row.visit_date) },
      { key: "scheduled", label: "Planned time", render: (row) => { const item = row.plan_item as AdminRecord | null; const start = item?.plannedStartTime ?? item?.planned_start_time; const end = item?.plannedEndTime ?? item?.planned_end_time; const format = (value: unknown) => value ? new Date(String(value)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"; return start || end ? `${format(start)} - ${format(end)}` : "-" } },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row)
            const status = readString(row, ["status"], "").toUpperCase()
          return (
            <div className="flex flex-wrap gap-1">
              {status === "PLANNED" ? (
              <button type="button" className={actionButtonClass} disabled={busyId === `in-${id}`} onClick={(event) => { event.stopPropagation(); void onCheckIn(row) }}>
                {busyId === `in-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Check in"}
              </button>
              ) : null}
              {status === "PLANNED" ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("disposition"); setForm({ id, status: "DEFERRED", reason: "" }); setFormError(null); setCreateOpen(true) }}>Missed / defer</button> : null}
              {status === "PLANNED" && attendancePolicy?.allow_gps_exception === true ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("checkin-exception"); setForm({ id, gps_reason: "" }); setFormError(null); setCreateOpen(true) }}>GPS exception</button> : null}
              {status === "CHECKED_IN" ? (
              <button type="button" className={actionButtonClass} onClick={(event) => {
                event.stopPropagation()
                setCreateMode("checkout")
                setForm({ id, discussion_notes: "", outcome: "", follow_up_required: "false" })
                setCreateOpen(true)
              }}>Check out</button>
              ) : null}
              {status === "CHECKED_IN" ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("checkout-correction"); setForm({ id }); setFormError(null); setCreateOpen(true) }}>Request checkout correction</button> : null}
              {status === "RETURNED" ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("revise-outcome"); setForm({ id, discussion_notes: readString(row, ["discussionNotes", "discussion_notes"], ""), outcome: readString(row, ["outcome"], ""), manager_comments: readString(row, ["managerComments", "manager_comments"], "") }); setFormError(null); setCreateOpen(true) }}>Revise and resubmit</button> : null}
              <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setDetail(row) }}>Details</button>
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
                setEvidenceFile(null)
                setForm({ id, evidence_type: "DOCUMENT" })
                setCreateOpen(true)
              }}>Evidence</button>
            </div>
          )
        },
      },
    ]
  }, [activeTab, attendancePolicy, busyId, commercialPolicy, load, onCheckIn])

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
          {activeTab !== "visits" ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {activeTab === "plans"
                ? "Plan upcoming site visits and submit your plan for review."
                : "Keep track of actions due after your visits and record them as complete."}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {activeTab === "visits" ? (
            <FluentButton
              appearance="primary"
              icon={<Add20Regular />}
              onClick={() => {
                setCreateMode("unplanned")
                setForm({ visit_type: "CUSTOMER_VISIT", visit_date: localDate() })
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
                setAdditionalVisits([])
                setForm({ visit_type: "CUSTOMER_VISIT", visit_date: localDate() })
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
                  due_date: localDate(),
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
            { label: "Today", value: visits.filter((visit) => String(visit.visitDate ?? visit.visit_date ?? "").slice(0, 10) === today).length, hint: "Scheduled field visits" },
            { label: "In progress", value: visits.filter((visit) => readString(visit, ["status"], "") === "CHECKED_IN").length, hint: "Visits checked in" },
            { label: "Due or overdue", value: followUps.filter((item) => readString(item, ["status"], "") === "OPEN" && String(item.dueDate ?? item.due_date ?? "").slice(0, 10) <= today).length, hint: "Follow-ups requiring attention" },
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

      {notice ? <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/20">{notice}</div> : null}
      {activeTab === "visits" && attendanceToday ? <div className="rounded-lg border bg-card px-3 py-2 text-sm"><strong>Attendance today:</strong> {(() => { const flags = (attendanceToday.action_flags ?? attendanceToday.actionFlags) as AdminRecord | undefined; if (flags?.can_check_out === true || flags?.canCheckOut === true) return "A check-in is recorded or awaiting review."; if (flags?.can_check_in === true || flags?.canCheckIn === true) return "No attendance check-in recorded yet."; return readString(attendanceToday, ["attendance_status", "attendanceStatus", "status"], "See attendance for details.") })()} <Link className="text-primary underline" href="/dashboard/attendance/attendance-history">Open attendance</Link></div> : null}
      {activeTab === "visits" ? <div className="flex flex-wrap gap-2" aria-label="Visit date range">{(["today", "week", "all"] as const).map((item) => <button key={item} type="button" onClick={() => setRange(item)} className={range === item ? primaryButtonClass : secondaryButtonClass}>{item === "week" ? "Next 7 days" : prettify(item)}</button>)}</div> : null}
      {activeTab === "follow-ups" ? <div className="flex flex-wrap gap-2" aria-label="Follow-up filter">{(["active", "overdue", "today", "upcoming", "completed", "all"] as const).map((item) => <button key={item} type="button" onClick={() => setFollowFilter(item)} className={followFilter === item ? primaryButtonClass : secondaryButtonClass}>{prettify(item)}</button>)}</div> : null}
      {activeTab === "plans" ? <section className="space-y-3 rounded-lg border bg-card p-3"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Weekly calendar</h2><div className="flex gap-2"><button type="button" className={secondaryButtonClass} onClick={() => setWeekOffset((value) => value - 1)}>Previous</button><button type="button" className={secondaryButtonClass} onClick={() => setWeekOffset(0)}>This week</button><button type="button" className={secondaryButtonClass} onClick={() => setWeekOffset((value) => value + 1)}>Next</button></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{weekDates(weekOffset).map((day) => <div key={day.key} className="min-h-24 rounded-md border p-2"><p className="text-xs font-semibold">{day.label}</p>{visits.filter((visit) => String(visit.visitDate ?? visit.visit_date ?? "").slice(0, 10) === day.key).map((visit) => <button key={rowId(visit)} type="button" onClick={() => setDetail(visit)} className="mt-2 block w-full rounded bg-muted px-2 py-1 text-left text-xs"><span className="block font-medium">{readString(visit, ["visitName", "visit_name", "purpose"], "Visit")}</span><span>{prettify(readString(visit, ["status"], ""))}</span></button>)}</div>)}</div></section> : null}

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

      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogPopup className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{detail ? readString(detail, ["visitName", "visit_name", "purpose"], "Field visit") : "Field visit"}</DialogTitle><DialogDescription>Visit schedule, outcome and attendance events.</DialogDescription></DialogHeader>
          {detail ? <div className="space-y-3 text-sm">
            <p><strong>Status:</strong> {prettify(readString(detail, ["status"], ""))} &nbsp; <strong>Date:</strong> {formatDate(detail.visitDate ?? detail.visit_date)}</p>
            <p><strong>Purpose:</strong> {readString(detail, ["purpose"], "-")}</p>
            {detail.partySnapshot && typeof detail.partySnapshot === "object" ? <p><strong>Party:</strong> {readString(detail.partySnapshot as AdminRecord, ["name"], "-")} · {readString(detail.partySnapshot as AdminRecord, ["contact_person"], "")} {readString(detail.partySnapshot as AdminRecord, ["phone"], "")}</p> : null}
            {(() => { const item = detail.plan_item as AdminRecord | null; const party = detail.partySnapshot as AdminRecord | null; const address = readString(item, ["plannedAddress", "planned_address"], "") || readString(party, ["address"], ""); return address ? <p><strong>Location:</strong> {address} <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="text-primary underline">Open directions</a></p> : null })()}
            {detail.plan_item && typeof detail.plan_item === "object" ? <p><strong>Planned:</strong> {(() => { const item = detail.plan_item as AdminRecord; const format = (value: unknown) => value ? new Date(String(value)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"; return `${format(item.plannedStartTime ?? item.planned_start_time)} - ${format(item.plannedEndTime ?? item.planned_end_time)}` })()}</p> : null}
            <p><strong>Outcome:</strong> {readString(detail, ["outcome"], "-")}</p>
            <p><strong>Notes:</strong> {readString(detail, ["discussionNotes", "discussion_notes"], "-")}</p>
            <p><strong>Manager comments:</strong> {readString(detail, ["managerComments", "manager_comments"], "-")}</p>
            {(Array.isArray(detail.attachments) ? detail.attachments as AdminRecord[] : []).map((attachment) => <div key={rowId(attachment)} className="flex items-center justify-between gap-2 rounded-md border p-2"><span>{readString(attachment, ["fileName", "file_name"], "Attachment")}</span><button type="button" className={actionButtonClass} onClick={() => { const token = readStoredToken(); if (!token) return; void downloadFieldAttachment(token, rowId(detail), rowId(attachment), readString(attachment, ["fileName", "file_name"], "attachment")).then(({ blob, filename }) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }).catch((err) => toast.error(err instanceof Error ? err.message : "Download failed.")) }}>Download</button></div>)}
            {(Array.isArray(detail.checkout_corrections) ? detail.checkout_corrections as AdminRecord[] : []).map((correction) => <p key={rowId(correction)}><strong>Checkout correction:</strong> {prettify(readString(correction, ["status"], "PENDING"))} {readString(correction, ["reviewComments", "review_comments"], "")}</p>)}
            {detail.statusReason || detail.status_reason ? <p><strong>Status reason:</strong> {readString(detail, ["statusReason", "status_reason"], "-")}{detail.rescheduleDate || detail.reschedule_date ? `; proposed date: ${formatDate(detail.rescheduleDate ?? detail.reschedule_date)}` : ""}</p> : null}
            {(Array.isArray(detail.location_events) ? detail.location_events as AdminRecord[] : []).map((event) => <div key={rowId(event)} className="rounded-md border p-2">
              <p className="font-medium">{prettify(readString(event, ["eventType", "event_type"], "EVENT"))} - {String(event.capturedAt ?? event.captured_at ?? "") ? new Date(String(event.capturedAt ?? event.captured_at)).toLocaleString() : "-"}</p>
              {event.attendance_punch_validation_status ? <p>Attendance punch: {prettify(String(event.attendance_punch_validation_status))}</p> : event.attendanceSyncMessage || event.attendance_sync_message ? <p>{readString(event, ["attendanceSyncMessage", "attendance_sync_message"], "")}</p> : null}
              {readString(event, ["attendanceSyncStatus", "attendance_sync_status"], "") === "FAILED" ? <button type="button" className={actionButtonClass} onClick={() => { const token = readStoredToken(); const type = readString(event, ["eventType", "event_type"], "") as "CHECK_IN" | "CHECK_OUT"; if (!token || !rowId(detail)) return; void retryMyFieldAttendance(token, rowId(detail), type).then(async (result) => { const value = result as AdminRecord; setNotice(String(value.message ?? "Attendance retry completed.")); setDetail(await getMyFieldVisit(token, rowId(detail))); await load() }).catch((err) => toast.error(err instanceof Error ? err.message : "Attendance retry failed.")) }}>Retry attendance</button> : null}
            </div>)}
          </div> : null}
        </DialogPopup>
      </Dialog>

      <Dialog open={Boolean(route)} onOpenChange={(open) => { if (!open) setRoute(null) }}><DialogPopup className="max-w-xl"><DialogHeader><DialogTitle>Suggested visit order</DialogTitle><DialogDescription>{route ? readString(route, ["method"], "") : ""}</DialogDescription></DialogHeader><div className="space-y-2 text-sm">{(Array.isArray(route?.stops) ? route.stops as AdminRecord[] : []).map((stop, index) => <p key={rowId(stop)}>{index + 1}. {readString(stop, ["name"], "Visit")} {stop.distance_from_previous_km != null ? `- ${stop.distance_from_previous_km} km from previous stop` : "- starting stop"}</p>)}{(Array.isArray(route?.missing_locations) ? route.missing_locations as AdminRecord[] : []).map((stop) => <p key={rowId(stop)}>No coordinates: {readString(stop, ["name"], "Visit")}</p>)}</div></DialogPopup></Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {createMode === "plan" ? (form.plan_id ? "Edit visit plan" : "New visit plan") : createMode === "repeat-plan" ? "Repeat weekly" : createMode === "unplanned" ? "Unplanned visit" : createMode === "disposition" ? "Update visit status" : createMode === "checkout-correction" ? "Request checkout correction" : createMode === "revise-outcome" ? "Revise returned visit" : createMode === "checkin-exception" ? "Check in with GPS exception" : createMode === "expense" ? "Visit expense" : createMode === "opportunity" ? "Record opportunity" : createMode === "evidence" ? "Visit evidence" : createMode === "follow-up" ? (form.id ? "Edit follow-up" : "New follow-up") : createMode === "complete-follow-up" ? "Complete follow-up" : "Check out"}
            </DialogTitle>
            <DialogDescription>Add or update this field visit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "repeat-plan" ? <><label className="grid gap-1.5 text-sm">Number of future weeks<input type="number" min="1" max="12" className={inputClass} value={form.weeks ?? "4"} onChange={(event) => setForm((current) => ({ ...current, weeks: event.target.value }))} /></label><p className="text-xs text-muted-foreground">Creates separate draft plans on the same weekday. Existing plans are skipped and reported. Times are copied as elapsed weekly intervals.</p></> : null}
            {createMode === "checkin-exception" ? <><label className="grid gap-1.5 text-sm">Why is location accuracy poor?<Textarea className={textareaClass} value={form.gps_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, gps_reason: event.target.value }))} /></label><p className="text-xs text-muted-foreground">The device still captures location. If the accuracy is outside the policy limit, the visit and any attendance punch require review.</p></> : null}
            {createMode === "revise-outcome" ? <><p className="text-sm">Manager comments: {form.manager_comments || "-"}</p><label className="grid gap-1.5 text-sm">Discussion notes<Textarea className={textareaClass} value={form.discussion_notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, discussion_notes: event.target.value }))} /></label><label className="grid gap-1.5 text-sm">Outcome<Textarea className={textareaClass} value={form.outcome ?? ""} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /></label></> : null}
            {createMode === "checkout-correction" ? <>
              <label className="grid gap-1.5 text-sm">Actual checkout date and time<input type="datetime-local" className={inputClass} value={form.checkout_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, checkout_at: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm">Reason<Textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm">Discussion notes<Textarea className={textareaClass} value={form.discussion_notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, discussion_notes: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm">Outcome<Textarea className={textareaClass} value={form.outcome ?? ""} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /></label>
              <p className="text-xs text-muted-foreground">Your manager must review this request. It does not alter attendance; request an attendance correction separately if needed.</p>
            </> : null}
            {createMode === "plan" || createMode === "unplanned" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Visit name</span><input maxLength={200} className={inputClass} value={form.visit_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, visit_name: event.target.value }))} placeholder="e.g. Renewal meeting with ABC Company" /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Priority</span><FluentSelect ariaLabel="Visit priority" value={form.priority ?? "NORMAL"} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} options={["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ value, label: prettify(value) }))} /></label>
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
            {createMode === "plan" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm"><span className="font-medium">Start time</span><input type="time" className={inputClass} value={form.start_time ?? ""} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} /></label>
                  <label className="grid gap-1.5 text-sm"><span className="font-medium">End time</span><input type="time" className={inputClass} value={form.end_time ?? ""} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} /></label>
                </div>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Expected outcome</span><Textarea className={textareaClass} value={form.expected_outcome ?? ""} onChange={(event) => setForm((current) => ({ ...current, expected_outcome: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Planned address (optional)</span><input className={inputClass} value={form.planned_address ?? ""} onChange={(event) => setForm((current) => ({ ...current, planned_address: event.target.value }))} /></label>
                <div className="grid grid-cols-2 gap-3">{(["latitude", "longitude"] as const).map((key) => <label key={key} className="grid gap-1.5 text-sm">{prettify(key)} (optional)<input type="number" step="any" className={inputClass} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
                {planHasOverlap ? <p role="status" className="text-sm text-amber-700">Some planned visit times overlap. Review the itinerary before submitting.</p> : null}
                {additionalVisits.map((entry, index) => (
                  <fieldset key={index} className="grid gap-3 rounded-lg border p-3">
                    <legend className="px-1 text-sm font-semibold">Visit {index + 2}</legend>
                    <label className="grid gap-1.5 text-sm">Visit name<input maxLength={200} className={inputClass} value={entry.visit_name ?? ""} onChange={(event) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, visit_name: event.target.value } : item))} /></label>
                    <label className="grid gap-1.5 text-sm">Priority<FluentSelect ariaLabel={`Visit ${index + 2} priority`} value={entry.priority ?? "NORMAL"} onChange={(value) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, priority: value } : item))} options={["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ value, label: prettify(value) }))} /></label>
                    <label className="grid gap-1.5 text-sm">Type<FluentSelect ariaLabel={`Visit ${index + 2} type`} value={entry.visit_type ?? "CUSTOMER_VISIT"} onChange={(value) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, visit_type: value } : item))} options={VISIT_TYPES.map((item) => ({ value: item, label: prettify(item) }))} /></label>
                    <label className="grid gap-1.5 text-sm">Party<FluentSelect ariaLabel={`Visit ${index + 2} party`} value={entry.field_party_id ?? ""} onChange={(value) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, field_party_id: value } : item))} options={[{ value: "", label: "None" }, ...parties.map((party) => ({ value: rowId(party), label: optionLabel(party) }))]} /></label>
                    <label className="grid gap-1.5 text-sm">Purpose<Textarea className={textareaClass} value={entry.purpose ?? ""} onChange={(event) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, purpose: event.target.value } : item))} /></label>
                    <div className="grid grid-cols-2 gap-3">{(["start_time", "end_time"] as const).map((key) => <label key={key} className="grid gap-1.5 text-sm">{key === "start_time" ? "Start time" : "End time"}<input type="time" className={inputClass} value={entry[key] ?? ""} onChange={(event) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} /></label>)}</div>
                    <label className="grid gap-1.5 text-sm">Expected outcome<Textarea className={textareaClass} value={entry.expected_outcome ?? ""} onChange={(event) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, expected_outcome: event.target.value } : item))} /></label>
                    <label className="grid gap-1.5 text-sm">Planned address (optional)<input className={inputClass} value={entry.planned_address ?? ""} onChange={(event) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, planned_address: event.target.value } : item))} /></label>
                    <div className="grid grid-cols-2 gap-3">{(["latitude", "longitude"] as const).map((key) => <label key={key} className="grid gap-1.5 text-sm">{prettify(key)} (optional)<input type="number" step="any" className={inputClass} value={entry[key] ?? ""} onChange={(event) => setAdditionalVisits((current) => current.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} /></label>)}</div>
                    <button type="button" className={secondaryButtonClass} onClick={() => setAdditionalVisits((current) => current.filter((_, i) => i !== index))}>Remove visit</button>
                  </fieldset>
                ))}
                <button type="button" className={secondaryButtonClass} onClick={() => setAdditionalVisits((current) => [...current, { visit_type: "CUSTOMER_VISIT" }])}>Add another visit</button>
              </>
            ) : null}
            {createMode === "unplanned" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Why unplanned</span><Textarea className={textareaClass} value={form.unplanned_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, unplanned_reason: event.target.value }))} /></label>
            ) : null}
            {createMode === "disposition" ? <>
              <label className="grid gap-1.5 text-sm">Status<FluentSelect ariaLabel="Visit status" value={form.status ?? "DEFERRED"} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={[{ value: "MISSED", label: "Missed" }, { value: "DEFERRED", label: "Deferred" }, { value: "CANCELLED", label: "Cancelled" }]} /></label>
              <label className="grid gap-1.5 text-sm">Reason<Textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
              {form.status === "DEFERRED" ? <label className="grid gap-1.5 text-sm">Proposed new date<DateInput className={inputClass} value={form.reschedule_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, reschedule_date: event.target.value }))} /><span className="text-xs text-muted-foreground">Create a new plan for the proposed date to schedule the visit.</span></label> : null}
            </> : null}
            {createMode === "expense" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Expense type</span><FluentSelect ariaLabel="Expense type" value={form.expense_type ?? "TRANSPORT"} onChange={(value) => setForm((current) => ({ ...current, expense_type: value }))} options={["TRANSPORT", "FUEL", "PARKING", "TOLL", "MEALS", "ACCOMMODATION", "COMMUNICATION", "OTHER"].map((value) => ({ value, label: prettify(value) }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Amount</span><input type="number" min="0.01" step="0.01" className={inputClass} value={form.amount ?? ""} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Currency</span><input maxLength={3} className={inputClass} value={form.currency ?? "TZS"} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
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
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Photo or document</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} /><span className="text-xs text-muted-foreground">JPEG, PNG or PDF; maximum 10 MB.</span></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><Textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
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
                {readString(attendancePolicy ?? {}, ["field_attendance_mode"], "NONE") === "START_AND_END" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.end_workday === "true"} onChange={(event) => setForm((current) => ({ ...current, end_workday: String(event.target.checked) }))} /><span>Also end my attendance workday</span></label> : null}
                {attendancePolicy?.allow_gps_exception === true ? <label className="grid gap-1.5 text-sm">Reason if GPS accuracy is poor (optional)<Textarea className={textareaClass} value={form.gps_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, gps_reason: event.target.value }))} /></label> : null}
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
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Due time (optional)</span><input type="time" className={inputClass} value={form.due_time ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_time: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Action type</span><FluentSelect ariaLabel="Action type" value={form.action_type ?? "OTHER"} onChange={(value) => setForm((current) => ({ ...current, action_type: value }))} options={["CALL", "EMAIL", "QUOTATION", "DOCUMENT", "REVISIT", "OTHER"].map((value) => ({ value, label: prettify(value) }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Priority</span><FluentSelect ariaLabel="Priority" value={form.priority ?? "NORMAL"} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} options={["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ value, label: prettify(value) }))} /></label>
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
