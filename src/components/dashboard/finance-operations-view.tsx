"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

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
  approveEmployeeFinanceApplication,
  approveHrEmployeeFinanceApplication,
  createEmployeeFinanceDisbursement,
  createEmployeeFinanceProduct,
  createEmployeeFinanceRepayment,
  createEmployeeFinanceSettlementQuote,
  evaluateEmployeeFinanceEligibility,
  getEmployeeFinanceDashboard,
  listEmployeeFinanceAccounts,
  listEmployeeFinanceApplications,
  listEmployeeFinanceProducts,
  recommendEmployeeFinanceApplication,
  requestEmployeeFinanceDeferment,
  requestEmployeeFinanceReschedule,
  runEmployeeFinanceReconciliation,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type FinanceOpsTab = "overview" | "products" | "applications" | "accounts"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function FinanceOperationsView({ activeTab }: { activeTab: FinanceOpsTab }) {
  const actor = useDashboardActor()
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/finance/overview", actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [products, setProducts] = React.useState<AdminRecord[]>([])
  const [applications, setApplications] = React.useState<AdminRecord[]>([])
  const [accounts, setAccounts] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"product" | "disburse" | "repay" | "defer" | "reschedule">("product")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
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
    const tasks: Array<Promise<unknown>> = [
      getEmployeeFinanceDashboard(token).then(setDashboard).catch(() => setDashboard(null)),
    ]
    if (activeTab === "products" || activeTab === "overview") {
      tasks.push(listEmployeeFinanceProducts(token).then(setProducts).catch(() => setProducts([])))
    }
    if (activeTab === "applications" || activeTab === "overview") {
      tasks.push(listEmployeeFinanceApplications(token).then(setApplications).catch(() => setApplications([])))
    }
    if (activeTab === "accounts" || activeTab === "overview") {
      tasks.push(listEmployeeFinanceAccounts(token).then(setAccounts).catch(() => setAccounts([])))
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load finance data.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const rows =
    activeTab === "products" ? products : activeTab === "accounts" ? accounts : applications
  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "product") {
        if (!form.code || !form.name || !form.minimum_amount || !form.maximum_term_months || !form.effective_from) {
          throw new Error("Code, name, minimum amount, term, and effective from are required.")
        }
        await createEmployeeFinanceProduct(token, {
          product_type: form.product_type || "STAFF_LOAN",
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          interest_method: form.interest_method || undefined,
          annual_interest_rate: form.annual_interest_rate || undefined,
          minimum_amount: form.minimum_amount,
          maximum_amount: form.maximum_amount || undefined,
          maximum_term_months: Number(form.maximum_term_months),
          effective_from: form.effective_from,
        })
      } else if (createMode === "disburse") {
        if (!form.account_id || !form.amount || !form.payment_reference || !form.payment_date) {
          throw new Error("Account, amount, reference, and date are required.")
        }
        await createEmployeeFinanceDisbursement(token, {
          account_id: Number(form.account_id),
          amount: form.amount,
          payment_reference: form.payment_reference,
          payment_date: form.payment_date,
        })
      } else if (createMode === "repay") {
        if (!form.account_id || !form.amount || !form.payment_date) throw new Error("Account, amount, and date are required.")
        await createEmployeeFinanceRepayment(token, {
          account_id: Number(form.account_id),
          amount: form.amount,
          payment_date: form.payment_date,
          payment_reference: form.payment_reference || undefined,
        })
      } else if (createMode === "defer") {
        if (!form.account_id || !form.installment_id || !form.reason) throw new Error("Installment and reason are required.")
        await requestEmployeeFinanceDeferment(token, form.account_id, {
          installment_id: Number(form.installment_id),
          reason: form.reason,
        })
      } else if (createMode === "reschedule") {
        if (!form.account_id || !form.new_term_months || !form.reason) throw new Error("New term and reason are required.")
        await requestEmployeeFinanceReschedule(token, form.account_id, {
          new_term_months: Number(form.new_term_months),
          reason: form.reason,
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
    if (activeTab === "products") {
      return [
        { key: "product", label: "Product", render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{optionLabel(row)}</p>
            <p className="text-xs text-muted-foreground">{prettify(readString(row, ["productType", "product_type"], "STAFF_LOAN"))}</p>
          </div>
        ) },
        { key: "amount", label: "Min amount", render: (row) => readString(row, ["minimumAmount", "minimum_amount"], "—") },
        { key: "term", label: "Max term", render: (row) => readString(row, ["maximumTermMonths", "maximum_term_months"], "—") },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "ACTIVE")} /> },
      ]
    }
    if (activeTab === "accounts") {
      return [
        { key: "account", label: "Account", render: (row) => employeeLabel(row) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
        { key: "balance", label: "Balance", render: (row) => readString(row, ["outstandingBalance", "outstanding_balance", "balance"], "—") },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("disburse"); setForm({ account_id: rowId(row), payment_date: new Date().toISOString().slice(0, 10) }); setCreateOpen(true) }}>Disburse</button>
              <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("repay"); setForm({ account_id: rowId(row), payment_date: new Date().toISOString().slice(0, 10) }); setCreateOpen(true) }}>Repay</button>
              <button type="button" className={actionButtonClass} onClick={(event) => { event.stopPropagation(); setCreateMode("reschedule"); setForm({ account_id: rowId(row) }); setCreateOpen(true) }}>Reschedule</button>
              <button type="button" className={actionButtonClass} disabled={busyId === rowId(row)} onClick={(event) => {
                event.stopPropagation()
                const token = readStoredToken()
                const id = rowId(row)
                if (!token || !id) return
                setBusyId(id)
                void createEmployeeFinanceSettlementQuote(token, id)
                  .then(() => toast.success("Settlement quote created."))
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not quote."))
                  .finally(() => setBusyId(""))
              }}>Quote</button>
            </div>
          ),
        },
      ]
    }
    return [
      { key: "app", label: "Application", render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{employeeLabel(row)}</p>
          <p className="text-xs text-muted-foreground">{readString(row, ["purpose"], optionLabel(row))}</p>
        </div>
      ) },
      { key: "amount", label: "Amount", render: (row) => readString(row, ["requestedAmount", "requested_amount"], "—") },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row)
          return (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={actionButtonClass} disabled={busyId === `rec-${id}`} onClick={(event) => {
                event.stopPropagation()
                const token = readStoredToken()
                if (!token || !id) return
                setBusyId(`rec-${id}`)
                void recommendEmployeeFinanceApplication(token, id)
                  .then(() => { toast.success("Recommended."); return load() })
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not recommend."))
                  .finally(() => setBusyId(""))
              }}>Recommend</button>
              <button type="button" className={actionButtonClass} disabled={busyId === `hr-${id}`} onClick={(event) => {
                event.stopPropagation()
                const token = readStoredToken()
                if (!token || !id) return
                setBusyId(`hr-${id}`)
                void approveHrEmployeeFinanceApplication(token, id)
                  .then(() => { toast.success("HR approved."); return load() })
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not approve."))
                  .finally(() => setBusyId(""))
              }}>HR approve</button>
              <button type="button" className={actionButtonClass} disabled={busyId === `fin-${id}`} onClick={(event) => {
                event.stopPropagation()
                const token = readStoredToken()
                if (!token || !id) return
                setBusyId(`fin-${id}`)
                void approveEmployeeFinanceApplication(token, id)
                  .then(() => { toast.success("Finance approved."); return load() })
                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not approve."))
                  .finally(() => setBusyId(""))
              }}>Finance approve</button>
            </div>
          )
        },
      },
    ]
  }, [activeTab, busyId, load])

  if (!canAccess) return null

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Finance"
            title="Staff loans and advances"
            description="Products, applications, and accounts you are allowed to operate."
            actions={
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            }
          />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Open accounts" value={readNumber(dashboard, ["open_accounts", "openAccounts"]) ?? accounts.length} />
            <MetricTile label="Applications" value={applications.length} />
            <MetricTile label="Products" value={products.length} />
            <MetricTile label="Outstanding" value={readString(dashboard, ["outstanding", "outstanding_balance"], "—")} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Application mix</h2>
            <div className="mt-4"><StatusStack items={statusChartItems(applications)} /></div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "products" ? "Finance products" : activeTab === "accounts" ? "Finance accounts" : "Applications"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "products" ? "Staff loan and salary advance products." : "Act only on records your permissions allow."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            {activeTab === "products" ? (
              <>
                <button type="button" className={secondaryButtonClass} onClick={() => {
                  const token = readStoredToken()
                  if (!token) return
                  void evaluateEmployeeFinanceEligibility(token, {
                    employee_id: Number(form.employee_id || 0) || undefined,
                    product_id: Number(rowId(products[0])),
                  }).then(() => toast.success("Eligibility checked.")).catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not check eligibility."))
                }}>Check eligibility</button>
                <button type="button" className={primaryButtonClass} onClick={() => { setCreateMode("product"); setForm({ product_type: "STAFF_LOAN", interest_method: "FLAT_RATE" }); setCreateOpen(true) }}>
                  <PlusIcon className="size-4" /> New product
                </button>
              </>
            ) : null}
            {activeTab === "accounts" ? (
              <button type="button" className={secondaryButtonClass} onClick={() => {
                const token = readStoredToken()
                if (!token) return
                void runEmployeeFinanceReconciliation(token).then(() => toast.success("Reconciliation started.")).catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not reconcile."))
              }}>Reconcile</button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Finance records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`finance-${activeTab}`}
              onRowSelect={(_, row) => row && setDetail(row)}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail)} row={detail} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {createMode === "product" ? "New product" : createMode === "disburse" ? "Disburse" : createMode === "repay" ? "Repayment" : createMode === "defer" ? "Deferment" : "Reschedule"}
            </DialogTitle>
            <DialogDescription>Save this finance record for the employee.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "product" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Type</span>
                  <select className={inputClass} value={form.product_type ?? "STAFF_LOAN"} onChange={(event) => setForm((current) => ({ ...current, product_type: event.target.value }))}>
                    <option value="STAFF_LOAN">Staff loan</option>
                    <option value="SALARY_ADVANCE">Salary advance</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Code</span><input className={inputClass} value={form.code ?? ""} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Name</span><input className={inputClass} value={form.name ?? ""} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Minimum amount</span><input className={inputClass} value={form.minimum_amount ?? ""} onChange={(event) => setForm((current) => ({ ...current, minimum_amount: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Maximum term (months)</span><input className={inputClass} value={form.maximum_term_months ?? ""} onChange={(event) => setForm((current) => ({ ...current, maximum_term_months: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Effective from</span><input type="date" className={inputClass} value={form.effective_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "disburse" || createMode === "repay" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Amount</span><input className={inputClass} value={form.amount ?? ""} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Payment date</span><input type="date" className={inputClass} value={form.payment_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, payment_date: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Reference</span><input className={inputClass} value={form.payment_reference ?? ""} onChange={(event) => setForm((current) => ({ ...current, payment_reference: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "reschedule" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">New term (months)</span><input className={inputClass} value={form.new_term_months ?? ""} onChange={(event) => setForm((current) => ({ ...current, new_term_months: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Reason</span><textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
              </>
            ) : null}
            {createMode === "defer" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Installment ID</span><input className={inputClass} value={form.installment_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, installment_id: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Reason</span><textarea className={textareaClass} value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
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
