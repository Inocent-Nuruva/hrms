"use client"

import * as React from "react"
import {
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import {
  RecordDetailsDialog,
  formatAdminValue,
} from "@/components/dashboard/admin-view-shared"
import {
  approvePayrollInput,
  approvePayrollRun,
  createPayrollAccountingMapping,
  createPayrollCalendar,
  createPayrollComponent,
  createPayrollInput,
  createPayrollRun,
  createPayrollSalaryStructure,
  createPayrollStatutoryRule,
  createPayrollStatutoryScheme,
  downloadPayrollBankingBatch,
  generatePayrollAccountingJournals,
  generatePayrollBankingBatch,
  generatePayrollPayslipsForRun,
  generatePayrollPeriod,
  calculatePayrollFinalSettlement,
  getPayrollDashboard,
  getPayrollRun,
  getPayrollSalaryStructure,
  listEmployeePayrollProfiles,
  listOffboardingRequests,
  listPayrollAccountingMappings,
  listPayrollCalendars,
  listPayrollComponents,
  listPayrollInputs,
  listPayrollPayslipsForRun,
  listPayrollPeriods,
  listPayrollRuns,
  listPayrollSalaryStructures,
  listPayrollStatutorySchemes,
  lockPayrollRun,
  processPayrollRun,
  runPayrollReconciliation,
  runPayrollRunVariance,
  type AdminRecord,
  upsertEmployeePayrollProfile,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Badge } from "@/components/ui/badge"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

type PayrollTab =
  | "overview"
  | "runs"
  | "inputs"
  | "profiles"
  | "periods"
  | "reports"
  | "configuration"

type PayrollConfigTab =
  | "components"
  | "calendars"
  | "structures"
  | "schemes"
  | "mappings"

type CreateDialogMode =
  | "run"
  | "input"
  | "profile"
  | "period"
  | "component"
  | "calendar"
  | "structure"
  | "scheme"
  | "mapping"

const TABS: Array<{ id: PayrollTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "runs", label: "Runs" },
  { id: "inputs", label: "Inputs" },
  { id: "profiles", label: "Profiles" },
  { id: "periods", label: "Periods" },
  { id: "reports", label: "Reports" },
  { id: "configuration", label: "Configuration" },
]

const CONFIG_TABS: Array<{ id: PayrollConfigTab; label: string }> = [
  { id: "components", label: "Components" },
  { id: "calendars", label: "Calendars" },
  { id: "structures", label: "Structures" },
  { id: "schemes", label: "Schemes" },
  { id: "mappings", label: "Mappings" },
]

const RUN_TYPES = [
  "REGULAR",
  "SUPPLEMENTARY",
  "OFF_CYCLE",
  "FINAL_SETTLEMENT",
  "REVERSAL",
  "PARALLEL_TEST",
] as const

const APPROVAL_STAGES = ["HR", "FINANCE", "MANAGEMENT"] as const
const INPUT_STATUSES = [
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "LOCKED",
  "PENDING_LOAN_INTEGRATION",
] as const
const COMPONENT_TYPES = [
  "EARNING",
  "DEDUCTION",
  "EMPLOYER_CONTRIBUTION",
  "EMPLOYER_LEVY",
  "REIMBURSEMENT",
  "TAXABLE_BENEFIT",
  "INFORMATIONAL",
] as const
const FREQUENCIES = ["RECURRING", "ONE_TIME", "DAILY", "HOURLY", "ANNUAL"] as const
const CALCULATION_METHODS = [
  "FIXED_AMOUNT",
  "PERCENTAGE_OF_BASE",
  "PERCENTAGE_OF_GROSS",
  "PERCENTAGE_OF_COMPONENTS",
  "QUANTITY_TIMES_RATE",
  "PROGRESSIVE_BANDS",
  "THRESHOLD_BANDS",
  "FORMULA_TEMPLATE",
  "EXTERNAL_INPUT",
] as const
const TAX_TREATMENTS = [
  "TAXABLE",
  "NON_TAXABLE",
  "PARTIALLY_TAXABLE",
  "TAX_EXEMPT",
] as const
const SCHEME_TYPES = ["PAYE", "PENSION", "HEALTH_INSURANCE", "EMPLOYER_LEVY", "OTHER"] as const
const PAYMENT_METHODS = ["BANK_TRANSFER", "MOBILE_MONEY", "CASH", "CHEQUE"] as const
const PAY_FREQUENCIES = ["MONTHLY", "SEMI_MONTHLY", "BIWEEKLY", "WEEKLY"] as const

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
const textareaClass =
  "min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
const actionButtonClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"
const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function readString(row: AdminRecord | null | undefined, keys: string[], fallback = "") {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "boolean") return value ? "true" : "false"
  }
  return fallback
}

function readNumber(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readBoolean(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return false
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (value === 1 || value === "1" || value === "true") return true
    if (value === 0 || value === "0" || value === "false") return false
  }
  return false
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is AdminRecord =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  )
}

function prettify(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatCurrencyAmount(value: unknown, currencyHint?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${currencyHint ?? ""} ${value.toLocaleString()}`.trim()
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return `${currencyHint ?? ""} ${parsed.toLocaleString()}`.trim()
    }
    return value
  }
  return "—"
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function optionLabel(row: AdminRecord) {
  return (
    readString(row, ["name", "title", "code", "display_name", "displayName"]) ||
    `#${readNumber(row, ["id"]) ?? "record"}`
  )
}

function rowId(row: AdminRecord | null | undefined) {
  const id = readNumber(row, ["id", "runId", "run_id", "profileId", "profile_id"])
  return id !== null ? String(id) : ""
}

function statusTone(label: string) {
  const normalized = label.toUpperCase()
  if (
    ["ACTIVE", "APPROVED", "COMPLETED", "SUCCESS", "LOCKED", "READY", "GENERATED"].includes(
      normalized,
    )
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
  }
  if (
    ["PENDING", "DRAFT", "PROCESSING", "RUNNING", "IN_PROGRESS"].includes(normalized)
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"
  }
  if (["FAILED", "REJECTED", "ERROR", "HOLD"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
  }
  return "border-border bg-muted/40 text-muted-foreground"
}

function readPeriodLabel(row: AdminRecord | null | undefined) {
  if (!row) return "—"
  return (
    readString(row, ["name", "title", "period_name", "periodName"]) ||
    [
      readString(row, ["month"]),
      readString(row, ["year"]),
    ]
      .filter(Boolean)
      .join(" / ") ||
    `Period #${readNumber(row, ["id"]) ?? "—"}`
  )
}

function readEmployeeLabel(row: AdminRecord | null | undefined) {
  if (!row) return "—"
  const nestedEmployee =
    (typeof row.employee === "object" && row.employee && !Array.isArray(row.employee)
      ? (row.employee as AdminRecord)
      : null) ?? null
  return (
    readString(row, ["employee_name", "employeeName", "full_name", "fullName"]) ||
    readString(nestedEmployee, ["full_name", "fullName", "name"]) ||
    (readNumber(row, ["employee_id", "employeeId"]) !== null
      ? `Employee #${readNumber(row, ["employee_id", "employeeId"])}`
      : "—")
  )
}

function readStatus(row: AdminRecord | null | undefined) {
  return readString(row, ["status", "run_status", "state", "approval_status"], "UNKNOWN")
}

function emptyRunForm() {
  return {
    payrollPeriodId: "",
    runType: "REGULAR",
    parentRunId: "",
    offboardingRequestId: "",
  }
}

function emptyInputForm() {
  return {
    payrollPeriodId: "",
    employeeId: "",
    componentCode: "",
    sourceModule: "",
    sourceReference: "",
    amount: "",
    quantity: "",
    rate: "",
    currency: "TZS",
    status: "DRAFT",
  }
}

function emptyProfileForm() {
  return {
    employeeId: "",
    payrollNumber: "",
    taxpayerIdentificationNumber: "",
    socialSecuritySchemeCode: "",
    socialSecurityNumber: "",
    healthInsuranceSchemeCode: "",
    healthInsuranceNumber: "",
    taxResidencyCode: "",
    employmentTaxCategory: "",
    paymentMethod: "",
    primaryBankAccountId: "",
    currency: "TZS",
    payFrequency: "MONTHLY",
    payrollEnabled: "true",
    payrollHold: "false",
    payrollHoldReason: "",
    effectiveFrom: "",
    effectiveTo: "",
  }
}

function emptyPeriodForm() {
  const today = new Date()
  return {
    payrollCalendarId: "",
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1),
  }
}

function emptyComponentForm() {
  return {
    code: "",
    name: "",
    componentType: "EARNING",
    frequency: "RECURRING",
    calculationMethod: "FIXED_AMOUNT",
    taxTreatment: "TAXABLE",
    taxablePercentage: "",
    pensionable: "false",
    healthInsuranceApplicable: "false",
    includedInGross: "true",
    includedInNet: "true",
    includedInEmployerCost: "false",
    subjectToProration: "false",
    allowManualInput: "true",
    calculationOrder: "1",
  }
}

function emptyCalendarForm() {
  return {
    code: "",
    name: "",
    cutoffDay: "25",
    paymentDay: "28",
    timezone: "Africa/Dar_es_Salaam",
    currency: "TZS",
    isDefault: "false",
  }
}

type StructureLine = {
  componentId: string
  defaultAmount: string
  defaultRate: string
  calculationOrder: string
}

function emptyStructureLine(): StructureLine {
  return {
    componentId: "",
    defaultAmount: "",
    defaultRate: "",
    calculationOrder: "1",
  }
}

function emptyStructureForm() {
  return {
    code: "",
    name: "",
    currency: "TZS",
    effectiveFrom: "",
    effectiveTo: "",
    components: [emptyStructureLine()],
  }
}

function emptySchemeForm() {
  return {
    code: "",
    name: "",
    schemeType: "PAYE",
    jurisdiction: "",
  }
}

function emptyRuleForm() {
  return {
    schemeId: "",
    versionNumber: "1",
    calculationMethod: "FIXED_AMOUNT",
    employeeRate: "",
    employerRate: "",
    maximumBasis: "",
    deductEmployeeBeforeTax: "false",
    effectiveFrom: "",
    effectiveTo: "",
    lowerLimit: "",
    upperLimit: "",
    baseTax: "",
    ratePercent: "",
    sortOrder: "1",
  }
}

function emptyMappingForm() {
  return {
    componentCode: "",
    debitAccountCode: "",
    creditAccountCode: "",
    dimensionsJson: "",
  }
}

function emptyApproveRunForm() {
  return {
    stage: "HR",
    calculationHash: "",
    comments: "",
  }
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  help,
}: {
  label: string
  value: string
  help: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
    </div>
  )
}

function PayrollDetailField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function PayrollDetailsContent({
  tab,
  configTab,
  row,
}: {
  tab: PayrollTab
  configTab: PayrollConfigTab
  row: AdminRecord | null
}) {
  if (!row) {
    return <p className="text-sm text-muted-foreground">No payroll details are available for this record.</p>
  }

  const status = readStatus(row)
  const statusClass = statusTone(status)
  const currency = readString(row, ["currency"], "TZS")
  const createdAt = formatDateTime(row.created_at ?? row.createdAt)
  const updatedAt = formatDateTime(row.updated_at ?? row.updatedAt)

  if (tab === "runs") {
    const gross = formatCurrencyAmount(
      row.gross_pay ?? row.grossPay ?? row.total_gross_pay ?? row.totalGrossPay,
      currency,
    )
    const net = formatCurrencyAmount(
      row.net_pay ?? row.netPay ?? row.total_net_pay ?? row.totalNetPay,
      currency,
    )
    const payslips = asRecordArray(row.payslips)
    const employeeCount =
      readNumber(row, ["employee_count", "employeeCount", "processed_employee_count", "processedEmployeeCount"]) ??
      payslips.length
    const runName = readString(row, ["run_no", "runNo", "name"], `Run #${rowId(row) || "—"}`)
    const runType = prettify(readString(row, ["run_type", "runType"], "REGULAR"))

    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">{runName}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {runType} for {readPeriodLabel(row)}
              </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Gross pay" value={gross} />
          <PayrollDetailField label="Net pay" value={net} />
          <PayrollDetailField label="Employees" value={employeeCount !== null ? String(employeeCount) : "—"} />
          <PayrollDetailField label="Payslips generated" value={String(payslips.length)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Run information</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PayrollDetailField label="Period" value={readPeriodLabel(row)} />
              <PayrollDetailField label="Currency" value={currency} />
              <PayrollDetailField label="Parent run" value={readString(row, ["parent_run_no", "parentRunNo", "parent_run_id", "parentRunId"], "—")} />
              <PayrollDetailField label="Offboarding request" value={readString(row, ["offboarding_request_id", "offboardingRequestId"], "—")} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Audit</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PayrollDetailField label="Created" value={createdAt} />
              <PayrollDetailField label="Updated" value={updatedAt} />
              <PayrollDetailField label="Approval status" value={readString(row, ["approval_status", "approvalStatus"], "—")} />
              <PayrollDetailField label="Calculation hash" value={readString(row, ["calculation_hash", "calculationHash"], "—")} />
            </div>
          </div>
        </div>

        {payslips.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Generated payslips</h3>
            <div className="mt-3 grid gap-2">
              {payslips.slice(0, 8).map((payslip, index) => (
                <div key={`${rowId(payslip) || index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                  <div className="text-sm font-medium text-foreground">
                    {readEmployeeLabel(payslip)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrencyAmount(payslip.net_pay ?? payslip.netPay, readString(payslip, ["currency"], currency))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (tab === "inputs") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">{readEmployeeLabel(row)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {readString(row, ["component_code", "componentCode"], "Component")} for {readPeriodLabel(row)}
              </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Amount" value={formatCurrencyAmount(row.amount, readString(row, ["currency"], currency))} />
          <PayrollDetailField label="Quantity" value={formatAdminValue(row.quantity)} />
          <PayrollDetailField label="Rate" value={formatAdminValue(row.rate)} />
          <PayrollDetailField label="Currency" value={readString(row, ["currency"], currency)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayrollDetailField label="Source module" value={readString(row, ["source_module", "sourceModule"], "—")} />
          <PayrollDetailField label="Source reference" value={readString(row, ["source_reference", "sourceReference"], "—")} />
          <PayrollDetailField label="Created" value={createdAt} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    )
  }

  if (tab === "profiles") {
    const enabled = readBoolean(row, ["payroll_enabled", "payrollEnabled"])
    const onHold = readBoolean(row, ["payroll_hold", "payrollHold"])
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">{readEmployeeLabel(row)}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {readString(row, ["payroll_number", "payrollNumber"], "Payroll number pending")}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Payroll status" value={enabled ? "Enabled" : "Disabled"} />
          <PayrollDetailField label="Hold status" value={onHold ? "On hold" : "Normal processing"} />
          <PayrollDetailField label="Payment method" value={readString(row, ["payment_method", "paymentMethod"], "—")} />
          <PayrollDetailField label="Currency" value={readString(row, ["currency"], currency)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayrollDetailField label="Effective from" value={formatAdminValue(row.effective_from ?? row.effectiveFrom)} />
          <PayrollDetailField label="Effective to" value={formatAdminValue(row.effective_to ?? row.effectiveTo)} />
          <PayrollDetailField label="Tax category" value={readString(row, ["employment_tax_category", "employmentTaxCategory"], "—")} />
          <PayrollDetailField label="Pay frequency" value={readString(row, ["pay_frequency", "payFrequency"], "—")} />
          <PayrollDetailField label="TIN" value={readString(row, ["taxpayer_identification_number", "taxpayerIdentificationNumber"], "—")} />
          <PayrollDetailField label="Bank account ID" value={readString(row, ["primary_bank_account_id", "primaryBankAccountId"], "—")} />
          <PayrollDetailField label="Hold reason" value={readString(row, ["payroll_hold_reason", "payrollHoldReason"], "—")} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    )
  }

  if (tab === "periods") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">{readPeriodLabel(row)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {readString(row, ["code", "period_code", "periodCode"], "Period code not provided")}
              </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Calendar" value={readString(row, ["calendar_name", "calendarName", "payroll_calendar_name"], "—")} />
          <PayrollDetailField label="Start date" value={formatAdminValue(row.start_date ?? row.startDate)} />
          <PayrollDetailField label="End date" value={formatAdminValue(row.end_date ?? row.endDate)} />
          <PayrollDetailField label="Payment date" value={formatAdminValue(row.payment_date ?? row.paymentDate)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayrollDetailField label="Month" value={readString(row, ["month"], "—")} />
          <PayrollDetailField label="Year" value={readString(row, ["year"], "—")} />
          <PayrollDetailField label="Created" value={createdAt} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    )
  }

  if (configTab === "components") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">{optionLabel(row)}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {prettify(readString(row, ["component_type", "componentType"], "EARNING"))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Calculation" value={prettify(readString(row, ["calculation_method", "calculationMethod"], "FIXED_AMOUNT"))} />
          <PayrollDetailField label="Frequency" value={prettify(readString(row, ["frequency"], "RECURRING"))} />
          <PayrollDetailField label="Tax treatment" value={prettify(readString(row, ["tax_treatment", "taxTreatment"], "TAXABLE"))} />
          <PayrollDetailField label="Order" value={readString(row, ["calculation_order", "calculationOrder"], "—")} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PayrollDetailField label="Included in gross" value={readBoolean(row, ["included_in_gross", "includedInGross"]) ? "Yes" : "No"} />
          <PayrollDetailField label="Included in net" value={readBoolean(row, ["included_in_net", "includedInNet"]) ? "Yes" : "No"} />
          <PayrollDetailField label="Manual input" value={readBoolean(row, ["allow_manual_input", "allowManualInput"]) ? "Allowed" : "System only"} />
          <PayrollDetailField label="Pensionable" value={readBoolean(row, ["pensionable"]) ? "Yes" : "No"} />
          <PayrollDetailField label="Health insurance" value={readBoolean(row, ["health_insurance_applicable", "healthInsuranceApplicable"]) ? "Applicable" : "Not applicable"} />
          <PayrollDetailField label="Prorated" value={readBoolean(row, ["subject_to_proration", "subjectToProration"]) ? "Yes" : "No"} />
        </div>
      </div>
    )
  }

  if (configTab === "calendars") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">{optionLabel(row)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{readString(row, ["timezone"], "Africa/Dar_es_Salaam")}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Currency" value={readString(row, ["currency"], currency)} />
          <PayrollDetailField label="Cut-off day" value={readString(row, ["cutoff_day", "cutoffDay"], "—")} />
          <PayrollDetailField label="Payment day" value={readString(row, ["payment_day", "paymentDay"], "—")} />
          <PayrollDetailField label="Default" value={readBoolean(row, ["is_default", "isDefault"]) ? "Yes" : "No"} />
        </div>
      </div>
    )
  }

  if (configTab === "structures") {
    const lines = asRecordArray(row.components)
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">{optionLabel(row)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{readString(row, ["currency"], currency)}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Effective from" value={formatAdminValue(row.effective_from ?? row.effectiveFrom)} />
          <PayrollDetailField label="Effective to" value={formatAdminValue(row.effective_to ?? row.effectiveTo)} />
          <PayrollDetailField label="Components" value={String(lines.length)} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>

        {lines.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Structure lines</h3>
            <div className="mt-3 grid gap-2">
              {lines.map((line, index) => (
                <div key={`${rowId(line) || index}`} className="grid gap-2 rounded-xl bg-muted/40 px-3 py-2 md:grid-cols-[minmax(0,1fr)_140px_140px]">
                  <div className="text-sm font-medium text-foreground">
                    {readString(asRecord(line.component), ["name", "title", "code"], readString(line, ["component_code", "componentCode"], `Component ${index + 1}`))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Amount: {formatCurrencyAmount(line.default_amount ?? line.defaultAmount, currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rate: {formatAdminValue(line.default_rate ?? line.defaultRate)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (configTab === "schemes") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">{optionLabel(row)}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {prettify(readString(row, ["scheme_type", "schemeType"], "OTHER"))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Jurisdiction" value={readString(row, ["jurisdiction"], "—")} />
          <PayrollDetailField label="Code" value={readString(row, ["code"], "—")} />
          <PayrollDetailField label="Status" value={readBoolean(row, ["is_active", "isActive"]) ? "Active" : prettify(status)} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-base font-semibold text-foreground">
          {readString(row, ["component_code", "componentCode"], optionLabel(row))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PayrollDetailField label="Debit account" value={readString(row, ["debit_account_code", "debitAccountCode"], "—")} />
        <PayrollDetailField label="Credit account" value={readString(row, ["credit_account_code", "creditAccountCode"], "—")} />
        <PayrollDetailField label="Currency" value={currency} />
        <PayrollDetailField label="Updated" value={updatedAt} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Dimensions</h3>
        <p className="mt-2 text-sm text-foreground">
          {typeof row.dimensions === "object" && row.dimensions !== null
            ? JSON.stringify(row.dimensions)
            : readString(row, ["dimensions_json", "dimensionsJson"], "No dimension mapping provided.")}
        </p>
      </div>
    </div>
  )
}

export function PayrollOperationsView() {
  const router = useRouter()
  const actor = useDashboardActor()
  const canAccessPayroll =
    !actor.ready ||
    canAccessDashboardRoute("/dashboard/operations/payroll", actor.permissionLabels, actor.accessMode)

  React.useEffect(() => {
    if (!actor.ready) {
      return
    }
    if (!canAccessPayroll) {
      router.replace("/dashboard")
    }
  }, [actor.ready, canAccessPayroll, router])

  const [tab, setTab] = React.useState<PayrollTab>("overview")
  const [configTab, setConfigTab] = React.useState<PayrollConfigTab>("components")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [periods, setPeriods] = React.useState<AdminRecord[]>([])
  const [components, setComponents] = React.useState<AdminRecord[]>([])
  const [calendars, setCalendars] = React.useState<AdminRecord[]>([])
  const [structures, setStructures] = React.useState<AdminRecord[]>([])
  const [schemes, setSchemes] = React.useState<AdminRecord[]>([])
  const [mappings, setMappings] = React.useState<AdminRecord[]>([])
  const [recentRuns, setRecentRuns] = React.useState<AdminRecord[]>([])
  const [offboardingRequests, setOffboardingRequests] = React.useState<AdminRecord[]>([])
  const [varianceRunId, setVarianceRunId] = React.useState("")
  const [comparisonRunId, setComparisonRunId] = React.useState("")
  const [settlementRequestId, setSettlementRequestId] = React.useState("")
  const [reportBusy, setReportBusy] = React.useState("")
  const [reportResult, setReportResult] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [periodFilter, setPeriodFilter] = React.useState("")

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(null)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<CreateDialogMode>("run")
  const [ruleOpen, setRuleOpen] = React.useState(false)
  const [approveOpen, setApproveOpen] = React.useState(false)
  const [approveRunId, setApproveRunId] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [runForm, setRunForm] = React.useState(emptyRunForm)
  const [inputForm, setInputForm] = React.useState(emptyInputForm)
  const [profileForm, setProfileForm] = React.useState(emptyProfileForm)
  const [periodForm, setPeriodForm] = React.useState(emptyPeriodForm)
  const [componentForm, setComponentForm] = React.useState(emptyComponentForm)
  const [calendarForm, setCalendarForm] = React.useState(emptyCalendarForm)
  const [structureForm, setStructureForm] = React.useState(emptyStructureForm)
  const [schemeForm, setSchemeForm] = React.useState(emptySchemeForm)
  const [ruleForm, setRuleForm] = React.useState(emptyRuleForm)
  const [mappingForm, setMappingForm] = React.useState(emptyMappingForm)
  const [approveForm, setApproveForm] = React.useState(emptyApproveRunForm)

  const [processingRunId, setProcessingRunId] = React.useState("")
  const [lockingRunId, setLockingRunId] = React.useState("")
  const [payslipRunId, setPayslipRunId] = React.useState("")
  const [bankingRunId, setBankingRunId] = React.useState("")
  const [journalRunId, setJournalRunId] = React.useState("")
  const [approvingInputId, setApprovingInputId] = React.useState("")
  const requestIdRef = React.useRef(0)
  const lookupsCacheRef = React.useRef<{
    dashboard: AdminRecord | null
    periods: AdminRecord[]
    components: AdminRecord[]
    calendars: AdminRecord[]
    structures: AdminRecord[]
    schemes: AdminRecord[]
    mappings: AdminRecord[]
    recentRuns: AdminRecord[]
  } | null>(null)

  const applyLookups = React.useCallback(
    (next: NonNullable<typeof lookupsCacheRef.current>) => {
      setDashboard(next.dashboard)
      setPeriods(next.periods)
      setComponents(next.components)
      setCalendars(next.calendars)
      setStructures(next.structures)
      setSchemes(next.schemes)
      setMappings(next.mappings)
      setRecentRuns(next.recentRuns)
    },
    [],
  )

  const fetchLookups = React.useCallback(
    async (token: string, force = false) => {
      if (lookupsCacheRef.current && !force) {
        return lookupsCacheRef.current
      }

      const [
        dashboardResult,
        periodsResult,
        componentsResult,
        calendarsResult,
        structuresResult,
        schemesResult,
        mappingsResult,
        recentRunsResult,
      ] = await Promise.allSettled([
        getPayrollDashboard(token),
        listPayrollPeriods(token),
        listPayrollComponents(token),
        listPayrollCalendars(token),
        listPayrollSalaryStructures(token),
        listPayrollStatutorySchemes(token),
        listPayrollAccountingMappings(token),
        listPayrollRuns(token, { page: 1, limit: 5 }),
      ])

      const next = {
        dashboard:
          dashboardResult.status === "fulfilled" && dashboardResult.value
            ? dashboardResult.value
            : null,
        periods: periodsResult.status === "fulfilled" ? periodsResult.value : [],
        components: componentsResult.status === "fulfilled" ? componentsResult.value : [],
        calendars: calendarsResult.status === "fulfilled" ? calendarsResult.value : [],
        structures: structuresResult.status === "fulfilled" ? structuresResult.value : [],
        schemes: schemesResult.status === "fulfilled" ? schemesResult.value : [],
        mappings: mappingsResult.status === "fulfilled" ? mappingsResult.value : [],
        recentRuns:
          recentRunsResult.status === "fulfilled" ? recentRunsResult.value.rows ?? [] : [],
      }
      lookupsCacheRef.current = next
      applyLookups(next)
      return next
    },
    [applyLookups],
  )

  const loadRows = React.useCallback(async (options?: { refreshLookups?: boolean }) => {
    if (!actor.ready) {
      return
    }
    if (!canAccessPayroll) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setRows([])
      setLoading(false)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const lookups = await fetchLookups(token, options?.refreshLookups === true)
      if (requestIdRef.current !== requestId) return

      if (tab === "overview") {
        setRows([])
        return
      }

      if (tab === "reports") {
        const [runsResult, offboardingResult] = await Promise.allSettled([
          listPayrollRuns(token, { page: 1, limit: 20 }),
          listOffboardingRequests(token, { page: 1, limit: 20 }),
        ])
        if (requestIdRef.current !== requestId) return
        if (runsResult.status === "fulfilled") setRecentRuns(runsResult.value.rows ?? [])
        if (offboardingResult.status === "fulfilled") setOffboardingRequests(offboardingResult.value.rows ?? [])
        setRows([])
        return
      }

      if (tab === "runs") {
        const result = await listPayrollRuns(token, {
          page: 1,
          limit: 100,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
        })
        if (requestIdRef.current === requestId) setRows(result.rows)
        return
      }

      if (tab === "inputs") {
        const result = await listPayrollInputs(token, {
          page: 1,
          limit: 100,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
        })
        if (requestIdRef.current === requestId) setRows(result.rows)
        return
      }

      if (tab === "profiles") {
        const result = await listEmployeePayrollProfiles(token, {
          page: 1,
          limit: 100,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          employee_id: undefined,
        })
        if (requestIdRef.current === requestId) setRows(result.rows)
        return
      }

      if (tab === "periods") {
        const query = search.trim().toLowerCase()
        const filtered = lookups.periods.filter((row) => {
          if (!query) return true
          return [
            readString(row, ["name", "title", "month", "year", "status"]),
            readString(row, ["period_code", "periodCode"]),
            readString(row, ["start_date", "startDate"]),
            readString(row, ["end_date", "endDate"]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        })
        setRows(filtered)
        return
      }

      const configRows =
        configTab === "components"
          ? lookups.components
          : configTab === "calendars"
            ? lookups.calendars
            : configTab === "structures"
              ? lookups.structures
              : configTab === "schemes"
                ? lookups.schemes
                : lookups.mappings

      const query = search.trim().toLowerCase()
      const filtered = configRows.filter((row) => {
        if (!query) return true
        return JSON.stringify(row).toLowerCase().includes(query)
      })
      setRows(filtered)
    } catch (errorObject) {
      if (requestIdRef.current === requestId) {
        setError(errorObject instanceof Error ? errorObject.message : "Failed to load payroll.")
        setRows([])
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [actor.ready, canAccessPayroll, configTab, fetchLookups, periodFilter, search, statusFilter, tab])

  React.useEffect(() => {
    void loadRows()
  }, [loadRows])

  React.useEffect(() => {
    setSearch("")
    setStatusFilter("")
    setPeriodFilter("")
    setRows([])
    setDetailOpen(false)
    setDetailRecord(null)
    setDetailLoading(false)
    setFormError(null)
  }, [tab, configTab])

  const openCreate = (mode: CreateDialogMode) => {
    setFormError(null)
    setCreateMode(mode)
    setCreateOpen(true)
  }

  const openRuleDialog = () => {
    setFormError(null)
    setRuleOpen(true)
  }

  const sectionTitle =
    tab === "overview"
      ? "Payroll overview"
      : tab === "runs"
        ? "Payroll runs"
        : tab === "inputs"
          ? "Payroll inputs"
          : tab === "profiles"
            ? "Employee payroll profiles"
            : tab === "periods"
              ? "Payroll periods"
              : tab === "reports"
                ? "Payroll reports"
              : `Payroll ${CONFIG_TABS.find((entry) => entry.id === configTab)?.label.toLowerCase()}`

  const canCreate =
    tab !== "overview" &&
    tab !== "reports" &&
    (tab !== "configuration" ||
      ["components", "calendars", "structures", "schemes", "mappings"].includes(configTab))

  const createButtonLabel =
    createMode === "run"
      ? "New run"
      : createMode === "input"
        ? "New input"
        : createMode === "profile"
          ? "New profile"
          : createMode === "period"
            ? "Generate period"
            : createMode === "component"
              ? "New component"
              : createMode === "calendar"
                ? "New calendar"
                : createMode === "structure"
                  ? "New structure"
                  : createMode === "scheme"
                    ? "New scheme"
                    : "New mapping"

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (tab === "runs") {
      return [
        {
          key: "run",
          label: "Run",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">
                {readString(row, ["run_no", "runNo", "name"], `Run #${readNumber(row, ["id"]) ?? "—"}`)}
              </p>
              <p className="text-xs text-muted-foreground">{prettify(readString(row, ["run_type", "runType"], "REGULAR"))}</p>
            </div>
          ),
        },
        {
          key: "period",
          label: "Period",
          render: (row) => readPeriodLabel(row),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readStatus(row)
            return (
              <Badge variant="outline" className={cn("capitalize", statusTone(status))}>
                {prettify(status)}
              </Badge>
            )
          },
        },
        {
          key: "amounts",
          label: "Totals",
          render: (row) => {
            const currency = readString(row, ["currency"], "TZS")
            const net = formatCurrencyAmount(
              row.net_pay ?? row.netPay ?? row.total_net_pay ?? row.totalNetPay,
              currency,
            )
            const gross = formatCurrencyAmount(
              row.gross_pay ?? row.grossPay ?? row.total_gross_pay ?? row.totalGrossPay,
              currency,
            )
            return (
              <div className="space-y-0.5 text-xs">
                <p>Gross: {gross}</p>
                <p className="text-muted-foreground">Net: {net}</p>
              </div>
            )
          },
        },
        {
          key: "created_at",
          label: "Created",
          render: (row) => formatDateTime(row.created_at ?? row.createdAt),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            const status = readStatus(row)
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    void openDetail(row)
                  }}
                >
                  View
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={processingRunId === id}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onProcessRun(row)
                  }}
                >
                  {processingRunId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Process"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    setApproveRunId(id)
                    setApproveForm(emptyApproveRunForm())
                    setApproveOpen(true)
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={lockingRunId === id}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onLockRun(row)
                  }}
                >
                  {lockingRunId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Lock"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={payslipRunId === id || status.toUpperCase() === "DRAFT"}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onGeneratePayslips(row)
                  }}
                >
                  {payslipRunId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Payslips"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={bankingRunId === id}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onGenerateBankingBatch(row)
                  }}
                >
                  {bankingRunId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Bank file"}
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={journalRunId === id}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onGenerateJournals(row)
                  }}
                >
                  {journalRunId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Journals"}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "inputs") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readEmployeeLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["component_code", "componentCode"], "Component")}
              </p>
            </div>
          ),
        },
        {
          key: "period",
          label: "Period",
          render: (row) => readPeriodLabel(row),
        },
        {
          key: "amount",
          label: "Amount",
          render: (row) =>
            formatCurrencyAmount(row.amount, readString(row, ["currency"], "TZS")),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readStatus(row)
            return (
              <Badge variant="outline" className={cn("capitalize", statusTone(status))}>
                {prettify(status)}
              </Badge>
            )
          },
        },
        {
          key: "source",
          label: "Source",
          render: (row) =>
            readString(row, ["source_module", "sourceModule", "source_reference", "sourceReference"], "—"),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row)
            return (
              <div className="flex gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation()
                    void openDetail(row)
                  }}
                >
                  View
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={approvingInputId === id || readStatus(row).toUpperCase() === "APPROVED"}
                  onClick={(event) => {
                    event.stopPropagation()
                    void onApproveInput(row)
                  }}
                >
                  {approvingInputId === id ? <Loader2Icon className="size-3.5 animate-spin" /> : "Approve"}
                </button>
              </div>
            )
          },
        },
      ]
    }

    if (tab === "profiles") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readEmployeeLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["payroll_number", "payrollNumber"], "Payroll number pending")}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Payroll status",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{readBoolean(row, ["payroll_enabled", "payrollEnabled"]) ? "Enabled" : "Disabled"}</p>
              <p className="text-muted-foreground">
                {readBoolean(row, ["payroll_hold", "payrollHold"]) ? "On hold" : "Normal processing"}
              </p>
            </div>
          ),
        },
        {
          key: "payment_method",
          label: "Payment",
          render: (row) =>
            prettify(readString(row, ["payment_method", "paymentMethod"], "—")),
        },
        {
          key: "pay_frequency",
          label: "Frequency",
          render: (row) =>
            prettify(readString(row, ["pay_frequency", "payFrequency"], "—")),
        },
        {
          key: "currency",
          label: "Currency",
          render: (row) => readString(row, ["currency"], "—"),
        },
        {
          key: "effective",
          label: "Effective",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatAdminValue(row.effective_from ?? row.effectiveFrom)}</p>
              <p className="text-muted-foreground">
                To {formatAdminValue(row.effective_to ?? row.effectiveTo)}
              </p>
            </div>
          ),
        },
      ]
    }

    if (tab === "periods") {
      return [
        {
          key: "period",
          label: "Period",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readPeriodLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code", "period_code", "periodCode"], "")}
              </p>
            </div>
          ),
        },
        {
          key: "calendar",
          label: "Calendar",
          render: (row) => readString(row, ["calendar_name", "calendarName", "payroll_calendar_name"], "—"),
        },
        {
          key: "dates",
          label: "Dates",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>Start: {formatAdminValue(row.start_date ?? row.startDate)}</p>
              <p className="text-muted-foreground">End: {formatAdminValue(row.end_date ?? row.endDate)}</p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readStatus(row)
            return (
              <Badge variant="outline" className={cn("capitalize", statusTone(status))}>
                {prettify(status)}
              </Badge>
            )
          },
        },
      ]
    }

    if (configTab === "components") {
      return [
        {
          key: "component",
          label: "Component",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(readString(row, ["component_type", "componentType"], "EARNING"))}
              </p>
            </div>
          ),
        },
        {
          key: "method",
          label: "Calculation",
          render: (row) =>
            prettify(readString(row, ["calculation_method", "calculationMethod"], "FIXED_AMOUNT")),
        },
        {
          key: "flags",
          label: "Flags",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{readBoolean(row, ["included_in_gross", "includedInGross"]) ? "Included in gross" : "Excluded from gross"}</p>
              <p className="text-muted-foreground">
                {readBoolean(row, ["allow_manual_input", "allowManualInput"]) ? "Manual input allowed" : "System calculated"}
              </p>
            </div>
          ),
        },
      ]
    }

    if (configTab === "calendars") {
      return [
        {
          key: "calendar",
          label: "Calendar",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["timezone"], "Africa/Dar_es_Salaam")}
              </p>
            </div>
          ),
        },
        {
          key: "cutoff_day",
          label: "Cut-off",
          render: (row) => readString(row, ["cutoff_day", "cutoffDay"], "—"),
        },
        {
          key: "payment_day",
          label: "Payment day",
          render: (row) => readString(row, ["payment_day", "paymentDay"], "—"),
        },
        {
          key: "default",
          label: "Default",
          render: (row) => (readBoolean(row, ["is_default", "isDefault"]) ? "Yes" : "No"),
        },
      ]
    }

    if (configTab === "structures") {
      return [
        {
          key: "structure",
          label: "Structure",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["currency"], "TZS")}
              </p>
            </div>
          ),
        },
        {
          key: "effective_from",
          label: "Effective from",
          render: (row) => formatAdminValue(row.effective_from ?? row.effectiveFrom),
        },
        {
          key: "components",
          label: "Components",
          render: (row) => {
            const lines = asRecordArray(row.components)
            return String(lines.length || 0)
          },
        },
      ]
    }

    if (configTab === "schemes") {
      return [
        {
          key: "scheme",
          label: "Scheme",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(readString(row, ["scheme_type", "schemeType"], "OTHER"))}
              </p>
            </div>
          ),
        },
        {
          key: "jurisdiction",
          label: "Jurisdiction",
          render: (row) => readString(row, ["jurisdiction"], "—"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) =>
            readBoolean(row, ["is_active", "isActive"]) ? "Active" : readStatus(row),
        },
      ]
    }

    return [
      {
        key: "component_code",
        label: "Component",
        render: (row) => readString(row, ["component_code", "componentCode"], "—"),
      },
      {
        key: "debit_account_code",
        label: "Debit",
        render: (row) => readString(row, ["debit_account_code", "debitAccountCode"], "—"),
      },
      {
        key: "credit_account_code",
        label: "Credit",
        render: (row) => readString(row, ["credit_account_code", "creditAccountCode"], "—"),
      },
    ]
  }, [
    approvingInputId,
    bankingRunId,
    configTab,
    journalRunId,
    lockingRunId,
    payslipRunId,
    processingRunId,
    tab,
  ])

  async function openDetail(row: AdminRecord) {
    const token = readStoredToken()
    if (!token) {
      toast.error("Authentication required.")
      return
    }

    const id = rowId(row)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailRecord(row)

    try {
      if (tab === "runs" && id) {
        const [runDetail, payslips] = await Promise.all([
          getPayrollRun(token, id),
          listPayrollPayslipsForRun(token, id).catch(() => []),
        ])
        setDetailRecord({
          ...(runDetail ?? row),
          payslips,
        })
      } else if (tab === "configuration" && configTab === "structures" && id) {
        setDetailRecord((await getPayrollSalaryStructure(token, id)) ?? row)
      } else {
        setDetailRecord(row)
      }
    } catch (errorObject) {
      setDetailRecord(row)
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to load details.")
    } finally {
      setDetailLoading(false)
    }
  }

  async function onProcessRun(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setProcessingRunId(id)
    try {
      await processPayrollRun(token, id)
      toast.success("Payroll run queued for processing.")
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to process run.")
    } finally {
      setProcessingRunId("")
    }
  }

  async function onLockRun(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setLockingRunId(id)
    try {
      await lockPayrollRun(token, id)
      toast.success("Payroll run locked.")
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to lock run.")
    } finally {
      setLockingRunId("")
    }
  }

  async function onGeneratePayslips(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setPayslipRunId(id)
    try {
      await generatePayrollPayslipsForRun(token, id)
      toast.success("Payslip generation started.")
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to generate payslips.")
    } finally {
      setPayslipRunId("")
    }
  }

  async function onRunReconciliation() {
    const token = readStoredToken()
    if (!token) return
    setReportBusy("reconciliation")
    try {
      const result = await runPayrollReconciliation(token)
      setReportResult((result as AdminRecord | null) ?? { status: "queued" })
      toast.success("Payroll reconciliation started.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to run reconciliation.")
    } finally {
      setReportBusy("")
    }
  }

  async function onRunVariance() {
    const token = readStoredToken()
    if (!token || !varianceRunId || !comparisonRunId) {
      toast.error("Choose both payroll runs.")
      return
    }
    setReportBusy("variance")
    try {
      const result = await runPayrollRunVariance(token, varianceRunId, comparisonRunId)
      setReportResult((result as AdminRecord | null) ?? { status: "queued" })
      toast.success("Variance report started.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to run variance.")
    } finally {
      setReportBusy("")
    }
  }

  async function onCalculateSettlement() {
    const token = readStoredToken()
    if (!token || !settlementRequestId) {
      toast.error("Choose an offboarding request.")
      return
    }
    setReportBusy("settlement")
    try {
      const result = await calculatePayrollFinalSettlement(token, settlementRequestId)
      setReportResult((result as AdminRecord | null) ?? { status: "queued" })
      toast.success("Final settlement calculated.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to calculate settlement.")
    } finally {
      setReportBusy("")
    }
  }

  async function onGenerateBankingBatch(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBankingRunId(id)
    try {
      const batch = await generatePayrollBankingBatch(token, id)
      const batchId =
        readNumber(batch, ["batchId", "batch_id", "id"]) ??
        readNumber(
          typeof batch?.data === "object" && batch.data && !Array.isArray(batch.data)
            ? (batch.data as AdminRecord)
            : null,
          ["batchId", "batch_id", "id"],
        )
      if (batchId !== null) {
        const download = await downloadPayrollBankingBatch(token, batchId)
        downloadBlob(download.blob, download.filename)
        toast.success("Bank batch generated and downloaded.")
      } else {
        toast.success("Bank batch generation started.")
      }
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to generate bank batch.")
    } finally {
      setBankingRunId("")
    }
  }

  async function onGenerateJournals(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setJournalRunId(id)
    try {
      await generatePayrollAccountingJournals(token, id)
      toast.success("Accounting journals generated.")
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to generate journals.")
    } finally {
      setJournalRunId("")
    }
  }

  async function onApproveInput(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setApprovingInputId(id)
    try {
      await approvePayrollInput(token, id)
      toast.success("Payroll input approved.")
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Failed to approve input.")
    } finally {
      setApprovingInputId("")
    }
  }

  async function onCreate() {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      if (createMode === "run") {
        if (!runForm.payrollPeriodId) {
          throw new Error("Select a payroll period.")
        }
        await createPayrollRun(token, {
          payroll_period_id: Number(runForm.payrollPeriodId),
          run_type: runForm.runType,
          parent_run_id: runForm.parentRunId ? Number(runForm.parentRunId) : undefined,
          offboarding_request_id: runForm.offboardingRequestId
            ? Number(runForm.offboardingRequestId)
            : undefined,
        })
      } else if (createMode === "input") {
        if (!inputForm.payrollPeriodId || !inputForm.componentCode.trim() || !inputForm.amount.trim()) {
          throw new Error("Payroll period, component code, and amount are required.")
        }
        await createPayrollInput(token, {
          payroll_period_id: Number(inputForm.payrollPeriodId),
          employee_id: inputForm.employeeId ? Number(inputForm.employeeId) : undefined,
          component_code: inputForm.componentCode.trim(),
          source_module: inputForm.sourceModule.trim() || undefined,
          source_reference: inputForm.sourceReference.trim() || undefined,
          amount: inputForm.amount.trim(),
          quantity: inputForm.quantity.trim() || undefined,
          rate: inputForm.rate.trim() || undefined,
          currency: inputForm.currency.trim() || undefined,
          status: inputForm.status,
        })
      } else if (createMode === "profile") {
        if (!profileForm.employeeId || !profileForm.payrollNumber.trim() || !profileForm.effectiveFrom) {
          throw new Error("Employee ID, payroll number, and effective from date are required.")
        }
        await upsertEmployeePayrollProfile(token, {
          employee_id: Number(profileForm.employeeId),
          payroll_number: profileForm.payrollNumber.trim(),
          taxpayer_identification_number: profileForm.taxpayerIdentificationNumber.trim() || undefined,
          social_security_scheme_code: profileForm.socialSecuritySchemeCode.trim() || undefined,
          social_security_number: profileForm.socialSecurityNumber.trim() || undefined,
          health_insurance_scheme_code: profileForm.healthInsuranceSchemeCode.trim() || undefined,
          health_insurance_number: profileForm.healthInsuranceNumber.trim() || undefined,
          tax_residency_code: profileForm.taxResidencyCode.trim() || undefined,
          employment_tax_category: profileForm.employmentTaxCategory.trim() || undefined,
          payment_method: profileForm.paymentMethod.trim() || undefined,
          primary_bank_account_id: profileForm.primaryBankAccountId
            ? Number(profileForm.primaryBankAccountId)
            : undefined,
          currency: profileForm.currency.trim() || undefined,
          pay_frequency: profileForm.payFrequency.trim() || undefined,
          payroll_enabled: profileForm.payrollEnabled === "true",
          payroll_hold: profileForm.payrollHold === "true",
          payroll_hold_reason: profileForm.payrollHoldReason.trim() || undefined,
          effective_from: profileForm.effectiveFrom,
          effective_to: profileForm.effectiveTo || undefined,
        })
      } else if (createMode === "period") {
        if (!periodForm.payrollCalendarId || !periodForm.year || !periodForm.month) {
          throw new Error("Calendar, year, and month are required.")
        }
        await generatePayrollPeriod(token, {
          payroll_calendar_id: Number(periodForm.payrollCalendarId),
          year: Number(periodForm.year),
          month: Number(periodForm.month),
        })
      } else if (createMode === "component") {
        if (!componentForm.code.trim() || !componentForm.name.trim()) {
          throw new Error("Code and name are required.")
        }
        await createPayrollComponent(token, {
          code: componentForm.code.trim(),
          name: componentForm.name.trim(),
          component_type: componentForm.componentType,
          frequency: componentForm.frequency,
          calculation_method: componentForm.calculationMethod,
          tax_treatment: componentForm.taxTreatment,
          taxable_percentage: componentForm.taxablePercentage.trim() || undefined,
          pensionable: componentForm.pensionable === "true",
          health_insurance_applicable: componentForm.healthInsuranceApplicable === "true",
          included_in_gross: componentForm.includedInGross === "true",
          included_in_net: componentForm.includedInNet === "true",
          included_in_employer_cost: componentForm.includedInEmployerCost === "true",
          subject_to_proration: componentForm.subjectToProration === "true",
          allow_manual_input: componentForm.allowManualInput === "true",
          calculation_order: Number(componentForm.calculationOrder) || 1,
        })
      } else if (createMode === "calendar") {
        if (!calendarForm.code.trim() || !calendarForm.name.trim()) {
          throw new Error("Code and name are required.")
        }
        await createPayrollCalendar(token, {
          code: calendarForm.code.trim(),
          name: calendarForm.name.trim(),
          cutoff_day: Number(calendarForm.cutoffDay) || undefined,
          payment_day: Number(calendarForm.paymentDay) || undefined,
          timezone: calendarForm.timezone.trim() || undefined,
          currency: calendarForm.currency.trim() || undefined,
          is_default: calendarForm.isDefault === "true",
        })
      } else if (createMode === "structure") {
        const lines = structureForm.components
          .filter((line) => line.componentId)
          .map((line) => ({
            component_id: Number(line.componentId),
            default_amount: line.defaultAmount.trim() || undefined,
            default_rate: line.defaultRate.trim() || undefined,
            calculation_order: Number(line.calculationOrder) || 1,
          }))
        if (!structureForm.code.trim() || !structureForm.name.trim() || !structureForm.effectiveFrom || lines.length === 0) {
          throw new Error("Code, name, effective from, and at least one component line are required.")
        }
        await createPayrollSalaryStructure(token, {
          code: structureForm.code.trim(),
          name: structureForm.name.trim(),
          currency: structureForm.currency.trim() || undefined,
          effective_from: structureForm.effectiveFrom,
          effective_to: structureForm.effectiveTo || undefined,
          components: lines,
        })
      } else if (createMode === "scheme") {
        if (!schemeForm.code.trim() || !schemeForm.name.trim()) {
          throw new Error("Code and name are required.")
        }
        await createPayrollStatutoryScheme(token, {
          code: schemeForm.code.trim(),
          name: schemeForm.name.trim(),
          scheme_type: schemeForm.schemeType,
          jurisdiction: schemeForm.jurisdiction.trim() || undefined,
        })
      } else {
        if (!mappingForm.componentCode.trim() || !mappingForm.debitAccountCode.trim() || !mappingForm.creditAccountCode.trim()) {
          throw new Error("Component code, debit account, and credit account are required.")
        }
        let dimensions: Record<string, unknown> | undefined
        if (mappingForm.dimensionsJson.trim()) {
          try {
            dimensions = JSON.parse(mappingForm.dimensionsJson) as Record<string, unknown>
          } catch {
            throw new Error("Dimensions must be valid JSON.")
          }
        }
        await createPayrollAccountingMapping(token, {
          component_code: mappingForm.componentCode.trim(),
          debit_account_code: mappingForm.debitAccountCode.trim(),
          credit_account_code: mappingForm.creditAccountCode.trim(),
          dimensions,
        })
      }

      toast.success(createMode === "profile" ? "Payroll profile saved." : "Saved.")
      setCreateOpen(false)
      setRunForm(emptyRunForm())
      setInputForm(emptyInputForm())
      setProfileForm(emptyProfileForm())
      setPeriodForm(emptyPeriodForm())
      setComponentForm(emptyComponentForm())
      setCalendarForm(emptyCalendarForm())
      setStructureForm(emptyStructureForm())
      setSchemeForm(emptySchemeForm())
      setMappingForm(emptyMappingForm())
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Failed to save payroll record.")
    } finally {
      setSaving(false)
    }
  }

  async function onCreateRule() {
    const token = readStoredToken()
    if (!token) {
      setFormError("Authentication required. Please log in again.")
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      if (!ruleForm.schemeId || !ruleForm.effectiveFrom) {
        throw new Error("Scheme and effective-from date are required.")
      }
      const bands =
        ruleForm.lowerLimit.trim() || ruleForm.ratePercent.trim()
          ? [
              {
                lower_limit: ruleForm.lowerLimit.trim(),
                upper_limit: ruleForm.upperLimit.trim() || undefined,
                base_tax: ruleForm.baseTax.trim() || undefined,
                rate_percent: ruleForm.ratePercent.trim(),
                sort_order: Number(ruleForm.sortOrder) || 1,
              },
            ]
          : undefined
      await createPayrollStatutoryRule(token, {
        scheme_id: Number(ruleForm.schemeId),
        version_number: Number(ruleForm.versionNumber) || 1,
        calculation_method: ruleForm.calculationMethod,
        employee_rate: ruleForm.employeeRate.trim() || undefined,
        employer_rate: ruleForm.employerRate.trim() || undefined,
        maximum_basis: ruleForm.maximumBasis.trim() || undefined,
        deduct_employee_before_tax: ruleForm.deductEmployeeBeforeTax === "true",
        effective_from: ruleForm.effectiveFrom,
        effective_to: ruleForm.effectiveTo || undefined,
        bands,
      })
      toast.success("Statutory rule created.")
      setRuleOpen(false)
      setRuleForm(emptyRuleForm())
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Failed to save statutory rule.")
    } finally {
      setSaving(false)
    }
  }

  async function onApproveRun() {
    const token = readStoredToken()
    if (!token || !approveRunId) return
    if (!approveForm.calculationHash.trim()) {
      setFormError("Calculation hash is required for approval.")
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      await approvePayrollRun(token, approveRunId, {
        stage: approveForm.stage,
        calculation_hash: approveForm.calculationHash.trim(),
        comments: approveForm.comments.trim() || undefined,
      })
      toast.success("Payroll run approved.")
      setApproveOpen(false)
      setApproveRunId("")
      await loadRows({ refreshLookups: true })
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Failed to approve run.")
    } finally {
      setSaving(false)
    }
  }

  function renderCreateFields() {
    if (createMode === "run") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll period">
            <select
              className={inputClass}
              value={runForm.payrollPeriodId}
              onChange={(event) => setRunForm((current) => ({ ...current, payrollPeriodId: event.target.value }))}
            >
              <option value="">Select a period</option>
              {periods.map((row, index) => {
                const id = readNumber(row, ["id"])
                if (id === null) return null
                return (
                  <option key={`run-period-${id}-${index}`} value={String(id)}>
                    {readPeriodLabel(row)}
                  </option>
                )
              })}
            </select>
          </Field>
          <Field label="Run type">
            <select
              className={inputClass}
              value={runForm.runType}
              onChange={(event) => setRunForm((current) => ({ ...current, runType: event.target.value }))}
            >
              {RUN_TYPES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parent run ID">
            <input
              className={inputClass}
              value={runForm.parentRunId}
              onChange={(event) => setRunForm((current) => ({ ...current, parentRunId: event.target.value }))}
              placeholder="Optional"
            />
          </Field>
          <Field label="Offboarding request ID">
            <input
              className={inputClass}
              value={runForm.offboardingRequestId}
              onChange={(event) => setRunForm((current) => ({ ...current, offboardingRequestId: event.target.value }))}
              placeholder="Optional final settlement link"
            />
          </Field>
        </div>
      )
    }

    if (createMode === "input") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll period">
            <select
              className={inputClass}
              value={inputForm.payrollPeriodId}
              onChange={(event) => setInputForm((current) => ({ ...current, payrollPeriodId: event.target.value }))}
            >
              <option value="">Select a period</option>
              {periods.map((row, index) => {
                const id = readNumber(row, ["id"])
                if (id === null) return null
                return (
                  <option key={`input-period-${id}-${index}`} value={String(id)}>
                    {readPeriodLabel(row)}
                  </option>
                )
              })}
            </select>
          </Field>
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={inputForm.employeeId}
              onChange={(event) => setInputForm((current) => ({ ...current, employeeId: event.target.value }))}
              placeholder="Optional"
            />
          </Field>
          <Field label="Component code">
            <input
              className={inputClass}
              value={inputForm.componentCode}
              onChange={(event) => setInputForm((current) => ({ ...current, componentCode: event.target.value }))}
              placeholder="BASIC_SALARY"
              list="payroll-component-codes"
            />
            <datalist id="payroll-component-codes">
              {components.map((row, index) => (
                <option
                  key={`component-code-${index}`}
                  value={readString(row, ["code"], "")}
                />
              ))}
            </datalist>
          </Field>
          <Field label="Amount">
            <input
              className={inputClass}
              value={inputForm.amount}
              onChange={(event) => setInputForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="0.00"
            />
          </Field>
          <Field label="Quantity">
            <input
              className={inputClass}
              value={inputForm.quantity}
              onChange={(event) => setInputForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="Optional"
            />
          </Field>
          <Field label="Rate">
            <input
              className={inputClass}
              value={inputForm.rate}
              onChange={(event) => setInputForm((current) => ({ ...current, rate: event.target.value }))}
              placeholder="Optional"
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={inputForm.currency}
              onChange={(event) => setInputForm((current) => ({ ...current, currency: event.target.value }))}
            />
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={inputForm.status}
              onChange={(event) => setInputForm((current) => ({ ...current, status: event.target.value }))}
            >
              {INPUT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source module">
            <input
              className={inputClass}
              value={inputForm.sourceModule}
              onChange={(event) => setInputForm((current) => ({ ...current, sourceModule: event.target.value }))}
              placeholder="Attendance"
            />
          </Field>
          <Field label="Source reference">
            <input
              className={inputClass}
              value={inputForm.sourceReference}
              onChange={(event) => setInputForm((current) => ({ ...current, sourceReference: event.target.value }))}
              placeholder="Optional reference"
            />
          </Field>
        </div>
      )
    }

    if (createMode === "profile") {
      return (
        <div className="space-y-5">
          <FormSection title="Employee">
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={profileForm.employeeId}
              onChange={(event) => setProfileForm((current) => ({ ...current, employeeId: event.target.value }))}
            />
          </Field>
          <Field label="Payroll number">
            <input
              className={inputClass}
              value={profileForm.payrollNumber}
              onChange={(event) => setProfileForm((current) => ({ ...current, payrollNumber: event.target.value }))}
            />
          </Field>
          <Field label="Effective from">
            <input
              className={inputClass}
              type="date"
              value={profileForm.effectiveFrom}
              onChange={(event) => setProfileForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
            />
          </Field>
          <Field label="Effective to">
            <input
              className={inputClass}
              type="date"
              value={profileForm.effectiveTo}
              onChange={(event) => setProfileForm((current) => ({ ...current, effectiveTo: event.target.value }))}
            />
          </Field>
          </FormSection>
          <FormSection title="Payment">
          <Field label="Payment method">
            <select
              className={inputClass}
              value={profileForm.paymentMethod}
              onChange={(event) => setProfileForm((current) => ({ ...current, paymentMethod: event.target.value }))}
            >
              <option value="">Select method</option>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Primary bank account ID">
            <input
              className={inputClass}
              value={profileForm.primaryBankAccountId}
              onChange={(event) => setProfileForm((current) => ({ ...current, primaryBankAccountId: event.target.value }))}
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={profileForm.currency}
              onChange={(event) => setProfileForm((current) => ({ ...current, currency: event.target.value }))}
            />
          </Field>
          <Field label="Pay frequency">
            <select
              className={inputClass}
              value={profileForm.payFrequency}
              onChange={(event) => setProfileForm((current) => ({ ...current, payFrequency: event.target.value }))}
            >
              {PAY_FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          </FormSection>
          <FormSection title="Tax and statutory">
          <Field label="TIN">
            <input
              className={inputClass}
              value={profileForm.taxpayerIdentificationNumber}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  taxpayerIdentificationNumber: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Social security scheme">
            <input
              className={inputClass}
              value={profileForm.socialSecuritySchemeCode}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  socialSecuritySchemeCode: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Social security number">
            <input
              className={inputClass}
              value={profileForm.socialSecurityNumber}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  socialSecurityNumber: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Health scheme">
            <input
              className={inputClass}
              value={profileForm.healthInsuranceSchemeCode}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  healthInsuranceSchemeCode: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Health number">
            <input
              className={inputClass}
              value={profileForm.healthInsuranceNumber}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  healthInsuranceNumber: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Tax residency code">
            <input
              className={inputClass}
              value={profileForm.taxResidencyCode}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  taxResidencyCode: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Tax category">
            <input
              className={inputClass}
              value={profileForm.employmentTaxCategory}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  employmentTaxCategory: event.target.value,
                }))
              }
            />
          </Field>
          </FormSection>
          <FormSection title="Processing">
          <Field label="Payroll enabled">
            <select
              className={inputClass}
              value={profileForm.payrollEnabled}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, payrollEnabled: event.target.value }))
              }
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </Field>
          <Field label="Payroll hold">
            <select
              className={inputClass}
              value={profileForm.payrollHold}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, payrollHold: event.target.value }))
              }
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
          <Field label="Hold reason" className="md:col-span-2">
            <textarea
              className={textareaClass}
              value={profileForm.payrollHoldReason}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, payrollHoldReason: event.target.value }))
              }
            />
          </Field>
          </FormSection>
        </div>
      )
    }

    if (createMode === "period") {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Payroll calendar">
            <select
              className={inputClass}
              value={periodForm.payrollCalendarId}
              onChange={(event) => setPeriodForm((current) => ({ ...current, payrollCalendarId: event.target.value }))}
            >
              <option value="">Select a calendar</option>
              {calendars.map((row, index) => {
                const id = readNumber(row, ["id"])
                if (id === null) return null
                return (
                  <option key={`calendar-option-${id}-${index}`} value={String(id)}>
                    {optionLabel(row)}
                  </option>
                )
              })}
            </select>
          </Field>
          <Field label="Year">
            <input
              className={inputClass}
              value={periodForm.year}
              onChange={(event) => setPeriodForm((current) => ({ ...current, year: event.target.value }))}
            />
          </Field>
          <Field label="Month">
            <input
              className={inputClass}
              value={periodForm.month}
              onChange={(event) => setPeriodForm((current) => ({ ...current, month: event.target.value }))}
            />
          </Field>
        </div>
      )
    }

    if (createMode === "component") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input className={inputClass} value={componentForm.code} onChange={(event) => setComponentForm((current) => ({ ...current, code: event.target.value }))} />
          </Field>
          <Field label="Name">
            <input className={inputClass} value={componentForm.name} onChange={(event) => setComponentForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="Component type">
            <select className={inputClass} value={componentForm.componentType} onChange={(event) => setComponentForm((current) => ({ ...current, componentType: event.target.value }))}>
              {COMPONENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Frequency">
            <select className={inputClass} value={componentForm.frequency} onChange={(event) => setComponentForm((current) => ({ ...current, frequency: event.target.value }))}>
              {FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Calculation method">
            <select className={inputClass} value={componentForm.calculationMethod} onChange={(event) => setComponentForm((current) => ({ ...current, calculationMethod: event.target.value }))}>
              {CALCULATION_METHODS.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax treatment">
            <select className={inputClass} value={componentForm.taxTreatment} onChange={(event) => setComponentForm((current) => ({ ...current, taxTreatment: event.target.value }))}>
              {TAX_TREATMENTS.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Taxable percentage">
            <input className={inputClass} value={componentForm.taxablePercentage} onChange={(event) => setComponentForm((current) => ({ ...current, taxablePercentage: event.target.value }))} />
          </Field>
          <Field label="Calculation order">
            <input className={inputClass} value={componentForm.calculationOrder} onChange={(event) => setComponentForm((current) => ({ ...current, calculationOrder: event.target.value }))} />
          </Field>
          {[
            ["pensionable", "Pensionable"],
            ["healthInsuranceApplicable", "Health insurance applicable"],
            ["includedInGross", "Included in gross"],
            ["includedInNet", "Included in net"],
            ["includedInEmployerCost", "Included in employer cost"],
            ["subjectToProration", "Subject to proration"],
            ["allowManualInput", "Allow manual input"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <select
                className={inputClass}
                value={componentForm[key as keyof typeof componentForm] as string}
                onChange={(event) =>
                  setComponentForm((current) => ({ ...current, [key]: event.target.value }))
                }
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
          ))}
        </div>
      )
    }

    if (createMode === "calendar") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input className={inputClass} value={calendarForm.code} onChange={(event) => setCalendarForm((current) => ({ ...current, code: event.target.value }))} />
          </Field>
          <Field label="Name">
            <input className={inputClass} value={calendarForm.name} onChange={(event) => setCalendarForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="Cut-off day">
            <input className={inputClass} value={calendarForm.cutoffDay} onChange={(event) => setCalendarForm((current) => ({ ...current, cutoffDay: event.target.value }))} />
          </Field>
          <Field label="Payment day">
            <input className={inputClass} value={calendarForm.paymentDay} onChange={(event) => setCalendarForm((current) => ({ ...current, paymentDay: event.target.value }))} />
          </Field>
          <Field label="Timezone">
            <input className={inputClass} value={calendarForm.timezone} onChange={(event) => setCalendarForm((current) => ({ ...current, timezone: event.target.value }))} />
          </Field>
          <Field label="Currency">
            <input className={inputClass} value={calendarForm.currency} onChange={(event) => setCalendarForm((current) => ({ ...current, currency: event.target.value }))} />
          </Field>
          <Field label="Default calendar">
            <select className={inputClass} value={calendarForm.isDefault} onChange={(event) => setCalendarForm((current) => ({ ...current, isDefault: event.target.value }))}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
        </div>
      )
    }

    if (createMode === "structure") {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Code">
              <input className={inputClass} value={structureForm.code} onChange={(event) => setStructureForm((current) => ({ ...current, code: event.target.value }))} />
            </Field>
            <Field label="Name">
              <input className={inputClass} value={structureForm.name} onChange={(event) => setStructureForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Currency">
              <input className={inputClass} value={structureForm.currency} onChange={(event) => setStructureForm((current) => ({ ...current, currency: event.target.value }))} />
            </Field>
            <Field label="Effective from">
              <input className={inputClass} type="date" value={structureForm.effectiveFrom} onChange={(event) => setStructureForm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
            </Field>
            <Field label="Effective to">
              <input className={inputClass} type="date" value={structureForm.effectiveTo} onChange={(event) => setStructureForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
            </Field>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Component lines</p>
                <p className="text-xs text-muted-foreground">Add the payroll components that make up this structure.</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
                onClick={() =>
                  setStructureForm((current) => ({
                    ...current,
                    components: [...current.components, emptyStructureLine()],
                  }))
                }
              >
                <PlusIcon className="size-3.5" />
                Add line
              </button>
            </div>
            {structureForm.components.map((line, index) => (
              <div key={`structure-line-${index}`} className="grid gap-3 rounded-lg border border-border/70 bg-background p-3 md:grid-cols-4">
                <Field label="Component">
                  <select
                    className={inputClass}
                    value={line.componentId}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, componentId: event.target.value } : entry,
                        ),
                      }))
                    }
                  >
                    <option value="">Select a component</option>
                    {components.map((row, rowIndex) => {
                      const id = readNumber(row, ["id"])
                      if (id === null) return null
                      return (
                        <option key={`structure-component-${id}-${rowIndex}`} value={String(id)}>
                          {optionLabel(row)}
                        </option>
                      )
                    })}
                  </select>
                </Field>
                <Field label="Default amount">
                  <input
                    className={inputClass}
                    value={line.defaultAmount}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, defaultAmount: event.target.value } : entry,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Default rate">
                  <input
                    className={inputClass}
                    value={line.defaultRate}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, defaultRate: event.target.value } : entry,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Order">
                  <input
                    className={inputClass}
                    value={line.calculationOrder}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, calculationOrder: event.target.value } : entry,
                        ),
                      }))
                    }
                  />
                </Field>
                {structureForm.components.length > 1 ? (
                  <div className="md:col-span-4">
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-600"
                      onClick={() =>
                        setStructureForm((current) => ({
                          ...current,
                          components: current.components.filter((_, entryIndex) => entryIndex !== index),
                        }))
                      }
                    >
                      Remove line
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (createMode === "scheme") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input className={inputClass} value={schemeForm.code} onChange={(event) => setSchemeForm((current) => ({ ...current, code: event.target.value }))} />
          </Field>
          <Field label="Name">
            <input className={inputClass} value={schemeForm.name} onChange={(event) => setSchemeForm((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="Scheme type">
            <select className={inputClass} value={schemeForm.schemeType} onChange={(event) => setSchemeForm((current) => ({ ...current, schemeType: event.target.value }))}>
              {SCHEME_TYPES.map((value) => (
                <option key={value} value={value}>
                  {prettify(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jurisdiction">
            <input className={inputClass} value={schemeForm.jurisdiction} onChange={(event) => setSchemeForm((current) => ({ ...current, jurisdiction: event.target.value }))} />
          </Field>
        </div>
      )
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Component code">
          <input className={inputClass} value={mappingForm.componentCode} onChange={(event) => setMappingForm((current) => ({ ...current, componentCode: event.target.value }))} list="mapping-component-codes" />
          <datalist id="mapping-component-codes">
            {components.map((row, index) => (
              <option key={`mapping-code-${index}`} value={readString(row, ["code"], "")} />
            ))}
          </datalist>
        </Field>
        <Field label="Debit account code">
          <input className={inputClass} value={mappingForm.debitAccountCode} onChange={(event) => setMappingForm((current) => ({ ...current, debitAccountCode: event.target.value }))} />
        </Field>
        <Field label="Credit account code">
          <input className={inputClass} value={mappingForm.creditAccountCode} onChange={(event) => setMappingForm((current) => ({ ...current, creditAccountCode: event.target.value }))} />
        </Field>
        <Field label="Dimensions JSON" className="md:col-span-2">
          <textarea className={textareaClass} value={mappingForm.dimensionsJson} onChange={(event) => setMappingForm((current) => ({ ...current, dimensionsJson: event.target.value }))} placeholder='{"department":"HQ"}' />
        </Field>
      </div>
    )
  }

  const overviewStats = React.useMemo(() => {
    const activeRuns =
      readNumber(dashboard, ["active_runs", "activeRuns", "processing_runs", "processingRuns"]) ??
      recentRuns.filter((row) => ["PENDING", "PROCESSING", "RUNNING"].includes(readStatus(row).toUpperCase())).length
    const openInputs =
      readNumber(dashboard, ["pending_inputs", "pendingInputs", "open_inputs", "openInputs"]) ?? 0
    const enabledProfiles =
      readNumber(dashboard, ["enabled_profiles", "enabledProfiles", "payroll_profiles", "profileCount"]) ??
      0
    const totalPeriods =
      readNumber(dashboard, ["total_periods", "periodCount"]) ?? periods.length
    return { activeRuns, openInputs, enabledProfiles, totalPeriods }
  }, [dashboard, periods.length, recentRuns])

  if (actor.ready && !canAccessPayroll) {
    return null
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground">Payroll</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Runs, inputs, employee profiles, periods, and setup.
          </p>
        </div>
      </div>

      <div className="tab-rail-scroll">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {TABS.map((entry) => {
            const active = tab === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={cn(
                  "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                  active
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "configuration" ? (
        <div className="tab-rail-scroll">
          <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
            {CONFIG_TABS.map((entry) => {
              const active = configTab === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setConfigTab(entry.id)}
                  className={cn(
                    "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                    active
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active runs"
              value={String(overviewStats.activeRuns)}
              help="Processing or waiting for approval."
            />
            <SummaryCard
              label="Open inputs"
              value={String(overviewStats.openInputs)}
              help="Not yet approved."
            />
            <SummaryCard
              label="Enabled profiles"
              value={String(overviewStats.enabledProfiles)}
              help="Employees included in payroll."
            />
            <SummaryCard
              label="Periods"
              value={String(overviewStats.totalPeriods)}
              help="Generated pay periods."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Recent runs</h2>
                  <p className="text-sm text-muted-foreground">Latest payroll cycles.</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
                  onClick={() => setTab("runs")}
                >
                  View all
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent runs returned yet.</p>
                ) : (
                  recentRuns.map((row, index) => {
                    const status = readStatus(row)
                    return (
                      <button
                        key={`recent-run-${rowId(row) || index}`}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 rounded-lg border border-border/80 px-3 py-2 text-left transition hover:bg-muted/30"
                        onClick={() => {
                          setTab("runs")
                          void openDetail(row)
                        }}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {readString(row, ["run_no", "runNo", "name"], `Run #${readNumber(row, ["id"]) ?? "—"}`)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {readPeriodLabel(row)} • {prettify(readString(row, ["run_type", "runType"], "REGULAR"))}
                          </p>
                        </div>
                        <Badge variant="outline" className={statusTone(status)}>
                          {prettify(status)}
                        </Badge>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="text-base font-semibold text-foreground">Setup</h2>
              <p className="text-sm text-muted-foreground">Components, calendars, and mappings.</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                  <span>Components</span>
                  <span className="font-medium">{components.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                  <span>Calendars</span>
                  <span className="font-medium">{calendars.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                  <span>Structures</span>
                  <span className="font-medium">{structures.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                  <span>Schemes</span>
                  <span className="font-medium">{schemes.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                  <span>Accounting mappings</span>
                  <span className="font-medium">{mappings.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : tab === "reports" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Reconciliation</h2>
            <p className="text-sm text-muted-foreground">Runs /api/payroll/reports/reconciliation/run.</p>
            <button type="button" className={primaryButtonClass} disabled={reportBusy === "reconciliation"} onClick={() => void onRunReconciliation()}>
              {reportBusy === "reconciliation" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : null}
              Run reconciliation
            </button>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Run variance</h2>
            <p className="text-sm text-muted-foreground">Compare two payroll runs.</p>
            <select className={inputClass} value={varianceRunId} onChange={(event) => setVarianceRunId(event.target.value)}>
              <option value="">Primary run</option>
              {recentRuns.map((row) => (
                <option key={rowId(row)} value={rowId(row)}>{readPeriodLabel(row) !== "-" ? readPeriodLabel(row) : `Run #${rowId(row)}`}</option>
              ))}
            </select>
            <select className={inputClass} value={comparisonRunId} onChange={(event) => setComparisonRunId(event.target.value)}>
              <option value="">Comparison run</option>
              {recentRuns.map((row) => (
                <option key={`cmp-${rowId(row)}`} value={rowId(row)}>{readPeriodLabel(row) !== "-" ? readPeriodLabel(row) : `Run #${rowId(row)}`}</option>
              ))}
            </select>
            <button type="button" className={primaryButtonClass} disabled={reportBusy === "variance"} onClick={() => void onRunVariance()}>
              {reportBusy === "variance" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : null}
              Run variance
            </button>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Final settlement</h2>
            <p className="text-sm text-muted-foreground">Calculate settlement for one offboarding request.</p>
            <select className={inputClass} value={settlementRequestId} onChange={(event) => setSettlementRequestId(event.target.value)}>
              <option value="">Offboarding request</option>
              {offboardingRequests.map((row) => (
                <option key={rowId(row)} value={rowId(row)}>#{rowId(row)} {readString(row, ["employeeName", "employee_name", "status"], "")}</option>
              ))}
            </select>
            <button type="button" className={primaryButtonClass} disabled={reportBusy === "settlement"} onClick={() => void onCalculateSettlement()}>
              {reportBusy === "settlement" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : null}
              Calculate
            </button>
          </div>
          {reportResult ? (
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold">Last report response</h2>
              <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(reportResult, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      ) : (
        <ResizableTable
          title={sectionTitle}
          data={rows}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey={`operations-payroll-${tab}-${configTab}`}
          toolbarStart={
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">{sectionTitle}</h2>
            </div>
          }
          toolbarActions={
            <>
              <SearchToggleField
                className="min-w-0"
                placeholder="Search payroll"
                value={search}
                onChange={setSearch}
              />
              {["runs", "inputs", "profiles"].includes(tab) ? (
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value)}
                >
                  <option value="">All periods</option>
                  {periods.map((row, index) => {
                    const id = readNumber(row, ["id"])
                    if (id === null) return null
                    return (
                      <option key={`period-filter-${id}-${index}`} value={String(id)}>
                        {readPeriodLabel(row)}
                      </option>
                    )
                  })}
                </select>
              ) : null}
              {["runs", "inputs", "profiles", "periods"].includes(tab) ? (
                <input
                  className="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-border dark:bg-background"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  placeholder="Status"
                />
              ) : null}
              {canCreate ? (
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() =>
                    openCreate(
                      tab === "runs"
                        ? "run"
                        : tab === "inputs"
                          ? "input"
                          : tab === "profiles"
                            ? "profile"
                            : tab === "periods"
                              ? "period"
                              : configTab === "components"
                                ? "component"
                                : configTab === "calendars"
                                  ? "calendar"
                                  : configTab === "structures"
                                    ? "structure"
                                    : configTab === "schemes"
                                      ? "scheme"
                                      : "mapping",
                    )
                  }
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {tab === "periods" ? "Generate period" : "Create"}
                  </span>
                </button>
              ) : null}
              {tab === "configuration" && configTab === "schemes" ? (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={openRuleDialog}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add rule
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-primary transition hover:bg-slate-50 disabled:opacity-60 dark:border-border dark:bg-background"
                disabled={loading}
                onClick={() => void loadRows({ refreshLookups: true })}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCwIcon className={cn("h-3.5 w-3.5 text-primary", loading && "animate-spin")} />
              </button>
            </>
          }
          onRowSelect={(_, row) => {
            if (!row) return
            void openDetail(row)
          }}
        />
      )}

      <RecordDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Payroll details"
        description={sectionTitle}
        row={detailRecord}
        content={<PayrollDetailsContent tab={tab} configTab={configTab} row={detailRecord} />}
        resolveLabel={(key) => prettify(key)}
        resolveValue={(key, row) => {
          const value = row[key]
          if (Array.isArray(value)) {
            return value.length === 0 ? "—" : value.map((entry) => formatAdminValue(entry)).join(", ")
          }
          if (typeof value === "object" && value !== null) {
            const label = readString(value as AdminRecord, ["name", "title", "code", "full_name", "fullName"])
            return label || JSON.stringify(value)
          }
          return formatAdminValue(value)
        }}
        footer={
          detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading latest details…
            </div>
          ) : null
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(980px,96vw)] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{createButtonLabel}</DialogTitle>
            <DialogDescription>
              {createMode === "profile"
                ? "Create or update an employee payroll profile."
                : createMode === "period"
                  ? "Generate a pay period from a calendar."
                  : `Add a ${createButtonLabel.replace(/^New /, "").toLowerCase()}.`}
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{renderCreateFields()}</div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={saving}
                onClick={() => void onCreate()}
              >
                {saving ? "Saving…" : createMode === "period" ? "Generate" : "Create"}
              </button>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(920px,96vw)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create statutory rule</DialogTitle>
            <DialogDescription>
              Tax or contribution rule for an existing scheme.
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Scheme">
                <select className={inputClass} value={ruleForm.schemeId} onChange={(event) => setRuleForm((current) => ({ ...current, schemeId: event.target.value }))}>
                  <option value="">Select a scheme</option>
                  {schemes.map((row, index) => {
                    const id = readNumber(row, ["id"])
                    if (id === null) return null
                    return (
                      <option key={`scheme-rule-${id}-${index}`} value={String(id)}>
                        {optionLabel(row)}
                      </option>
                    )
                  })}
                </select>
              </Field>
              <Field label="Version number">
                <input className={inputClass} value={ruleForm.versionNumber} onChange={(event) => setRuleForm((current) => ({ ...current, versionNumber: event.target.value }))} />
              </Field>
              <Field label="Calculation method">
                <select className={inputClass} value={ruleForm.calculationMethod} onChange={(event) => setRuleForm((current) => ({ ...current, calculationMethod: event.target.value }))}>
                  {CALCULATION_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {prettify(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Effective from">
                <input className={inputClass} type="date" value={ruleForm.effectiveFrom} onChange={(event) => setRuleForm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
              </Field>
              <Field label="Effective to">
                <input className={inputClass} type="date" value={ruleForm.effectiveTo} onChange={(event) => setRuleForm((current) => ({ ...current, effectiveTo: event.target.value }))} />
              </Field>
              <Field label="Employee rate">
                <input className={inputClass} value={ruleForm.employeeRate} onChange={(event) => setRuleForm((current) => ({ ...current, employeeRate: event.target.value }))} />
              </Field>
              <Field label="Employer rate">
                <input className={inputClass} value={ruleForm.employerRate} onChange={(event) => setRuleForm((current) => ({ ...current, employerRate: event.target.value }))} />
              </Field>
              <Field label="Maximum basis">
                <input className={inputClass} value={ruleForm.maximumBasis} onChange={(event) => setRuleForm((current) => ({ ...current, maximumBasis: event.target.value }))} />
              </Field>
              <Field label="Deduct before tax">
                <select className={inputClass} value={ruleForm.deductEmployeeBeforeTax} onChange={(event) => setRuleForm((current) => ({ ...current, deductEmployeeBeforeTax: event.target.value }))}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Band lower limit">
                <input className={inputClass} value={ruleForm.lowerLimit} onChange={(event) => setRuleForm((current) => ({ ...current, lowerLimit: event.target.value }))} />
              </Field>
              <Field label="Band upper limit">
                <input className={inputClass} value={ruleForm.upperLimit} onChange={(event) => setRuleForm((current) => ({ ...current, upperLimit: event.target.value }))} />
              </Field>
              <Field label="Base tax">
                <input className={inputClass} value={ruleForm.baseTax} onChange={(event) => setRuleForm((current) => ({ ...current, baseTax: event.target.value }))} />
              </Field>
              <Field label="Rate percent">
                <input className={inputClass} value={ruleForm.ratePercent} onChange={(event) => setRuleForm((current) => ({ ...current, ratePercent: event.target.value }))} />
              </Field>
              <Field label="Band sort order">
                <input className={inputClass} value={ruleForm.sortOrder} onChange={(event) => setRuleForm((current) => ({ ...current, sortOrder: event.target.value }))} />
              </Field>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setRuleOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={saving}
                onClick={() => void onCreateRule()}
              >
                {saving ? "Saving…" : "Create rule"}
              </button>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve payroll run</DialogTitle>
            <DialogDescription>
              Choose the approval stage and enter the calculation hash.
            </DialogDescription>
          </DialogHeader>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <div className="grid gap-3">
            <Field label="Approval stage">
              <select className={inputClass} value={approveForm.stage} onChange={(event) => setApproveForm((current) => ({ ...current, stage: event.target.value }))}>
                {APPROVAL_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {prettify(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Calculation hash">
              <input className={inputClass} value={approveForm.calculationHash} onChange={(event) => setApproveForm((current) => ({ ...current, calculationHash: event.target.value }))} />
            </Field>
            <Field label="Comments">
              <textarea className={textareaClass} value={approveForm.comments} onChange={(event) => setApproveForm((current) => ({ ...current, comments: event.target.value }))} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void onApproveRun()}
            >
              {saving ? "Saving…" : "Approve run"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}

export default PayrollOperationsView
