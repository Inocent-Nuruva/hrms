"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
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
  getManagerFieldVisitDashboard,
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
  listManagerFieldVisits,
  reviewManagerFieldVisit,
  reviewManagerFieldVisitPlan,
  saveManagerFieldVisitCommercialPolicy,
  updateManagerFieldOpportunityCommercial,
  updateFieldParty,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type FieldOpsTab = "overview" | "visits" | "map" | "parties" | "setup"

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

export function FieldOperationsView({ activeTab }: { activeTab: FieldOpsTab }) {
  const actor = useDashboardActor()
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/field/overview", actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [exceptions, setExceptions] = React.useState<AdminRecord | null>(null)
  const [visits, setVisits] = React.useState<AdminRecord[]>([])
  const [plannedVsActual, setPlannedVsActual] = React.useState<AdminRecord[]>([])
  const [managerVisits, setManagerVisits] = React.useState<AdminRecord[]>([])
  const [plans, setPlans] = React.useState<AdminRecord[]>([])
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
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"party" | "category" | "policy" | "review" | "commercial-policy" | "opportunity-commercial">("party")
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
      )
    }
    if (activeTab === "visits") {
      tasks.push(
        listHrFieldVisits(token, { limit: 100 }).then(setVisits).catch(() => setVisits([])),
        listManagerFieldVisits(token).then(setManagerVisits).catch(() => setManagerVisits([])),
        listManagerFieldVisitPlans(token).then(setPlans).catch(() => setPlans([])),
        listManagerFieldPlannedVsActual(token, { limit: 50 }).then(setPlannedVsActual).catch(() => setPlannedVsActual([])),
        getManagerFieldVisitCommercialSummary(token).then(setCommercialSummary).catch(() => setCommercialSummary(null)),
      )
    }
    if (activeTab === "map") {
      tasks.push(getHrFieldVisitsMap(token).then(setMapRecord).catch(() => setMapRecord(null)))
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
  }, [activeTab, leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const visitRows = visits.length > 0 ? visits : managerVisits
  const visible = (activeTab === "parties" ? parties : activeTab === "setup" ? (setupKind === "categories" ? categories : setupKind === "policies" ? policies : logs) : visitRows)
    .filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  const points = asRecordArray(mapRecord?.items ?? mapRecord?.points ?? mapRecord?.visits)

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
        await createActivityPolicy(token, {
          effective_from: form.effective_from,
          field_visit_plan_required: form.field_visit_plan_required === "true",
          allow_unplanned_visits: form.allow_unplanned_visits !== "false",
          require_visit_selfie: form.require_visit_selfie === "true",
        })
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
        { key: "contact", label: "Contact", render: (row) => readString(row, ["contactPerson", "contact_person", "phone"], "—") },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
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
          ),
        },
      ]
    }
    if (activeTab === "setup") {
      return [
        { key: "name", label: "Name", render: (row) => optionLabel(row) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} /> },
        { key: "updated", label: "Updated", render: (row) => formatDate(row.updatedAt ?? row.updated_at) },
      ]
    }
    return [
      { key: "visit", label: "Visit", render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{employeeLabel(row)}</p>
          <p className="text-xs text-muted-foreground">{prettify(readString(row, ["visitType", "visit_type"], "VISIT"))}</p>
        </div>
      ) },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
      { key: "commercial", label: "Opportunities / values", render: (row) => {
        const opportunities = Array.isArray(row.opportunities) ? row.opportunities as AdminRecord[] : []
        if (!opportunities.length) return "—"
        return <div className="space-y-2">{opportunities.map((item, index) => <div key={rowId(item) || index} className="text-xs"><p>{readString(item, ["title"], "Opportunity")} · {readString(item, ["status"], "IDENTIFIED")}{item.potentialValue || item.potential_value ? ` · Sales ${readString(item, ["currency"], "")} ${readString(item, ["potentialValue", "potential_value"], "")}` : ""}{item.premiumValue || item.premium_value ? ` · Premium ${readString(item, ["premiumCurrency", "premium_currency"], "")} ${readString(item, ["premiumValue", "premium_value"], "")}` : ""}{item.actualValue || item.actual_value ? ` · Actual ${readString(item, ["currency"], "")} ${readString(item, ["actualValue", "actual_value"], "")}` : ""}{item.validatedByManager || item.validated_by_manager ? " · Validated" : " · Unvalidated"}</p><button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("opportunity-commercial"); setForm({ id: rowId(item), status: readString(item, ["status"], "IDENTIFIED"), actual_value: readString(item, ["actualValue", "actual_value"], ""), reason: "" }); setCreateOpen(true) }}>Update stage / actual value</button></div>)}</div>
      } },
      { key: "date", label: "Date", render: (row) => formatDate(row.visitDate ?? row.visit_date ?? row.plannedDate) },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <button type="button" className={actionButtonClass} onClick={(event) => {
            event.stopPropagation()
            setCreateMode("review")
            setForm({ id: rowId(row), decision: "APPROVE", comments: "", kind: "visit", validate_opportunities: "false" })
            setCreateOpen(true)
          }}>Review</button>
        ),
      },
    ]
  }, [activeTab])

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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Open visits" value={readNumber(dashboard, ["open_visits", "openVisits"]) ?? visits.length} />
            <MetricTile label="Exceptions" value={readNumber(exceptions, ["total", "count", "exceptions"]) ?? 0} />
            <MetricTile label="Checked in" value={readNumber(dashboard, ["checked_in", "checkedIn"]) ?? "—"} />
            <MetricTile label="Pending review" value={readNumber(dashboard, ["pending_reviews", "pendingReviews"]) ?? plans.length} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Visit mix</h2>
            <div className="mt-4"><StatusStack items={statusChartItems(visits)} /></div>
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

      {activeTab === "visits" && commercialSummary ? <div className="grid gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-semibold">Commercial values by currency</h2><div className="grid gap-2 md:grid-cols-2">{[...asRecordArray(commercialSummary.sales_by_currency), ...asRecordArray(commercialSummary.premium_by_currency)].map((item, index) => <p key={`${readString(item, ["currency"], "")}-${index}`} className="text-xs">{readString(item, ["currency"], "TZS")}: {item.potential_value !== undefined ? `Potential ${readString(item, ["potential_value"], "0")} · validated actual ${readString(item, ["validated_actual_value"], "0")}` : `Premium ${readString(item, ["premium_value"], "0")}`}</p>)}</div><p className="text-xs text-muted-foreground">Stages: {asRecordArray(commercialSummary.opportunity_status_counts).map((item) => `${prettify(readString(item, ["status"], ""))} ${readString(item, ["opportunity_count"], "0")}`).join(" · ") || "No opportunities"}</p></div> : null}

      {activeTab === "map" ? (
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mapped visits in the current window.</p>
          ) : points.map((point, index) => (
            <div key={rowId(point) || index} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">{optionLabel(point) || employeeLabel(point)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(point, ["latitude", "lat"], "—")}, {readString(point, ["longitude", "lng", "lon"], "—")}
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
          {activeTab === "visits" && plannedVsActual.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ResizableTable
                title="Planned vs actual"
                data={plannedVsActual}
                columns={[
                  { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
                  { key: "planned", label: "Planned", render: (row) => readString(row, ["planned", "plannedCount", "planned_count"], "—") },
                  { key: "actual", label: "Actual", render: (row) => readString(row, ["actual", "actualCount", "actual_count"], "—") },
                  { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "—")} /> },
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{createMode === "party" ? "Field party" : createMode === "review" ? "Review" : createMode === "policy" ? "Activity policy" : createMode === "commercial-policy" ? "Field visit commercial policy" : createMode === "opportunity-commercial" ? "Update opportunity stage and realized value" : "Activity category"}</DialogTitle>
            <DialogDescription>Save this field setup item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "party" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Name</span><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
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
            {createMode === "policy" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Effective from</span><DateInput className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
            ) : null}
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
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-sky-700" checked={form.validate_opportunities === "true"} onChange={(event) => setForm((current) => ({ ...current, validate_opportunities: event.target.checked ? "true" : "false" }))} /><span>Validate all opportunities on this visit</span></label>
              </>
            ) : null}
            {createMode === "commercial-policy" ? <><label className="grid gap-1.5 text-sm"><span className="font-medium">Default currency</span><input maxLength={3} className={inputClass} value={form.default_currency ?? "TZS"} onChange={(event) => setForm((current) => ({ ...current, default_currency: event.target.value }))} /></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Supported currencies (comma separated)</span><input className={inputClass} value={form.supported_currencies ?? "TZS"} onChange={(event) => setForm((current) => ({ ...current, supported_currencies: event.target.value }))} /><span className="text-xs text-muted-foreground">Current default: {readString(commercialPolicy ?? {}, ["defaultCurrency", "default_currency"], "TZS")} · HRMS validates employee entered values against this list.</span></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-sky-700" checked={form.allow_employee_opportunity_values === "true"} onChange={(event) => setForm((current) => ({ ...current, allow_employee_opportunity_values: event.target.checked ? "true" : "false" }))} /><span>Allow employees to record opportunity forecasts</span></label></> : null}
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
