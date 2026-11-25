"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import dynamic from "next/dynamic"
import { PlusIcon, RefreshCwIcon } from "lucide-react";
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
  asRecordArray,
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
  createFieldParty,
  getHrFieldVisitsMap,
  getManagerFieldVisitMap,
  getManagerFieldVisitDashboard,
  getFieldOperationsReport,
  getManagerFieldPartyHistory,
  downloadFieldAttachment,
  getManagerFieldVisitCommercialPolicy,
  getManagerFieldVisitCommercialSummary,
  getManagerFieldVisitExceptions,
  listActivityCategories,
  listActivityPolicies,
  listFieldParties,
  listHrFieldLocationAccessLogs,
  listHrFieldVisits,
  listManagerFieldPlannedVsActual,
  listManagerFieldVisitPlans,
  listManagerFieldFollowUps,
  assignManagerFieldFollowUp,
  assignManagerFieldPlan,
  listManagerFieldCheckoutCorrections,
  reviewManagerFieldCheckoutCorrection,
  listEmployees,
  listManagerFieldVisits,
  reviewManagerFieldVisit,
  reviewManagerFieldVisitPlan,
  saveManagerFieldVisitCommercialPolicy,
  updateManagerFieldOpportunityCommercial,
  updateFieldParty,
  updateActivityPolicy,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute, hasPermission } from "@/lib/dashboard-permissions"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type FieldOpsTab = "overview" | "visits" | "map" | "parties" | "setup"

const AttendanceLocationMap = dynamic(() => import("@/components/dashboard/attendance-location-map").then((module) => module.AttendanceLocationMap), { ssr: false })

const PARTY_TYPES = [
  "CUSTOMER",
  "PROSPECT",
  "BROKER",
  "INTERMEDIARY",
  "AGENT",
  "VENDOR",
  "REGULATOR",
  "PARTNER",
  "INTERNAL_BRANCH",
  "OTHER",
] as const

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function fieldWeekDates(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date); day.setDate(date.getDate() + index)
    return { key: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`, label: day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) }
  })
}

function downloadOperationsCsv(report: AdminRecord) {
  const statuses = report.status_counts && typeof report.status_counts === "object" ? Object.entries(report.status_counts as Record<string, unknown>) : []
  const coverage = asRecordArray(report.party_coverage)
  const rows: unknown[][] = [
    ["Measure", "Value"], ["Planned visits", report.planned], ["Unplanned visits", report.unplanned],
    ["Open follow-ups", report.open_follow_ups], ["Overdue follow-ups", report.overdue_follow_ups],
    ["Completed follow-ups", report.completed_follow_ups], ["Attendance issues", report.attendance_failures],
    ["Average visit duration (minutes)", report.average_duration_minutes],
    ...statuses.map(([status, count]) => [`Status ${status}`, count]),
    [], ["Party", "Visits", "Last visit"], ...coverage.map((party) => [party.name, party.visits, party.last_visit]),
  ]
  const cell = (value: unknown) => { const text = String(value ?? ""); const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"` }
  const blob = new Blob(["\uFEFF", rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "field-operations-report.csv"; link.click(); URL.revokeObjectURL(url)
}

export function FieldOperationsView({ activeTab }: { activeTab: FieldOpsTab }) {
  const actor = useDashboardActor()
  const canReview = hasPermission(actor.permissionLabels, "field_visits:manager-review")
  const canConfigure = hasPermission(actor.permissionLabels, "work_activities:config")
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/field/overview", actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [operationsReport, setOperationsReport] = React.useState<AdminRecord | null>(null)
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [exceptions, setExceptions] = React.useState<AdminRecord | null>(null)
  const [visits, setVisits] = React.useState<AdminRecord[]>([])
  const [plannedVsActual, setPlannedVsActual] = React.useState<AdminRecord[]>([])
  const [managerVisits, setManagerVisits] = React.useState<AdminRecord[]>([])
  const [plans, setPlans] = React.useState<AdminRecord[]>([])
  const [followUps, setFollowUps] = React.useState<AdminRecord[]>([])
  const [corrections, setCorrections] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [parties, setParties] = React.useState<AdminRecord[]>([])
  const [categories, setCategories] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [commercialPolicy, setCommercialPolicy] = React.useState<AdminRecord | null>(null)
  const [commercialSummary, setCommercialSummary] = React.useState<AdminRecord | null>(null)
  const [logs, setLogs] = React.useState<AdminRecord[]>([])
  const [mapRecord, setMapRecord] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [partyHistory, setPartyHistory] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"party" | "category" | "policy" | "review" | "commercial-policy" | "opportunity-commercial" | "assign-follow-up" | "assign-visit" | "correction-review">("party")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [setupKind, setSetupKind] = React.useState<"categories" | "policies" | "logs">("categories")

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
        getManagerFieldVisitDashboard(token).then(setDashboard).catch(() => setDashboard(null)),
        getManagerFieldVisitExceptions(token).then(setExceptions).catch(() => setExceptions(null)),
        listHrFieldVisits(token, { limit: 50 }).then(setVisits).catch(() => setVisits([])),
        listManagerFieldVisits(token).then(setManagerVisits).catch(() => setManagerVisits([])),
        listManagerFieldVisitPlans(token).then(setPlans).catch(() => setPlans([])),
        getFieldOperationsReport(token, { date_from: dateFrom || undefined, date_to: dateTo || undefined }).catch(() => getFieldOperationsReport(token, { date_from: dateFrom || undefined, date_to: dateTo || undefined }, true)).then(setOperationsReport).catch(() => setOperationsReport(null)),
      )
    }
    if (activeTab === "visits") {
      tasks.push(
        listHrFieldVisits(token, { limit: 100 }).then(setVisits).catch(() => setVisits([])),
        listManagerFieldVisits(token).then(setManagerVisits).catch(() => setManagerVisits([])),
        listManagerFieldVisitPlans(token).then(setPlans).catch(() => setPlans([])),
        listManagerFieldFollowUps(token).then(setFollowUps).catch(() => setFollowUps([])),
        listManagerFieldCheckoutCorrections(token).then(setCorrections).catch(() => setCorrections([])),
        listEmployees(token, { limit: 100 }).then((result) => setEmployees(result.rows)).catch(() => setEmployees([])),
        listFieldParties(token).then(setParties).catch(() => setParties([])),
        listManagerFieldPlannedVsActual(token, { limit: 50 }).then(setPlannedVsActual).catch(() => setPlannedVsActual([])),
        getManagerFieldVisitCommercialSummary(token).then(setCommercialSummary).catch(() => setCommercialSummary(null)),
      )
    }
    if (activeTab === "map") {
      tasks.push(getManagerFieldVisitMap(token).catch(() => getHrFieldVisitsMap(token)).then(setMapRecord).catch(() => setMapRecord(null)))
    }
    if (activeTab === "parties") {
      tasks.push(listFieldParties(token).then(setParties).catch((errorObject) => {
        setParties([])
        throw errorObject
      }))
    }
    if (activeTab === "setup") {
      tasks.push(
        listActivityCategories(token).then(setCategories).catch(() => setCategories([])),
        listActivityPolicies(token).then(setPolicies).catch(() => setPolicies([])),
        listHrFieldLocationAccessLogs(token).then(setLogs).catch(() => setLogs([])),
        getManagerFieldVisitCommercialPolicy(token).then(setCommercialPolicy).catch(() => setCommercialPolicy(null)),
        getManagerFieldVisitCommercialSummary(token).then(setCommercialSummary).catch(() => setCommercialSummary(null)),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load field data.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden, dateFrom, dateTo])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const visitRows = visits.length > 0 ? visits : managerVisits
  const visible = (activeTab === "parties" ? parties : activeTab === "setup" ? (setupKind === "categories" ? categories : setupKind === "policies" ? policies : logs) : visitRows)
    .filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  const points = asRecordArray(mapRecord?.items ?? mapRecord?.points ?? mapRecord?.visits)
  const mapMarkers = points.map((point) => { const lat = point.latitude ?? point.lat ?? point.event_latitude; const lng = point.longitude ?? point.lng ?? point.lon ?? point.event_longitude; return { latitude: lat == null || lat === "" ? NaN : Number(lat), longitude: lng == null || lng === "" ? NaN : Number(lng), label: readString(point, ["event_event_type", "eventType", "event_type"], "Field visit") } }).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180)

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "party") {
        if (!form.name || !form.party_type) throw new Error("Name and party type are required.")
        const payload = {
          party_type: form.party_type,
          name: form.name,
          contact_person: form.contact_person || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
        }
        if (form.id) await updateFieldParty(token, form.id, payload)
        else await createFieldParty(token, payload)
      } else if (createMode === "category") {
        if (!form.code || !form.name) throw new Error("Code and name are required.")
        await createActivityCategory(token, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          is_field_activity: true,
        })
      } else if (createMode === "policy") {
        if (!form.effective_from) throw new Error("Effective from is required.")
        const payload = {
          effective_from: form.effective_from,
          field_visit_plan_required: form.field_visit_plan_required === "true",
          allow_unplanned_visits: form.allow_unplanned_visits !== "false",
          field_attendance_mode: form.field_attendance_mode || "NONE",
          field_plan_approval_required: form.field_plan_approval_required === "true" ? true : form.field_plan_approval_required === "false" ? false : null,
          field_max_gps_accuracy_meters: form.field_max_gps_accuracy_meters ? Number(form.field_max_gps_accuracy_meters) : null,
          field_allow_gps_exception: form.field_allow_gps_exception === "true",
          field_follow_up_reminder_days: Number(form.field_follow_up_reminder_days ?? 1),
          field_follow_up_escalation_days: Number(form.field_follow_up_escalation_days ?? 3),
        }
        if (form.id) await updateActivityPolicy(token, form.id, payload)
        else await createActivityPolicy(token, payload)
      } else if (createMode === "assign-follow-up") {
        if (!form.id || !form.employee_id || !form.reason?.trim()) throw new Error("Employee and reason are required.")
        await assignManagerFieldFollowUp(token, form.id, { employee_id: Number(form.employee_id), reason: form.reason.trim() })
      } else if (createMode === "correction-review") {
        if (!form.id || !form.comments?.trim()) throw new Error("Review comments are required.")
        await reviewManagerFieldCheckoutCorrection(token, form.id, { decision: form.decision, comments: form.comments.trim() })
      } else if (createMode === "assign-visit") {
        if (!form.employee_id || !form.visit_date || !form.purpose?.trim()) throw new Error("Employee, date and purpose are required.")
        if (form.start_time && form.end_time && form.end_time <= form.start_time) throw new Error("End time must be after start time.")
        const timestamp = (time: string | undefined) => time ? new Date(`${form.visit_date}T${time}`).toISOString() : undefined
        await assignManagerFieldPlan(token, { employee_id: Number(form.employee_id), visit_date: form.visit_date, client_request_id: form.request_id || undefined, items: [{ visit_type: form.visit_type || "CUSTOMER_VISIT", visit_name: form.visit_name?.trim() || undefined, priority: form.priority || "NORMAL", field_party_id: form.field_party_id ? Number(form.field_party_id) : undefined, purpose: form.purpose.trim(), expected_outcome: form.expected_outcome?.trim() || undefined, planned_start_time: timestamp(form.start_time), planned_end_time: timestamp(form.end_time) }] })
      } else if (createMode === "review") {
        if (!form.id || !form.decision || !form.comments) throw new Error("Decision and comments are required.")
        const payload = { decision: form.decision, comments: form.comments, validate_opportunities: form.validate_opportunities === "true" }
        if (form.kind === "plan") await reviewManagerFieldVisitPlan(token, form.id, payload)
        else await reviewManagerFieldVisit(token, form.id, payload)
      } else if (createMode === "commercial-policy") {
        const supported = form.supported_currencies.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean)
        if (!form.default_currency || !supported.length) throw new Error("Default and supported currencies are required.")
        await saveManagerFieldVisitCommercialPolicy(token, { default_currency: form.default_currency.toUpperCase(), supported_currencies: supported, allow_employee_opportunity_values: form.allow_employee_opportunity_values === "true" })
      } else if (createMode === "opportunity-commercial") {
        if (!form.id || !form.reason?.trim()) throw new Error("Opportunity and reason are required.")
        await updateManagerFieldOpportunityCommercial(token, form.id, {
          actual_value: form.actual_value === "" ? undefined : Number(form.actual_value),
          status: form.status,
          reason: form.reason.trim(),
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

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "parties") {
      return [
        { key: "name", label: "Party", render: (row) => optionLabel(row) },
        { key: "type", label: "Type", render: (row) => prettify(readString(row, ["partyType", "party_type"], "OTHER")) },
        { key: "contact", label: "Contact", render: (row) => readString(row, ["contactPerson", "contact_person", "phone"], "â€”") },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex gap-1">
            <button type="button" className={actionButtonClass} onClick={(event) => {
              event.stopPropagation()
              setForm({
                id: rowId(row),
                name: readString(row, ["name"]),
                party_type: readString(row, ["partyType", "party_type"], "CUSTOMER"),
                contact_person: readString(row, ["contactPerson", "contact_person"]),
                phone: readString(row, ["phone"]),
                email: readString(row, ["email"]),
                address: readString(row, ["address"]),
              })
              setCreateMode("party")
              setCreateOpen(true)
            }}>Edit</button>
            <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); const token = readStoredToken(); if (token) void getManagerFieldPartyHistory(token, rowId(row)).catch(() => getManagerFieldPartyHistory(token, rowId(row), true)).then(setPartyHistory).catch((err) => toast.error(err instanceof Error ? err.message : "History unavailable.")) }}>History</button>
            </div>
          ),
        },
      ]
    }
    if (activeTab === "setup") {
      return [
        { key: "name", label: "Name", render: (row) => optionLabel(row) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} /> },
        { key: "updated", label: "Updated", render: (row) => formatDate(row.updatedAt ?? row.updated_at) },
        ...(setupKind === "policies" && canConfigure ? [{ key: "edit", label: "Actions", render: (row: AdminRecord) => <button type="button" className={actionButtonClass} onClick={(event: React.MouseEvent) => { event.stopPropagation(); setForm({ id: rowId(row), effective_from: String(row.effectiveFrom ?? row.effective_from ?? "").slice(0, 10), field_visit_plan_required: String(row.fieldVisitPlanRequired ?? row.field_visit_plan_required ?? false), allow_unplanned_visits: String(row.allowUnplannedVisits ?? row.allow_unplanned_visits ?? true), field_allow_gps_exception: String(row.fieldAllowGpsException ?? row.field_allow_gps_exception ?? false), field_attendance_mode: readString(row, ["fieldAttendanceMode", "field_attendance_mode"], "NONE"), field_plan_approval_required: row.fieldPlanApprovalRequired == null && row.field_plan_approval_required == null ? "DEFAULT" : String(row.fieldPlanApprovalRequired ?? row.field_plan_approval_required), field_max_gps_accuracy_meters: readString(row, ["fieldMaxGpsAccuracyMeters", "field_max_gps_accuracy_meters"], ""), field_follow_up_reminder_days: readString(row, ["fieldFollowUpReminderDays", "field_follow_up_reminder_days"], "1"), field_follow_up_escalation_days: readString(row, ["fieldFollowUpEscalationDays", "field_follow_up_escalation_days"], "3") }); setCreateMode("policy"); setCreateOpen(true) }}>Edit</button> }] : []),
      ]
    }
    return [
      { key: "visit", label: "Visit", render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{employeeLabel(row)}</p>
          <p className="text-xs text-muted-foreground">{readString(row, ["visitName", "visit_name", "purpose"], "Visit")} Â· {prettify(readString(row, ["visitType", "visit_type"], "VISIT"))}</p>
        </div>
      ) },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
      { key: "priority", label: "Priority", render: (row) => prettify(readString(row, ["priority"], "NORMAL")) },
      { key: "attachments", label: "Evidence", render: (row) => asRecordArray(row.attachments).map((item) => <button key={rowId(item)} type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); const token = readStoredToken(); if (!token) return; const name = readString(item, ["fileName", "file_name"], "attachment"); void downloadFieldAttachment(token, rowId(row), rowId(item), name, true).catch(() => downloadFieldAttachment(token, rowId(row), rowId(item), name, false, true)).then(({ blob, filename }) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }).catch((error) => toast.error(error instanceof Error ? error.message : "Download failed.")) }}>{readString(item, ["fileName", "file_name"], "Attachment")}</button>) },
      { key: "commercial", label: "Opportunities / values", render: (row) => {
        const opportunities = Array.isArray(row.opportunities) ? row.opportunities as AdminRecord[] : []
        if (!opportunities.length) return "â€”"
        return <div className="space-y-2">{opportunities.map((item, index) => <div key={rowId(item) || index} className="text-xs"><p>{readString(item, ["title"], "Opportunity")} Â· {readString(item, ["status"], "IDENTIFIED")}{item.potentialValue || item.potential_value ? ` Â· Sales ${readString(item, ["currency"], "")} ${readString(item, ["potentialValue", "potential_value"], "")}` : ""}{item.premiumValue || item.premium_value ? ` Â· Premium ${readString(item, ["premiumCurrency", "premium_currency"], "")} ${readString(item, ["premiumValue", "premium_value"], "")}` : ""}{item.actualValue || item.actual_value ? ` Â· Actual ${readString(item, ["currency"], "")} ${readString(item, ["actualValue", "actual_value"], "")}` : ""}{item.validatedByManager || item.validated_by_manager ? " Â· Validated" : " Â· Unvalidated"}</p><button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("opportunity-commercial"); setForm({ id: rowId(item), status: readString(item, ["status"], "IDENTIFIED"), actual_value: readString(item, ["actualValue", "actual_value"], ""), reason: "" }); setCreateOpen(true) }}>Update stage / actual value</button></div>)}</div>
      } },
      { key: "date", label: "Date", render: (row) => formatDate(row.visitDate ?? row.visit_date ?? row.plannedDate) },
      {
        key: "actions",
        label: "Actions",
        render: (row) => canReview && ["MANAGER_REVIEW_PENDING", "COMPLETED", "REVIEWED", "RETURNED"].includes(readString(row, ["status"], "")) ? (
          <button type="button" className={actionButtonClass} onClick={(event) => {
            event.stopPropagation()
            setCreateMode("review")
            setForm({ id: rowId(row), decision: "APPROVE", comments: "", kind: "visit", validate_opportunities: "false" })
            setCreateOpen(true)
          }}>Review</button>
        ) : null,
      },
    ]
  }, [activeTab, setupKind, canReview, canConfigure])

  if (!canAccess) return null

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Field"
            title="Visit operations"
            description="Open visits, exceptions, and the parties your team is covering."
            actions={
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            }
          />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm">From<DateInput className={inputClass} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label className="grid gap-1 text-sm">To<DateInput className={inputClass} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div>
          {operationsReport ? <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Planned visits" value={readNumber(operationsReport, ["planned"]) ?? 0} />
              <MetricTile label="Unplanned visits" value={readNumber(operationsReport, ["unplanned"]) ?? 0} />
              <MetricTile label="Overdue follow-ups" value={readNumber(operationsReport, ["overdue_follow_ups"]) ?? 0} />
              <MetricTile label="Attendance issues" value={readNumber(operationsReport, ["attendance_failures"]) ?? 0} />
            </div>
            <div className="grid gap-3 rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Visit outcomes and coverage</h2><button type="button" className={secondaryButtonClass} onClick={() => downloadOperationsCsv(operationsReport)}>Download report</button></div><p className="text-sm">Average visit duration: {operationsReport.average_duration_minutes == null ? "-" : `${operationsReport.average_duration_minutes} min`}</p><p className="text-sm">{operationsReport.status_counts && typeof operationsReport.status_counts === "object" ? Object.entries(operationsReport.status_counts as Record<string, unknown>).map(([key, value]) => `${prettify(key)}: ${value}`).join(" Â· ") : "No visits in this period."}</p><p className="text-xs text-muted-foreground">Party coverage counts completed visits in the selected period, ordered by oldest visit; parties without a completed visit are excluded.</p>{asRecordArray(operationsReport.party_coverage).slice(0, 15).map((party) => <p key={rowId(party)} className="text-sm">{readString(party, ["name"], "Party")} â€” {readString(party, ["visits"], "0")} visits, last {formatDate(party.last_visit)}</p>)}</div>
          </> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Open visits" value={readNumber(dashboard, ["open_visits", "openVisits"]) ?? visitRows.filter((item) => ["PLANNED", "CHECKED_IN"].includes(readString(item, ["status"], ""))).length} />
            <MetricTile label="Exceptions" value={readNumber(exceptions, ["total", "count", "exceptions", "returned_visits"]) ?? 0} />
            <MetricTile label="Checked in" value={readNumber(dashboard, ["checked_in", "checkedIn"]) ?? visitRows.filter((item) => readString(item, ["status"], "") === "CHECKED_IN").length} />
            <MetricTile label="Pending review" value={readNumber(dashboard, ["pending_visit_reviews", "pending_reviews", "pendingReviews"]) ?? visitRows.filter((item) => readString(item, ["status"], "") === "MANAGER_REVIEW_PENDING").length} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Visit mix</h2>
            <div className="mt-4"><StatusStack items={statusChartItems(visitRows)} /></div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "visits" ? "Field visits" : activeTab === "map" ? "Visit map" : activeTab === "parties" ? "Field parties" : "Field setup"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "parties" ? "Customers, prospects, and other places visits attach to." : "Review and operate on field activity you are allowed to see."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            {activeTab === "parties" ? (
              <button type="button" className={primaryButtonClass} onClick={() => { setCreateMode("party"); setForm({ party_type: "CUSTOMER" }); setCreateOpen(true) }}>
                <PlusIcon className="size-4" /> New party
              </button>
            ) : null}
            {activeTab === "visits" && canReview ? <button type="button" className={primaryButtonClass} onClick={() => { setCreateMode("assign-visit"); setForm({ visit_type: "CUSTOMER_VISIT", request_id: globalThis.crypto?.randomUUID?.() ?? "" }); setFormError(null); setCreateOpen(true) }}><PlusIcon className="size-4" />Assign visit</button> : null}
            {activeTab === "setup" ? (
              <button type="button" className={primaryButtonClass} onClick={() => { setCreateMode(setupKind === "policies" ? "policy" : "category"); setForm({}); setCreateOpen(true) }}>
                <PlusIcon className="size-4" /> New
              </button>
            ) : null}
            {activeTab === "setup" ? <button type="button" className={secondaryButtonClass} onClick={() => { setCreateMode("commercial-policy"); setForm({ default_currency: readString(commercialPolicy ?? {}, ["defaultCurrency", "default_currency"], "TZS"), supported_currencies: Array.isArray(commercialPolicy?.supportedCurrencies ?? commercialPolicy?.supported_currencies) ? ((commercialPolicy?.supportedCurrencies ?? commercialPolicy?.supported_currencies) as string[]).join(", ") : "TZS", allow_employee_opportunity_values: String(commercialPolicy?.allowEmployeeOpportunityValues ?? commercialPolicy?.allow_employee_opportunity_values ?? true) }); setCreateOpen(true) }}>Commercial policy</button> : null}
          </div>
        </div>
      )}

      {activeTab === "setup" ? (
        <div className="flex flex-wrap gap-1.5">
          {(["categories", "policies", "logs"] as const).map((kind) => (
            <button key={kind} type="button" onClick={() => setSetupKind(kind)} className={setupKind === kind ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold !text-white" : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"}>
              {prettify(kind)}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "visits" && commercialSummary ? <div className="grid gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-semibold">Commercial values by currency</h2><div className="grid gap-2 md:grid-cols-2">{[...asRecordArray(commercialSummary.sales_by_currency), ...asRecordArray(commercialSummary.premium_by_currency)].map((item, index) => <p key={`${readString(item, ["currency"], "")}-${index}`} className="text-xs">{readString(item, ["currency"], "TZS")}: {item.potential_value !== undefined ? `Potential ${readString(item, ["potential_value"], "0")} Â· validated actual ${readString(item, ["validated_actual_value"], "0")}` : `Premium ${readString(item, ["premium_value"], "0")}`}</p>)}</div><p className="text-xs text-muted-foreground">Stages: {asRecordArray(commercialSummary.opportunity_status_counts).map((item) => `${prettify(readString(item, ["status"], ""))} ${readString(item, ["opportunity_count"], "0")}`).join(" Â· ") || "No opportunities"}</p></div> : null}

      {activeTab === "visits" ? <section className="space-y-3 rounded-lg border bg-card p-3"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Team weekly calendar</h2><div className="flex gap-2"><button type="button" className={secondaryButtonClass} onClick={() => setWeekOffset((value) => value - 1)}>Previous</button><button type="button" className={secondaryButtonClass} onClick={() => setWeekOffset(0)}>This week</button><button type="button" className={secondaryButtonClass} onClick={() => setWeekOffset((value) => value + 1)}>Next</button></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{fieldWeekDates(weekOffset).map((day) => <div key={day.key} className="min-h-24 rounded-md border p-2"><p className="text-xs font-semibold">{day.label}</p>{visitRows.filter((visit) => String(visit.visitDate ?? visit.visit_date ?? "").slice(0, 10) === day.key).map((visit) => <button key={rowId(visit)} type="button" onClick={() => setDetail(visit)} className="mt-2 block w-full rounded bg-muted px-2 py-1 text-left text-xs"><span className="block font-medium">{readString(visit, ["visitName", "visit_name", "purpose"], "Visit")}</span><span>{employeeLabel(visit)} - {prettify(readString(visit, ["status"], ""))}</span></button>)}</div>)}</div></section> : null}

      {activeTab === "map" ? (
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
          {mapMarkers.length ? <AttendanceLocationMap center={mapMarkers[0]} markers={mapMarkers} height={380} /> : null}
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mapped visits in the current window.</p>
          ) : points.map((point, index) => (
            <div key={rowId(point) || index} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">{optionLabel(point) || employeeLabel(point)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(point, ["latitude", "lat", "event_latitude"], "â€”")}, {readString(point, ["longitude", "lng", "lon", "event_longitude"], "â€”")}
              </p>
            </div>
          ))}
        </div>
      ) : activeTab !== "overview" ? (
        <div className="space-y-3">
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Field records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`field-${activeTab}-${setupKind}`}
              onRowSelect={(_, row) => row && setDetail(row)}
            />
          </div>
          {activeTab === "visits" && plans.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ResizableTable title="Team visit plans" data={plans} columns={[
                { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
                { key: "date", label: "Date", render: (row) => formatDate(row.visitDate ?? row.visit_date) },
                { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
                { key: "items", label: "Visits", render: (row) => String(Array.isArray(row.items) ? row.items.length : 0) },
                { key: "actions", label: "Actions", render: (row) => canReview && readString(row, ["status"], "").toUpperCase() === "SUBMITTED" ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("review"); setForm({ id: rowId(row), decision: "APPROVE", comments: "", kind: "plan" }); setCreateOpen(true) }}>Review</button> : null },
              ]} loading={loading} itemsPerPage={20} showExport={false} storageKey="field-team-plans" onRowSelect={(_, row) => row && setDetail(row)} />
            </div>
          ) : null}
          {activeTab === "visits" ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ResizableTable title="Team follow-ups" data={followUps} columns={[
                { key: "action", label: "Action", render: (row) => readString(row, ["action"], "-") },
                { key: "visit", label: "Visit", render: (row) => readString(row, ["visit_name", "visitName"], "-") },
                { key: "owner", label: "Owner", render: (row) => { const employee = employees.find((item) => rowId(item) === String(row.assignedToEmployeeId ?? row.assigned_to_employee_id)); return employee ? employeeLabel(employee) : readString(row, ["assignedToEmployeeId", "assigned_to_employee_id"], "-") } },
                { key: "due", label: "Due", render: (row) => formatDate(row.dueDate ?? row.due_date) },
                { key: "priority", label: "Priority", render: (row) => prettify(readString(row, ["priority"], "NORMAL")) },
                { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
                { key: "actions", label: "Actions", render: (row) => canReview && readString(row, ["status"], "") === "OPEN" ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setForm({ id: rowId(row), employee_id: readString(row, ["assignedToEmployeeId", "assigned_to_employee_id"], ""), reason: "" }); setCreateMode("assign-follow-up"); setCreateOpen(true) }}>Assign</button> : null },
              ]} loading={loading} itemsPerPage={20} showExport={false} storageKey="field-team-follow-ups" />
            </div>
          ) : null}
          {activeTab === "visits" && corrections.length ? <div className="overflow-hidden rounded-xl border border-border bg-card"><ResizableTable title="Checkout correction requests" data={corrections} columns={[
            { key: "visit", label: "Visit", render: (row) => readString(row, ["fieldVisitId", "field_visit_id"], "-") },
            { key: "employee", label: "Employee", render: (row) => { const employee = employees.find((item) => rowId(item) === String(row.employeeId ?? row.employee_id)); return employee ? employeeLabel(employee) : readString(row, ["employeeId", "employee_id"], "-") } },
            { key: "time", label: "Requested checkout", render: (row) => row.requestedCheckoutAt || row.requested_checkout_at ? new Date(String(row.requestedCheckoutAt ?? row.requested_checkout_at)).toLocaleString() : "-" },
            { key: "reason", label: "Reason", render: (row) => readString(row, ["reason"], "-") },
            { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "PENDING")} /> },
            { key: "review", label: "Action", render: (row) => canReview && readString(row, ["status"], "") === "PENDING" ? <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("correction-review"); setForm({ id: rowId(row), decision: "APPROVE", comments: "" }); setCreateOpen(true) }}>Review</button> : null },
          ]} loading={loading} itemsPerPage={20} showExport={false} storageKey="field-checkout-corrections" onRowSelect={(_, row) => row && setDetail(row)} /></div> : null}
          {activeTab === "visits" && plannedVsActual.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ResizableTable
                title="Planned vs actual"
                data={plannedVsActual}
                columns={[
                  { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
                  { key: "planned", label: "Planned", render: (row) => readString(row, ["planned", "plannedCount", "planned_count"], "â€”") },
                  { key: "actual", label: "Actual", render: (row) => readString(row, ["actual", "actualCount", "actual_count"], "â€”") },
                  { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "â€”")} /> },
                ]}
                loading={false}
                itemsPerPage={20}
                showExport={false}
                storageKey="field-planned-vs-actual"
                onRowSelect={(_, row) => row && setDetail(row)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail)} row={detail} />
      <Dialog open={Boolean(partyHistory)} onOpenChange={(open) => { if (!open) setPartyHistory(null) }}><DialogPopup className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Party visit history</DialogTitle><DialogDescription>Visits visible to your role, including outcomes and follow-ups.</DialogDescription></DialogHeader><div className="space-y-3 text-sm">{asRecordArray(partyHistory?.visits).length ? asRecordArray(partyHistory?.visits).map((visit) => <div key={rowId(visit)} className="rounded-md border p-3"><p className="font-semibold">{readString(visit, ["visit_name", "purpose"], "Visit")} Â· {formatDate(visit.visit_date)}</p><p>{prettify(readString(visit, ["status"], ""))}: {readString(visit, ["outcome"], "No outcome recorded")}</p><p>{asRecordArray(visit.follow_ups).filter((item) => readString(item, ["status"], "") === "OPEN").length} open follow-ups</p></div>) : <p>No visits in your access scope.</p>}</div></DialogPopup></Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{createMode === "party" ? "Field party" : createMode === "review" ? "Review" : createMode === "correction-review" ? "Review checkout correction" : createMode === "policy" ? "Activity policy" : createMode === "assign-follow-up" ? "Assign follow-up" : createMode === "assign-visit" ? "Assign visit" : createMode === "commercial-policy" ? "Field visit commercial policy" : createMode === "opportunity-commercial" ? "Update opportunity stage and realized value" : "Activity category"}</DialogTitle>
            <DialogDescription>Save this field setup item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "party" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Name</span><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                {form.name?.trim() && parties.some((party) => rowId(party) !== form.id && readString(party, ["name"], "").toLowerCase() === form.name.trim().toLowerCase()) ? <p className="text-xs text-amber-700">A party with this name already exists. Check the directory before creating another.</p> : null}
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    value={form.party_type ?? "CUSTOMER"}
                    onChange={(value) => setForm((current) => ({ ...current, party_type: value }))}
                    options={PARTY_TYPES.map((item) => ({ value: item, label: prettify(item) }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Contact</span><input className={inputClass} value={form.contact_person ?? ""} onChange={(event) => setForm((current) => ({ ...current, contact_person: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Phone</span><input className={inputClass} value={form.phone ?? ""} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "category" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Code</span><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Name</span><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "policy" ? <>
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Effective from</span><DateInput className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Field attendance</span><FluentSelect ariaLabel="Field attendance" value={form.field_attendance_mode ?? "NONE"} onChange={(value) => setForm((current) => ({ ...current, field_attendance_mode: value }))} options={[{ value: "NONE", label: "Record visits only" }, { value: "START", label: "Start attendance on first field check-in" }, { value: "START_AND_END", label: "Start attendance and allow end workday" }, { value: "REVIEW", label: "Submit first field check-in for manager review" }]} /><span className="text-xs text-muted-foreground">Attendance punches still follow the employee&apos;s attendance, shift, location and device policy. Failed punches are shown for retry.</span></label>
              <label className="grid gap-1.5 text-sm">Plan approval before check-in<FluentSelect ariaLabel="Plan approval before check-in" value={form.field_plan_approval_required ?? "DEFAULT"} onChange={(value) => setForm((current) => ({ ...current, field_plan_approval_required: value }))} options={[{ value: "DEFAULT", label: "Use system default" }, { value: "true", label: "Require approval" }, { value: "false", label: "Approval not required" }]} /></label>
              <label className="grid gap-1.5 text-sm">Maximum GPS accuracy in metres<input type="number" min="1" max="5000" className={inputClass} value={form.field_max_gps_accuracy_meters ?? ""} onChange={(event) => setForm((current) => ({ ...current, field_max_gps_accuracy_meters: event.target.value }))} placeholder="Use system default" /></label>
              <label className="grid gap-1.5 text-sm">Remind before follow-up is due (days)<input type="number" min="0" max="30" className={inputClass} value={form.field_follow_up_reminder_days ?? "1"} onChange={(event) => setForm((current) => ({ ...current, field_follow_up_reminder_days: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm">Escalate overdue follow-up after (days)<input type="number" min="0" max="90" className={inputClass} value={form.field_follow_up_escalation_days ?? "3"} onChange={(event) => setForm((current) => ({ ...current, field_follow_up_escalation_days: event.target.value }))} /></label>
              {[{ key: "field_visit_plan_required", label: "Require field plans", defaultValue: false }, { key: "allow_unplanned_visits", label: "Allow unplanned visits", defaultValue: true }, { key: "field_allow_gps_exception", label: "Allow inaccurate GPS with a reason and manager review", defaultValue: false }].map(({ key, label, defaultValue }) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form[key] === undefined ? defaultValue : form[key] === "true"} onChange={(event) => setForm((current) => ({ ...current, [key]: String(event.target.checked) }))} />{label}</label>)}
            </> : null}
            {createMode === "assign-follow-up" ? <>
              {employees.length ? <label className="grid gap-1.5 text-sm">Employee<FluentSelect ariaLabel="Employee" value={form.employee_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))} options={[{ value: "", label: "Choose employee" }, ...employees.map((employee) => ({ value: rowId(employee), label: employeeLabel(employee) }))]} /></label> : <label className="grid gap-1.5 text-sm">Employee ID<input type="number" min="1" className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} /></label>}
              <label className="grid gap-1.5 text-sm">Reason<Textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
            </> : null}
            {createMode === "assign-visit" ? <>
              {employees.length ? <label className="grid gap-1.5 text-sm">Employee<FluentSelect ariaLabel="Assigned employee" value={form.employee_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, employee_id: value }))} options={[{ value: "", label: "Choose employee" }, ...employees.map((employee) => ({ value: rowId(employee), label: employeeLabel(employee) }))]} /></label> : <label className="grid gap-1.5 text-sm">Employee ID<input type="number" min="1" className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} /></label>}
              <label className="grid gap-1.5 text-sm">Visit name<input className={inputClass} maxLength={200} value={form.visit_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, visit_name: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm">Priority<FluentSelect ariaLabel="Visit priority" value={form.priority ?? "NORMAL"} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} options={["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({ value, label: prettify(value) }))} /></label>
              <label className="grid gap-1.5 text-sm">Visit type<FluentSelect ariaLabel="Visit type" value={form.visit_type ?? "CUSTOMER_VISIT"} onChange={(value) => setForm((current) => ({ ...current, visit_type: value }))} options={["CUSTOMER_VISIT", "PROSPECT_VISIT", "BROKER_VISIT", "INTERMEDIARY_VISIT", "RENEWAL_FOLLOW_UP", "COLLECTION_FOLLOW_UP", "CLAIM_INSPECTION", "RISK_INSPECTION", "RECOVERY_VISIT", "BRANCH_VISIT", "REGULATORY_VISIT", "SPECIAL_ASSIGNMENT", "OTHER"].map((value) => ({ value, label: prettify(value) }))} /></label>
              <label className="grid gap-1.5 text-sm">Party<FluentSelect ariaLabel="Party" value={form.field_party_id ?? ""} onChange={(value) => setForm((current) => ({ ...current, field_party_id: value }))} options={[{ value: "", label: "None" }, ...parties.map((party) => ({ value: rowId(party), label: optionLabel(party) }))]} /></label>
              <label className="grid gap-1.5 text-sm">Date<DateInput className={inputClass} value={form.visit_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, visit_date: event.target.value }))} /></label>
              <div className="grid grid-cols-2 gap-2">{(["start_time", "end_time"] as const).map((key) => <label key={key} className="grid gap-1.5 text-sm">{key === "start_time" ? "Start time" : "End time"}<input type="time" className={inputClass} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
              <label className="grid gap-1.5 text-sm">Purpose<Textarea className={textareaClass} value={form.purpose ?? ""} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} /></label>
              <label className="grid gap-1.5 text-sm">Expected outcome<Textarea className={textareaClass} value={form.expected_outcome ?? ""} onChange={(event) => setForm((current) => ({ ...current, expected_outcome: event.target.value }))} /></label>
              <p className="text-xs text-muted-foreground">A new plan is approved on assignment. For an existing day, the visit is added to an approved or in-progress plan; draft or submitted plans must be reviewed first.</p>
            </> : null}
            {createMode === "correction-review" ? <><label className="grid gap-1.5 text-sm">Decision<FluentSelect ariaLabel="Correction decision" value={form.decision ?? "APPROVE"} onChange={(value) => setForm((current) => ({ ...current, decision: value }))} options={[{ value: "APPROVE", label: "Approve" }, { value: "REJECT", label: "Reject" }]} /></label><label className="grid gap-1.5 text-sm">Comments<Textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} /></label><p className="text-xs text-muted-foreground">Approving corrects the visit checkout. Attendance must be corrected separately.</p></> : null}
            {createMode === "review" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Decision</span>
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
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Comments</span><Textarea className={textareaClass} value={form.comments ?? ""} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} /></label>
                {form.kind !== "plan" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-sky-700" checked={form.validate_opportunities === "true"} onChange={(event) => setForm((current) => ({ ...current, validate_opportunities: event.target.checked ? "true" : "false" }))} /><span>Validate all opportunities on this visit</span></label> : null}
              </>
            ) : null}
            {createMode === "commercial-policy" ? <><label className="grid gap-1.5 text-sm"><span className="font-medium">Default currency</span><input maxLength={3} className={inputClass} value={form.default_currency ?? "TZS"} onChange={(event) => setForm((current) => ({ ...current, default_currency: event.target.value }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Supported currencies (comma separated)</span><input className={inputClass} value={form.supported_currencies ?? "TZS"} onChange={(event) => setForm((current) => ({ ...current, supported_currencies: event.target.value }))} /><span className="text-xs text-muted-foreground">Current default: {readString(commercialPolicy ?? {}, ["defaultCurrency", "default_currency"], "TZS")} Â· HRMS validates employee entered values against this list.</span></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-sky-700" checked={form.allow_employee_opportunity_values === "true"} onChange={(event) => setForm((current) => ({ ...current, allow_employee_opportunity_values: event.target.checked ? "true" : "false" }))} /><span>Allow employees to record opportunity forecasts</span></label></> : null}
            {createMode === "opportunity-commercial" ? <><label className="grid gap-1.5 text-sm"><span className="font-medium">Opportunity stage</span><FluentSelect ariaLabel="Opportunity stage" value={form.status ?? "IDENTIFIED"} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={["IDENTIFIED", "FOLLOW_UP", "QUOTATION_ISSUED", "WON", "LOST", "DEFERRED", "CANCELLED"].map((item) => ({ value: item, label: prettify(item) }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Realized sales value</span><input type="number" min="0" step="0.01" className={inputClass} value={form.actual_value ?? ""} onChange={(event) => setForm((current) => ({ ...current, actual_value: event.target.value }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Reason for change (audit)</span><Textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label></> : null}
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
