"use client"

import { LeaveAccrualSimulator } from "@/components/leave/leave-accrual-simulator"
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { InfoLabel } from "@fluentui/react-components"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { Check, ChevronDown, Plus, Trash2, Users } from "lucide-react"

import { useDashboardMotion } from "@/lib/dashboard-motion"

import {
  WorkflowChoiceCard,
  WorkflowSelect,
  type WorkflowOption,
} from "@/components/dashboard/leave-workflow-ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  assignmentDefaultsFromLeaveType,
  attachedLeavePolicyTypes,
  emptyLeavePolicyTypeAssignment,
  hasPolicyAdvancedRules,
  hasPolicyCoverageLimits,
  LEAVE_POLICY_CONFIRMATION_OPTIONS,
  LEAVE_POLICY_DAY_TREATMENT_OPTIONS,
  LEAVE_POLICY_EMPLOYMENT_TYPE_OPTIONS,
  leavePolicyCoverageParts,
  leavePolicyTypeLabel,
  type LeavePolicyFormValue,
  type LeavePolicyTypeAssignment,
} from "@/lib/leave-policy-form"
import { cn } from "@/lib/utils"

export {
  emptyLeavePolicyForm,
  emptyLeavePolicyTypeAssignment,
  type LeavePolicyFormValue,
  type LeavePolicyTypeAssignment,
} from "@/lib/leave-policy-form"

type PolicyLeaveTypeOption = WorkflowOption & {
  maxDaysPerYear?: string
  maxCarryForwardDays?: string
  carryForwardAllowed?: boolean
}

type LeavePolicyEditorSheetProps = {
  open: boolean
  mode: "create" | "edit"
  value: LeavePolicyFormValue
  leaveTypeOptions: PolicyLeaveTypeOption[]
  branchOptions: WorkflowOption[]
  departmentOptions: WorkflowOption[]
  positionOptions: WorkflowOption[]
  gradeOptions: WorkflowOption[]
  saving: boolean
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onValueChange: (patch: Partial<LeavePolicyFormValue>) => void
  onSubmit: () => void | Promise<void>
}

const EMPLOYMENT_TYPE_OPTIONS = LEAVE_POLICY_EMPLOYMENT_TYPE_OPTIONS
const CONFIRMATION_OPTIONS = LEAVE_POLICY_CONFIRMATION_OPTIONS
const DAY_TREATMENT_OPTIONS = LEAVE_POLICY_DAY_TREATMENT_OPTIONS

function HintIcon({ text }: { text: string }) {
  return (
    <InfoLabel info={text} label={{ className: "sr-only" }} size="small">
      More information
    </InfoLabel>
  )
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <InfoLabel
      className="text-xs font-medium text-slate-700 dark:text-slate-200"
      info={hint}
      size="small"
    >
      {label}
    </InfoLabel>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <FieldLabel label={label} hint={hint} />
      {children}
    </label>
  )
}

function BoolPair({
  label,
  hint,
  value,
  layoutId,
  trueLabel = "Yes",
  falseLabel = "No",
  onChange,
}: {
  label: string
  hint?: string
  value: string
  layoutId: string
  trueLabel?: string
  falseLabel?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0">
      <FieldLabel label={label} hint={hint} />
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {[
          ["true", trueLabel],
          ["false", falseLabel],
        ].map(([optionValue, optionLabel]) => {
          const active = value === optionValue
          return (
            <WorkflowChoiceCard
              key={optionValue}
              active={active}
              layoutId={layoutId}
              onClick={() => onChange(optionValue)}
            >
              <span className={cn("block text-xs font-semibold", active ? "text-white" : "text-slate-900")}>
                {optionLabel}
              </span>
            </WorkflowChoiceCard>
          )
        })}
      </div>
    </div>
  )
}


function ChoiceRow({
  label,
  hint,
  value,
  layoutId,
  options,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  layoutId: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <FieldLabel label={label} hint={hint} />
      <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {options.map(([optionValue, optionLabel]) => {
          const active = value === optionValue
          return (
            <WorkflowChoiceCard
              key={optionValue || "default"}
              active={active}
              layoutId={layoutId}
              onClick={() => onChange(optionValue)}
            >
              <span className={cn("block text-xs font-semibold", active ? "text-white" : "text-slate-900")}>
                {optionLabel}
              </span>
            </WorkflowChoiceCard>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Per-leave-type accrual and carry-forward rules for this policy, so e.g.
 * annual leave can accrue daily pro-rata while other types stay yearly.
 */
function PolicyTypeAccrualCarryForward({
  index,
  assignment,
  onChange,
}: {
  index: number
  assignment: LeavePolicyTypeAssignment
  onChange: (patch: Partial<LeavePolicyTypeAssignment>) => void
}) {
  const custom = assignment.carry_forward_enabled !== ""
  const enabled = assignment.carry_forward_enabled === "true"
  return (
    <>
      <ChoiceRow
        label="Accrual for this type"
        hint="Daily: entitlement ÷ days in the leave year per day. Weekly: ÷ 52 per week. Monthly: ÷ 12 per month. Yearly: one credit per leave year (upfront when credited in advance)."
        value={assignment.accrual_method}
        layoutId={`policy-type-accrual-${index}`}
        options={[
          ["", "Policy schedule"],
          ["daily", "Daily"],
          ["weekly", "Weekly"],
          ["monthly", "Monthly"],
          ["yearly", "Yearly"],
        ]}
        onChange={(next) => onChange({ accrual_method: next })}
      />
      <ChoiceRow
        label="Accrual starts"
        hint="Eligibility to apply is set separately (Allow during probation). After probation: nothing is earned until the approved confirmation date; employees without probation earn from their hire date. Check this against the employment contract and the Employment and Labour Relations Act before using it."
        value={assignment.accrual_start_basis}
        layoutId={`policy-type-accrual-start-${index}`}
        options={[
          ["hire_date", "From hire date"],
          ["probation_completion", "After probation"],
        ]}
        onChange={(next) => onChange({ accrual_start_basis: next })}
      />
      <ChoiceRow
        label="Credited"
        hint="In advance: each period's days are available from its first day (yearly in advance = upfront allocation). In arrears: only once the period has been worked."
        value={assignment.accrual_timing}
        layoutId={`policy-type-accrual-timing-${index}`}
        options={[
          ["in_advance", "In advance"],
          ["in_arrears", "In arrears"],
        ]}
        onChange={(next) => onChange({ accrual_timing: next })}
      />
      {assignment.accrual_method === "yearly" ? (
        <ChoiceRow
          label="Partial first year"
          hint="Pro-rate the yearly credit when the employee starts earning part-way through the leave year."
          value={assignment.accrual_prorate}
          layoutId={`policy-type-accrual-prorate-${index}`}
          options={[
            ["false", "Full credit"],
            ["true", "Pro-rated"],
          ]}
          onChange={(next) => onChange({ accrual_prorate: next })}
        />
      ) : null}
      <LeaveAccrualSimulator
        frequency={assignment.accrual_method}
        entitlement={assignment.annual_quota_days}
        startBasis={assignment.accrual_start_basis}
        timing={assignment.accrual_timing}
        prorate={assignment.accrual_prorate === "true"}
      />
      <ChoiceRow
        label="Carry-forward"
        hint="Use the leave type's basic setting, or set a carry-forward rule for employees covered by this policy."
        value={assignment.carry_forward_enabled}
        layoutId={`policy-type-cf-${index}`}
        options={[
          ["", "Leave type default"],
          ["true", "Allowed"],
          ["false", "Not allowed"],
        ]}
        onChange={(next) => onChange({ carry_forward_enabled: next })}
      />
      {custom && enabled ? (
        <>
          <ChoiceRow
            label="How much is carried"
            hint="All unused days, up to a limit, or a percentage of unused days (still capped by the limit when one is set)."
            value={assignment.carry_forward_method}
            layoutId={`policy-type-cf-method-${index}`}
            options={[
              ["", "Automatic"],
              ["all", "All unused"],
              ["limited", "Up to a limit"],
              ["percentage", "Percentage"],
            ]}
            onChange={(next) => onChange({ carry_forward_method: next })}
          />
          {assignment.carry_forward_method === "percentage" ? (
            <Field label="Percentage carried" hint="Share of unused days carried into the new leave year (0–100).">
              <Input
                type="number"
                min={0}
                max={100}
                value={assignment.carry_forward_percentage}
                onChange={(event) => onChange({ carry_forward_percentage: event.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Max days carried" hint="Leave blank for no cap.">
            <Input
              type="number"
              min={0}
              step="0.5"
              placeholder="No cap"
              value={assignment.carry_forward_max_days}
              onChange={(event) => onChange({ carry_forward_max_days: event.target.value })}
            />
          </Field>
          <ChoiceRow
            label="Carried days expire"
            hint="When unused carried-forward days lapse in the new leave year."
            value={assignment.carry_forward_expiry_mode}
            layoutId={`policy-type-cf-expiry-${index}`}
            options={[
              ["none", "Never"],
              ["months", "After months"],
              ["date", "On a date"],
            ]}
            onChange={(next) => onChange({ carry_forward_expiry_mode: next })}
          />
          {assignment.carry_forward_expiry_mode === "months" ? (
            <Field label="Months into the new year" hint="e.g. 3 = carried days expire after 31 March.">
              <Input
                type="number"
                min={1}
                max={12}
                value={assignment.carry_forward_expiry_months}
                onChange={(event) => onChange({ carry_forward_expiry_months: event.target.value })}
              />
            </Field>
          ) : null}
          {assignment.carry_forward_expiry_mode === "date" ? (
            <Field label="Expiry date (MM-DD)" hint="Day of the new leave year, e.g. 06-30.">
              <Input
                type="text"
                inputMode="numeric"
                pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])"
                placeholder="MM-DD"
                value={assignment.carry_forward_expiry_date}
                onChange={(event) => onChange({ carry_forward_expiry_date: event.target.value })}
              />
            </Field>
          ) : null}
          {assignment.carry_forward_expiry_mode !== "none" ? (
            <BoolPair
              label="Expire automatically"
              hint="Unused carried days are removed on the expiry date and recorded in the balance history."
              value={assignment.carry_forward_auto_expire}
              layoutId={`policy-type-cf-auto-${index}`}
              trueLabel="Automatic"
              falseLabel="HR decides"
              onChange={(next) => onChange({ carry_forward_auto_expire: next })}
            />
          ) : null}
          <BoolPair
            label="Use carried days first"
            hint="Whether leave taken uses carried-forward days before newly accrued days."
            value={assignment.carry_forward_consume_first}
            layoutId={`policy-type-cf-first-${index}`}
            trueLabel="Carried first"
            falseLabel="Accrued first"
            onChange={(next) => onChange({ carry_forward_consume_first: next })}
          />
        </>
      ) : null}
      <div className="sm:col-span-2 mt-1 border-t border-slate-200 pt-2 dark:border-border">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          Leave Carry-Forward, Expiry &amp; Encashment Rules
        </p>
        <p className="text-[11px] text-slate-500">
          Applied at year-end rollover, in this order: carry forward, automatic encashment, then lapse. Protected days are never lapsed.
        </p>
      </div>
      <BoolPair
        label="Unused days may lapse"
        hint="If not, days that are neither carried nor encashed are kept as retained days on the new year for HR to resolve."
        value={assignment.lapse_enabled}
        layoutId={`policy-type-lapse-${index}`}
        trueLabel="May lapse"
        falseLabel="Retain"
        onChange={(next) => onChange({ lapse_enabled: next })}
      />
      <Field
        label="Protected days (never lapse)"
        hint="Minimum unused days that must be kept (e.g. a statutory or contractual minimum). A stricter statutory rule applies automatically."
      >
        <Input
          type="number"
          min={0}
          step="0.5"
          value={assignment.protected_minimum_days}
          onChange={(event) => onChange({ protected_minimum_days: event.target.value })}
        />
      </Field>
      <BoolPair
        label="Automatic year-end encashment"
        hint="Pay out unused days left after carry-forward. Payment goes to payroll as a draft input and is marked paid only when payroll pays it."
        value={assignment.auto_encash_enabled}
        layoutId={`policy-type-auto-encash-${index}`}
        trueLabel="On"
        falseLabel="Off"
        onChange={(next) => onChange({ auto_encash_enabled: next })}
      />
      {assignment.auto_encash_enabled === "true" ? (
        <>
          <ChoiceRow
            label="How much is encashed"
            value={assignment.auto_encash_method}
            layoutId={`policy-type-ae-method-${index}`}
            options={[
              ["all", "All eligible"],
              ["limited", "Up to a limit"],
              ["percentage", "Percentage"],
            ]}
            onChange={(next) => onChange({ auto_encash_method: next })}
          />
          {assignment.auto_encash_method !== "all" ? (
            <Field label="Max days encashed" hint="Leave blank for no limit.">
              <Input
                type="number"
                min={0}
                value={assignment.auto_encash_max_days}
                onChange={(event) => onChange({ auto_encash_max_days: event.target.value })}
              />
            </Field>
          ) : null}
          {assignment.auto_encash_method === "percentage" ? (
            <Field label="Percentage encashed" hint="Share of the remaining days paid out (0–100).">
              <Input
                type="number"
                min={0}
                max={100}
                value={assignment.auto_encash_percentage}
                onChange={(event) => onChange({ auto_encash_percentage: event.target.value })}
              />
            </Field>
          ) : null}
        </>
      ) : null}
      <ChoiceRow
        label="Encashment salary basis"
        hint="Daily rate = this salary ÷ the encashment rate divisor."
        value={assignment.encashment_salary_basis}
        layoutId={`policy-type-salary-basis-${index}`}
        options={[
          ["basic", "Basic salary"],
          ["gross", "Gross (basic + allowances)"],
        ]}
        onChange={(next) => onChange({ encashment_salary_basis: next })}
      />
    </>
  )
}

type PolicyStage = "basics" | "entitlements" | "who" | "rules"

const STAGES: Array<{ key: PolicyStage; number: string; label: string }> = [
  { key: "basics", number: "01", label: "Basics" },
  { key: "entitlements", number: "02", label: "Entitlements" },
  { key: "who", number: "03", label: "Eligibility" },
  { key: "rules", number: "04", label: "Day rules" },
]



export function LeavePolicyEditorSheet({
  open,
  mode,
  value,
  leaveTypeOptions,
  branchOptions,
  departmentOptions,
  positionOptions,
  gradeOptions,
  saving,
  canSubmit,
  onOpenChange,
  onValueChange,
  onSubmit,
}: LeavePolicyEditorSheetProps) {
  const { reduce } = useDashboardMotion()
  const [stage, setStage] = React.useState<PolicyStage>("basics")
  const [narrowCoverage, setNarrowCoverage] = React.useState(false)
  const [showAdvancedRules, setShowAdvancedRules] = React.useState(false)
  const [openTypeIndex, setOpenTypeIndex] = React.useState<number | null>(0)
  const wasOpen = React.useRef(false)

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setStage("basics")
      setNarrowCoverage(hasPolicyCoverageLimits(value))
      setShowAdvancedRules(hasPolicyAdvancedRules(value))
      setOpenTypeIndex(0)
    } else if (open) {
      setNarrowCoverage((current) => current || hasPolicyCoverageLimits(value))
      setShowAdvancedRules((current) => current || hasPolicyAdvancedRules(value))
    }
    wasOpen.current = open
  }, [open, value])

  const attachedTypes = attachedLeavePolicyTypes(value)
  const usedTypeIds = new Set(attachedTypes.map((row) => row.leave_type_id).filter(Boolean))
  const remainingTypes = leaveTypeOptions.filter((option) => !usedTypeIds.has(option.value))
  const hasName = Boolean(value.name.trim())
  const hasTypes = attachedTypes.length > 0
  const canLeavePolicyStage = hasName && hasTypes
  const isEdit = mode === "edit"
  const coverageParts = leavePolicyCoverageParts(value, {
    branches: branchOptions,
    departments: departmentOptions,
    positions: positionOptions,
    grades: gradeOptions,
  })
  const coverageSummary = coverageParts.length ? coverageParts.join(" · ") : "Everyone"
  const typeSummary =
    attachedTypes.length === 0
      ? "No leave types yet"
      : attachedTypes
          .map((row) => `${leavePolicyTypeLabel(row, leaveTypeOptions)} ${row.annual_quota_days || "0"}d`)
          .join(" · ")

  const stageUnlocked: Record<PolicyStage, boolean> = {
    basics: true,
    entitlements: hasName || isEdit,
    who: canLeavePolicyStage || isEdit,
    rules: canLeavePolicyStage || isEdit,
  }

  const readinessMessage =
    stage === "basics"
      ? !hasName
        ? "Name the policy to continue."
        : "Continue to define the leave entitlements."
      : stage === "entitlements"
        ? !hasTypes
          ? "Attach at least one existing leave type."
          : "Entitlements are ready. Continue to eligibility."
      : stage === "who"
        ? narrowCoverage
          ? `Limited to ${coverageSummary}.`
          : "Applies to everyone. You can still narrow it."
        : "Ready to save. Extra rules stay optional."

  const updateAssignment = (index: number, patch: Partial<LeavePolicyTypeAssignment>) => {
    onValueChange({
      leave_types: value.leave_types.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    })
  }

  const defaultsForLeaveType = (leaveTypeId: string) => {
    const option = leaveTypeOptions.find((item) => item.value === leaveTypeId)
    return assignmentDefaultsFromLeaveType(leaveTypeId, {
      name: option?.label,
      maxDaysPerYear: option?.maxDaysPerYear,
      maxCarryForwardDays: option?.maxCarryForwardDays,
      carryForwardAllowed: option?.carryForwardAllowed,
    })
  }

  const attachLeaveType = (leaveTypeId: string) => {
    const seeded = defaultsForLeaveType(leaveTypeId)
    const emptyIndex = value.leave_types.findIndex((row) => !row.leave_type_id)
    if (emptyIndex >= 0) {
      updateAssignment(emptyIndex, seeded)
      setOpenTypeIndex(emptyIndex)
      return
    }
    onValueChange({
      leave_types: [...value.leave_types, seeded],
    })
    setOpenTypeIndex(value.leave_types.length)
  }

  const removeLeaveType = (index: number) => {
    const next = value.leave_types.filter((_, rowIndex) => rowIndex !== index)
    onValueChange({ leave_types: next.length ? next : [emptyLeavePolicyTypeAssignment()] })
    setOpenTypeIndex(0)
  }

  const applyEveryone = () => {
    setNarrowCoverage(false)
    onValueChange({
      applicable_branch_id: "",
      applicable_department_id: "",
      applicable_position_id: "",
      applicable_grade_id: "",
      applicable_employment_type: "",
      applicable_confirmation_status: "",
    })
  }

  const goToStage = (next: PolicyStage) => {
    if (!stageUnlocked[next]) return
    setStage(next)
  }

  const stageMotion = (direction: "forward" | "back") =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : {
          initial: { opacity: 0, x: direction === "forward" ? 40 : -40 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: direction === "forward" ? -40 : 40 },
        }

  const currentIndex = STAGES.findIndex((item) => item.key === stage)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="relative inset-0 h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none data-[side=right]:inset-0 data-[side=right]:left-0 data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:border-0 data-[side=right]:sm:max-w-none data-[side=right]:data-starting-style:translate-x-0 data-[side=right]:data-ending-style:translate-x-0"
      >
        <header className="shrink-0 border-b border-border bg-gradient-to-r from-primary/10 via-white to-white px-4 py-3 pr-12 sm:px-6 dark:from-primary/20 dark:via-background dark:to-background">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {mode === "create" ? "Create leave policy" : "Edit leave policy"}
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-slate-500">
                {isEdit
                  ? [value.name.trim() || "Untitled policy", typeSummary, coverageSummary].join(" · ")
                  : stage === "basics"
                    ? "Name the policy and set its status."
                    : stage === "entitlements"
                      ? "Attach existing leave types and define what employees receive."
                    : stage === "who"
                      ? "Keep it company-wide, or limit it to a group."
                      : "Set how days are counted. Extra rules stay folded away."}
              </SheetDescription>
            </div>
            <nav className="flex w-full items-center gap-1 overflow-x-auto pb-1 sm:w-auto sm:pb-0" aria-label="Policy steps">
              {STAGES.map((item, index) => {
                const active = item.key === stage
                const done = currentIndex > index
                const unlocked = stageUnlocked[item.key]
                return (
                  <React.Fragment key={item.key}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => goToStage(item.key)}
                      aria-current={active ? "step" : undefined}
                      aria-label={`${item.number} ${item.label}`}
                      className={cn(
                        "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        active
                          ? "bg-primary text-white"
                          : done
                            ? "bg-primary/10 text-primary"
                            : unlocked
                              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              : "cursor-not-allowed bg-slate-50 text-slate-400",
                      )}
                    >
                      <span className="tabular-nums">{done && !active ? "✓" : item.number}</span>
                      <span className="hidden min-[480px]:inline">{item.label}</span>
                    </button>
                    {index < STAGES.length - 1 ? (
                      <span className={cn("h-px w-4 sm:w-6", currentIndex > index ? "bg-primary" : "bg-slate-200")} />
                    ) : null}
                  </React.Fragment>
                )
              })}
            </nav>
          </div>
        </header>

        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {stage === "basics" || stage === "entitlements" ? (
              <motion.div
                key={`${stage}-stage`}
                className="flex h-full min-h-0 justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-10"
                {...stageMotion("forward")}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-full max-w-2xl space-y-5">
                  {stage === "basics" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Policy name" hint="The name shown in the policy list. Example: Staff leave rules.">
                        <Input
                          autoFocus
                          placeholder="e.g. Staff leave rules"
                          value={value.name}
                          onChange={(event) => onValueChange({ name: event.target.value })}
                        />
                      </Field>
                      <div className="min-w-0">
                        <FieldLabel label="Status" hint="Active means staff can use it. Inactive means it is turned off." />
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          {[
                            ["active", "Active"],
                            ["inactive", "Inactive"],
                          ].map(([optionValue, label]) => {
                            const active = value.status === optionValue
                            return (
                              <WorkflowChoiceCard
                                key={optionValue}
                                active={active}
                                layoutId="policy-status-choice"
                                onClick={() => onValueChange({ status: optionValue })}
                              >
                                <span className={cn("block text-xs font-semibold", active ? "text-white" : "text-slate-900")}>
                                  {label}
                                </span>
                              </WorkflowChoiceCard>
                            )
                          })}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Notes" hint="Add any extra details. You can leave this blank.">
                          <Input
                            placeholder="Optional"
                            value={value.description}
                            onChange={(event) => onValueChange({ description: event.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : (
                    <>
                      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-border dark:bg-muted/30">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Shared accrual schedule</h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            This schedule applies to the leave types attached below. Each type keeps its own yearly allowance and limits.
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0 sm:col-span-2">
                            <FieldLabel label="Accrual schedule" hint="Choose when leave days are added: yearly, monthly, or by HR." />
                            <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                              {[
                                ["yearly", "Yearly"],
                                ["monthly", "Monthly"],
                                ["daily", "Daily pro-rata"],
                                ["manual", "Manual"],
                              ].map(([optionValue, label]) => {
                                const active = value.accrual_method === optionValue
                                return (
                                  <WorkflowChoiceCard
                                    key={optionValue}
                                    active={active}
                                    layoutId="policy-accrual-choice"
                                    onClick={() => onValueChange({ accrual_method: optionValue })}
                                  >
                                    <span className={cn("block text-xs font-semibold", active ? "text-white" : "text-slate-900")}>
                                      {label}
                                    </span>
                                  </WorkflowChoiceCard>
                                )
                              })}
                            </div>
                          </div>
                          {value.accrual_method !== "manual" && value.accrual_method !== "daily" ? (
                            <Field label="Days added each period" hint="How many leave days are added each time.">
                              <Input
                                type="number"
                                min={0}
                                value={value.accrual_rate}
                                onChange={(event) => onValueChange({ accrual_rate: event.target.value })}
                              />
                            </Field>
                          ) : null}
                        </div>
                      </section>

                      <section className="space-y-2" aria-labelledby="policy-entitlements-heading">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 id="policy-entitlements-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
                          Leave entitlements
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">Choose from existing leave types; this does not create or change a leave type.</p>
                      </div>
                      <span className="text-[11px] font-medium text-primary">
                        {attachedTypes.length} attached
                      </span>
                    </div>

                    {attachedTypes.length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">No entitlements yet</p>
                        <p className="mt-1 text-xs text-slate-500">Choose an existing leave type below to configure its allowance.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {value.leave_types.map((assignment, index) => {
                          if (!assignment.leave_type_id && !assignment.leave_type_name) return null
                          const typeName = leavePolicyTypeLabel(assignment, leaveTypeOptions)
                          const expanded = openTypeIndex === index
                          return (
                            <div
                              key={`policy-type-${assignment.leave_type_id}-${index}`}
                              className={cn(
                                "overflow-hidden rounded-md border transition",
                                expanded ? "border-primary bg-primary/5" : "border-slate-200 bg-white",
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => setOpenTypeIndex(expanded ? null : index)}
                                >
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                    {typeName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {assignment.requires_approval === "true" ? "Approval required" : "No approval"}
                                    {assignment.encashment_enabled === "true" ? " · Encashment on" : ""}
                                  </p>
                                </button>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                  <Input
                                    type="number"
                                    min={0} className="w-16 text-center"
                                    value={assignment.annual_quota_days}
                                    onChange={(event) => {
                                      const next = event.target.value
                                      const keepMaxInSync =
                                        assignment.max_per_request_days === assignment.annual_quota_days
                                      updateAssignment(index, {
                                        annual_quota_days: next,
                                        ...(keepMaxInSync ? { max_per_request_days: next } : {}),
                                      })
                                    }}
                                    aria-label={`${typeName} yearly allowance in this policy`}
                                  />
                                  <span className="inline-flex items-center gap-1">
                                    days / year
                                    <HintIcon text="How many days of this leave an employee gets each year." />
                                  </span>
                                </label>
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    className={cn(
                                      "inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                      assignment.requires_approval === "true"
                                        ? "bg-primary text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                                    )}
                                    onClick={() =>
                                      updateAssignment(index, {
                                        requires_approval: assignment.requires_approval === "true" ? "false" : "true",
                                      })
                                    }
                                  >
                                    {assignment.requires_approval === "true" ? "Approval" : "No approval"}
                                  </button>
                                  <HintIcon text="Turn this on if a manager or HR must approve requests." />
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex size-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                  onClick={() => setOpenTypeIndex(expanded ? null : index)}
                                  aria-expanded={expanded}
                                  aria-label={expanded ? "Hide extra type rules" : "Show extra type rules"}
                                >
                                  <ChevronDown className={cn("size-4 transition", expanded ? "rotate-180" : "")} />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex size-9 items-center justify-center rounded-md text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                                  onClick={() => removeLeaveType(index)}
                                  aria-label={`Remove ${typeName}`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                              <AnimatePresence initial={false}>
                                {expanded ? (
                                  <motion.div
                                    initial={reduce ? false : { height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="grid gap-3 border-t border-primary/20 px-3 py-3 sm:grid-cols-2">
                                      <Field
                                        label="Max per request"
                                        hint="Filled from this leave type's yearly maximum. You can lower it for this policy. Enter 0 for no extra cap."
                                      >
                                        <Input
                                          type="number"
                                          min={0}
                                          value={assignment.max_per_request_days}
                                          onChange={(event) =>
                                            updateAssignment(index, { max_per_request_days: event.target.value })
                                          }
                                        />
                                      </Field>
                                      <Field
                                        label="Maximum accumulated balance"
                                        hint="The most leave days an employee may hold for this type (applied to balance imports). Enter 0 for no limit."
                                      >
                                        <Input
                                          type="number"
                                          min={0}
                                          value={assignment.maximum_accumulation_days}
                                          onChange={(event) =>
                                            updateAssignment(index, { maximum_accumulation_days: event.target.value })
                                          }
                                        />
                                      </Field>
                                      <PolicyTypeAccrualCarryForward
                                        index={index}
                                        assignment={assignment}
                                        onChange={(patch) => updateAssignment(index, patch)}
                                      />
                                      <BoolPair
                                        label="Encashment"
                                        hint="Choose whether employees can receive money for unused leave days."
                                        value={assignment.encashment_enabled}
                                        layoutId={`policy-type-encash-${index}`}
                                        trueLabel="Allowed"
                                        falseLabel="Not allowed"
                                        onChange={(next) => updateAssignment(index, { encashment_enabled: next })}
                                      />
                                      {assignment.encashment_enabled === "true" ? (
                                        <>
                                          <Field
                                            label="Salary divisor for encashment"
                                            hint="Monthly base salary is divided by this value to calculate pay per unused leave day. Set this from your approved HR/Finance rule."
                                          >
                                            <Input
                                              type="number"
                                              min={1}
                                              step="0.01"
                                              required
                                              value={assignment.encashment_rate_divisor}
                                              onChange={(event) => updateAssignment(index, { encashment_rate_divisor: event.target.value })}
                                            />
                                          </Field>
                                          <Field
                                            label="Max encashment days"
                                            hint="The most unused days an employee can exchange for money at one time."
                                          >
                                            <Input
                                              type="number"
                                              min={0}
                                              value={assignment.maximum_encashment_days}
                                              onChange={(event) =>
                                                updateAssignment(index, { maximum_encashment_days: event.target.value })
                                              }
                                            />
                                          </Field>
                                          <Field
                                            label="Min balance after"
                                            hint="How many leave days must remain after days are exchanged for money."
                                          >
                                            <Input
                                              type="number"
                                              min={0}
                                              value={assignment.minimum_balance_after_encashment}
                                              onChange={(event) =>
                                                updateAssignment(index, {
                                                  minimum_balance_after_encashment: event.target.value,
                                                })
                                              }
                                            />
                                          </Field>
                                          <BoolPair
                                            label="Encashment approval"
                                            hint="Choose whether a manager or HR must approve this payment."
                                            value={assignment.encashment_requires_approval}
                                            layoutId={`policy-type-encash-approval-${index}`}
                                            trueLabel="Required"
                                            falseLabel="Not required"
                                            onChange={(next) =>
                                              updateAssignment(index, { encashment_requires_approval: next })
                                            }
                                          />
                                        </>
                                      ) : null}
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {remainingTypes.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-medium text-slate-500">Attach existing type</span>
                        {remainingTypes.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            onClick={() => attachLeaveType(option.value)}
                          >
                            <Plus className="size-3" />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : leaveTypeOptions.length === 0 ? (
                      <p className="text-xs text-amber-700">Create a leave type first, then come back to this policy.</p>
                    ) : null}
                      </section>
                    </>
                  )}
                </div>
              </motion.div>
            ) : stage === "who" ? (
              <motion.div
                key="who-stage"
                className="flex h-full min-h-0 justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-10"
                {...stageMotion("forward")}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-full max-w-2xl space-y-5">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-primary">{value.name.trim() || "Untitled policy"}</span>
                    {" · "}
                    <span className="font-semibold text-primary">{typeSummary}</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <WorkflowChoiceCard
                      active={!narrowCoverage}
                      layoutId="policy-coverage-choice"
                      onClick={applyEveryone}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                          !narrowCoverage ? "border-white bg-white text-primary" : "border-slate-300 text-transparent",
                        )}
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span>
                        <span className={cn("block text-sm font-semibold", !narrowCoverage ? "text-white" : "text-slate-900")}>
                          Everyone
                        </span>
                        <span className={cn("mt-0.5 block text-xs leading-4", !narrowCoverage ? "text-white/80" : "text-slate-500")}>
                          Company-wide. Skip the filters.
                        </span>
                      </span>
                    </WorkflowChoiceCard>
                    <WorkflowChoiceCard
                      active={narrowCoverage}
                      layoutId="policy-coverage-choice"
                      onClick={() => setNarrowCoverage(true)}
                      className="flex items-start gap-2.5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                          narrowCoverage ? "border-white bg-white text-primary" : "border-slate-300 text-transparent",
                        )}
                      >
                        <Users className="size-3" />
                      </span>
                      <span>
                        <span className={cn("block text-sm font-semibold", narrowCoverage ? "text-white" : "text-slate-900")}>
                          Specific groups
                        </span>
                        <span className={cn("mt-0.5 block text-xs leading-4", narrowCoverage ? "text-white/80" : "text-slate-500")}>
                          Limit by branch, team, grade, or status.
                        </span>
                      </span>
                    </WorkflowChoiceCard>
                  </div>

                  <AnimatePresence initial={false}>
                    {narrowCoverage ? (
                      <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0">
                            <div className="mb-1">
                              <FieldLabel
                                label="Branch"
                                hint="Use All branches for everyone, or choose one branch."
                              />
                            </div>
                            <WorkflowSelect
                              value={value.applicable_branch_id}
                              options={branchOptions}
                              placeholder="All branches"
                              allLabel="All branches"
                              onValueChange={(next) => onValueChange({ applicable_branch_id: next })}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1">
                              <FieldLabel
                                label="Department"
                                hint="Use All departments for everyone, or choose one department."
                              />
                            </div>
                            <WorkflowSelect
                              value={value.applicable_department_id}
                              options={departmentOptions}
                              placeholder="All departments"
                              allLabel="All departments"
                              onValueChange={(next) => onValueChange({ applicable_department_id: next })}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1">
                              <FieldLabel
                                label="Position"
                                hint="Use All positions for everyone, or choose one position."
                              />
                            </div>
                            <WorkflowSelect
                              value={value.applicable_position_id}
                              options={positionOptions}
                              placeholder="All positions"
                              allLabel="All positions"
                              onValueChange={(next) => onValueChange({ applicable_position_id: next })}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1">
                              <FieldLabel
                                label="Grade"
                                hint="Use All grades for everyone, or choose one grade."
                              />
                            </div>
                            <WorkflowSelect
                              value={value.applicable_grade_id}
                              options={gradeOptions}
                              placeholder="All grades"
                              allLabel="All grades"
                              onValueChange={(next) => onValueChange({ applicable_grade_id: next })}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1">
                              <FieldLabel
                                label="Employment type"
                                hint="Use All types for everyone, or choose one employment type."
                              />
                            </div>
                            <WorkflowSelect
                              value={value.applicable_employment_type}
                              options={EMPLOYMENT_TYPE_OPTIONS}
                              placeholder="All types"
                              allLabel="All types"
                              onValueChange={(next) => onValueChange({ applicable_employment_type: next })}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1">
                              <FieldLabel
                                label="Confirmation"
                                hint="Use All statuses for everyone, or choose one staff status."
                              />
                            </div>
                            <WorkflowSelect
                              value={value.applicable_confirmation_status}
                              options={CONFIRMATION_OPTIONS}
                              placeholder="All statuses"
                              allLabel="All statuses"
                              onValueChange={(next) => onValueChange({ applicable_confirmation_status: next })}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="rules-stage"
                className="flex h-full min-h-0 justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-10"
                {...stageMotion("forward")}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-full max-w-3xl space-y-5">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-primary">{value.name.trim() || "Untitled policy"}</span>
                    {" · "}
                    <span className="font-semibold text-primary">{coverageSummary}</span>
                    {" · "}
                    <span className="font-semibold text-primary">{typeSummary}</span>
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Longest stretch" hint="The most leave days an employee can take in a row.">
                      <Input
                        type="number"
                        min={1}
                        value={value.max_consecutive_days}
                        onChange={(event) => onValueChange({ max_consecutive_days: event.target.value })}
                      />
                    </Field>
                    <div className="min-w-0">
                      <div className="mb-1">
                        <FieldLabel label="Weekly offs" hint="Choose if weekends or scheduled days off count as leave." />
                      </div>
                      <WorkflowSelect
                        value={value.weekly_off_treatment}
                        options={DAY_TREATMENT_OPTIONS}
                        placeholder="Follow schedule"
                        onValueChange={(next) => onValueChange({ weekly_off_treatment: next })}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1">
                        <FieldLabel label="Holidays" hint="Choose if public holidays count as leave days." />
                      </div>
                      <WorkflowSelect
                        value={value.holiday_treatment}
                        options={DAY_TREATMENT_OPTIONS}
                        placeholder="Exclude"
                        onValueChange={(next) => onValueChange({ holiday_treatment: next })}
                      />
                    </div>
                    <BoolPair
                      label="During probation"
                      hint="Choose whether staff on probation can use this policy."
                      value={value.allow_during_probation}
                      layoutId="policy-probation-choice"
                      onChange={(next) => onValueChange({ allow_during_probation: next })}
                    />
                    <BoolPair
                      label="Half day"
                      hint="Choose whether employees can request half a day."
                      value={value.allow_half_day}
                      layoutId="policy-halfday-choice"
                      trueLabel="Allowed"
                      falseLabel="Not allowed"
                      onChange={(next) => onValueChange({ allow_half_day: next })}
                    />
                    <BoolPair
                      label="Short leave"
                      hint="Choose whether employees can request a few hours instead of a full day."
                      value={value.allow_short_leave}
                      layoutId="policy-shortleave-choice"
                      trueLabel="Allowed"
                      falseLabel="Not allowed"
                      onChange={(next) => onValueChange({ allow_short_leave: next })}
                    />
                  </div>

                  <AnimatePresence initial={false}>
                    {value.allow_short_leave === "true" ? (
                      <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Min short leave (min)"
                            hint="The fewest minutes an employee can request."
                          >
                            <Input
                              type="number"
                              min={1}
                              value={value.minimum_short_leave_minutes}
                              onChange={(event) => onValueChange({ minimum_short_leave_minutes: event.target.value })}
                            />
                          </Field>
                          <Field
                            label="Max short leave (min)"
                            hint="The most minutes an employee can request as short leave."
                          >
                            <Input
                              type="number"
                              min={1}
                              value={value.maximum_short_leave_minutes}
                              onChange={(event) => onValueChange({ maximum_short_leave_minutes: event.target.value })}
                            />
                          </Field>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-primary transition hover:underline"
                    onClick={() => setShowAdvancedRules((current) => !current)}
                    aria-expanded={showAdvancedRules}
                  >
                    <ChevronDown className={cn("size-3.5 transition", showAdvancedRules ? "rotate-180" : "")} />
                    {showAdvancedRules ? "Hide extra rules" : "More rules"}
                    <span className="font-medium text-slate-400">notice, cancellation, attendance</span>
                  </button>

                  <AnimatePresence initial={false}>
                    {showAdvancedRules ? (
                      <motion.div
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <Field label="Service months" hint="How many months an employee must work before using this policy.">
                            <Input
                              type="number"
                              min={0}
                              value={value.min_service_months}
                              onChange={(event) => onValueChange({ min_service_months: event.target.value })}
                            />
                          </Field>
                          <Field label="Notice days" hint="How many days early an employee must request leave.">
                            <Input
                              type="number"
                              min={0}
                              value={value.minimum_notice_days}
                              onChange={(event) => onValueChange({ minimum_notice_days: event.target.value })}
                            />
                          </Field>
                          <Field label="Backdate days" hint="How many days in the past an employee can date a request.">
                            <Input
                              type="number"
                              min={0}
                              value={value.maximum_backdate_days}
                              onChange={(event) => onValueChange({ maximum_backdate_days: event.target.value })}
                            />
                          </Field>
                          <BoolPair
                            label="Negative balance"
                            hint="Choose whether employees can request leave when they have no days left."
                            value={value.allow_negative_balance}
                            layoutId="policy-negative-choice"
                            trueLabel="Allowed"
                            falseLabel="Not allowed"
                            onChange={(next) => onValueChange({ allow_negative_balance: next })}
                          />
                          <BoolPair
                            label="Cancel needs approval"
                            hint="Choose whether a manager or HR must approve a cancellation."
                            value={value.cancellation_requires_approval}
                            layoutId="policy-cancel-choice"
                            onChange={(next) => onValueChange({ cancellation_requires_approval: next })}
                          />
                          <Field label="Cancel cutoff days" hint="How many days before leave a cancellation still needs approval.">
                            <Input
                              type="number"
                              min={0}
                              value={value.cancellation_cutoff_days}
                              onChange={(event) => onValueChange({ cancellation_cutoff_days: event.target.value })}
                            />
                          </Field>
                          <Field label="Overall carry-over cap" hint="The total unused days an employee can keep. Enter 0 for no limit.">
                            <Input
                              type="number"
                              min={0}
                              value={value.maximum_accumulation_days}
                              onChange={(event) => onValueChange({ maximum_accumulation_days: event.target.value })}
                            />
                          </Field>
                          <ChoiceRow
                            label="Leave year"
                            hint="Calendar year (Jan–Dec), each employee's employment anniversary, or a custom start date. Existing calendar-year balances are not converted automatically."
                            value={value.leave_year_type}
                            layoutId="policy-leave-year"
                            options={[
                              ["calendar", "Calendar year"],
                              ["anniversary", "Employment anniversary"],
                              ["custom", "Custom start"],
                            ]}
                            onChange={(next) => onValueChange({ leave_year_type: next })}
                          />
                          {value.leave_year_type === "custom" ? (
                            <>
                              <Field label="Starts in month" hint="1–12">
                                <Input
                                  type="number"
                                  min={1}
                                  max={12}
                                  value={value.leave_year_start_month}
                                  onChange={(event) => onValueChange({ leave_year_start_month: event.target.value })}
                                />
                              </Field>
                              <Field label="Starts on day" hint="1–31 (clamped to the month's last day)">
                                <Input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={value.leave_year_start_day}
                                  onChange={(event) => onValueChange({ leave_year_start_day: event.target.value })}
                                />
                              </Field>
                            </>
                          ) : null}
                          <ChoiceRow
                            label="Year-end rollover"
                            hint="HR reviews and approves each rollover (recommended), or it posts automatically after the leave year ends."
                            value={value.rollover_execution_mode}
                            layoutId="policy-rollover-mode"
                            options={[
                              ["manual_approval", "HR approval"],
                              ["automatic", "Automatic"],
                            ]}
                            onChange={(next) => onValueChange({ rollover_execution_mode: next })}
                          />
                          <Field
                            label="Change takes effect"
                            hint="For a change to an approved policy: the new version applies from this date (blank = today). Earlier versions stay for history."
                          >
                            <DateInput
                              value={value.effective_from}
                              onChange={(event) => onValueChange({ effective_from: event.target.value })}
                            />
                          </Field>
                          <Field label="Reason for change" hint="Recorded in the policy history and audit log.">
                            <Input
                              type="text"
                              value={value.change_reason}
                              onChange={(event) => onValueChange({ change_reason: event.target.value })}
                            />
                          </Field>
                          <BoolPair
                            label="Save as draft version"
                            hint="Keep the change as a draft to review its impact before submitting it for approval."
                            value={value.save_as_draft}
                            layoutId="policy-save-draft"
                            trueLabel="Draft"
                            falseLabel="Submit"
                            onChange={(next) => onValueChange({ save_as_draft: next })}
                          />
                          <Field label="Priority" hint="If two policies apply, the one with the higher number is used.">
                            <Input
                              type="number"
                              value={value.priority}
                              onChange={(event) => onValueChange({ priority: event.target.value })}
                            />
                          </Field>
                          <BoolPair
                            label="Deduct from attendance"
                            hint="Turn this on to remove leave days when attendance shows an absence or unpaid leave."
                            value={value.attendance_balance_deduction_enabled}
                            layoutId="policy-attendance-choice"
                            onChange={(next) => onValueChange({ attendance_balance_deduction_enabled: next })}
                          />
                          {value.attendance_balance_deduction_enabled === "true" ? (
                            <>
                              <Field
                                label="Absent day"
                                hint="Days to remove for one full day marked absent. Usually 1."
                              >
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  value={value.absent_day_deduction_days}
                                  onChange={(event) => onValueChange({ absent_day_deduction_days: event.target.value })}
                                />
                              </Field>
                              <Field
                                label="Unpaid day"
                                hint="Days to remove for one unpaid leave day. Usually 1."
                              >
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  value={value.unpaid_leave_day_deduction_days}
                                  onChange={(event) =>
                                    onValueChange({ unpaid_leave_day_deduction_days: event.target.value })
                                  }
                                />
                              </Field>
                              <Field
                                label="Half-day deduction"
                                hint="Days to remove for a half-day absence. Usually 0.5."
                              >
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  value={value.half_day_deduction_days}
                                  onChange={(event) => onValueChange({ half_day_deduction_days: event.target.value })}
                                />
                              </Field>
                            </>
                          ) : null}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SheetFooter className="mt-0 shrink-0 flex-col gap-3 border-t border-border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:bg-background">
          <p
            className={cn(
              "text-xs",
              stage === "basics"
                ? hasName
                  ? "text-emerald-700"
                  : "text-amber-700"
                : stage === "entitlements"
                  ? canLeavePolicyStage
                  ? "text-emerald-700"
                  : "text-amber-700"
                : "text-emerald-700",
            )}
          >
            {readinessMessage}
          </p>
          <div className="flex flex-wrap gap-2">
            {stage !== "basics" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
                onClick={() =>
                  setStage(stage === "rules" ? "who" : stage === "who" ? "entitlements" : "basics")
                }
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            {stage === "basics" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasName}
                onClick={() => setStage("entitlements")}
              >
                Next
              </button>
            ) : stage === "entitlements" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canLeavePolicyStage}
                onClick={() => setStage("who")}
              >
                Next
              </button>
            ) : stage === "who" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95"
                onClick={() => setStage("rules")}
              >
                {narrowCoverage ? "Next" : "Skip to day rules"}
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !canSubmit || !canLeavePolicyStage}
                onClick={() => void onSubmit()}
              >
                {saving ? "Saving…" : mode === "create" ? "Create policy" : "Save changes"}
              </button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
