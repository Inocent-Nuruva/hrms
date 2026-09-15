"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, Info, Plus, Trash2, Users } from "lucide-react"

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type LeavePolicyTypeAssignment = {
  leave_type_id: string
  annual_quota_days: string
  max_per_request_days: string
  requires_approval: string
  encashment_enabled: string
  maximum_encashment_days: string
  minimum_balance_after_encashment: string
  encashment_requires_approval: string
  maximum_accumulation_days: string
}

export type LeavePolicyFormValue = {
  name: string
  description: string
  status: string
  accrual_method: string
  accrual_rate: string
  priority: string
  applicable_branch_id: string
  applicable_department_id: string
  applicable_position_id: string
  applicable_grade_id: string
  applicable_employment_type: string
  applicable_confirmation_status: string
  max_consecutive_days: string
  min_service_months: string
  allow_during_probation: string
  allow_negative_balance: string
  weekly_off_treatment: string
  holiday_treatment: string
  allow_half_day: string
  allow_short_leave: string
  minimum_short_leave_minutes: string
  maximum_short_leave_minutes: string
  minimum_notice_days: string
  maximum_backdate_days: string
  cancellation_requires_approval: string
  cancellation_cutoff_days: string
  maximum_accumulation_days: string
  attendance_balance_deduction_enabled: string
  absent_day_deduction_days: string
  unpaid_leave_day_deduction_days: string
  half_day_deduction_days: string
  leave_types: LeavePolicyTypeAssignment[]
}

export function emptyLeavePolicyTypeAssignment(): LeavePolicyTypeAssignment {
  return {
    leave_type_id: "",
    annual_quota_days: "0",
    max_per_request_days: "0",
    requires_approval: "true",
    encashment_enabled: "false",
    maximum_encashment_days: "0",
    minimum_balance_after_encashment: "0",
    encashment_requires_approval: "true",
    maximum_accumulation_days: "0",
  }
}

export function emptyLeavePolicyForm(): LeavePolicyFormValue {
  return {
    name: "",
    description: "",
    status: "active",
    accrual_method: "yearly",
    accrual_rate: "0",
    priority: "0",
    applicable_branch_id: "",
    applicable_department_id: "",
    applicable_position_id: "",
    applicable_grade_id: "",
    applicable_employment_type: "",
    applicable_confirmation_status: "",
    max_consecutive_days: "1",
    min_service_months: "0",
    allow_during_probation: "true",
    allow_negative_balance: "false",
    weekly_off_treatment: "EMPLOYEE_SCHEDULE",
    holiday_treatment: "EXCLUDE",
    allow_half_day: "false",
    allow_short_leave: "false",
    minimum_short_leave_minutes: "30",
    maximum_short_leave_minutes: "240",
    minimum_notice_days: "0",
    maximum_backdate_days: "0",
    cancellation_requires_approval: "false",
    cancellation_cutoff_days: "0",
    maximum_accumulation_days: "0",
    attendance_balance_deduction_enabled: "false",
    absent_day_deduction_days: "1",
    unpaid_leave_day_deduction_days: "1",
    half_day_deduction_days: "0.5",
    leave_types: [emptyLeavePolicyTypeAssignment()],
  }
}

type LeavePolicyEditorSheetProps = {
  open: boolean
  mode: "create" | "edit"
  value: LeavePolicyFormValue
  leaveTypeOptions: WorkflowOption[]
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

const EMPLOYMENT_TYPE_OPTIONS: WorkflowOption[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "temporary", label: "Temporary" },
]

const CONFIRMATION_OPTIONS: WorkflowOption[] = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROBATION", label: "Probation" },
  { value: "CONFIRMATION_DUE", label: "Confirmation due" },
  { value: "PROBATION_EXTENDED", label: "Probation extended" },
  { value: "NOT_CONFIRMED", label: "Not confirmed" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
]

const DAY_TREATMENT_OPTIONS: WorkflowOption[] = [
  { value: "EMPLOYEE_SCHEDULE", label: "Follow schedule" },
  { value: "EXCLUDE", label: "Exclude" },
  { value: "INCLUDE", label: "Include" },
]

function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex size-4 items-center justify-center rounded-full text-slate-400 transition hover:text-primary"
            aria-label={text}
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-64 text-left text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
      {label}
      {hint ? <HintIcon text={hint} /> : null}
    </span>
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

const inputClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-white"

type PolicyStage = "policy" | "who" | "rules"

const STAGES: Array<{ key: PolicyStage; number: string; label: string }> = [
  { key: "policy", number: "01", label: "Policy & types" },
  { key: "who", number: "02", label: "Who it covers" },
  { key: "rules", number: "03", label: "Day rules" },
]

function optionLabel(options: WorkflowOption[], value: string, fallback: string) {
  if (!value) return fallback
  return options.find((option) => option.value === value)?.label ?? fallback
}

function hasCoverageLimits(value: LeavePolicyFormValue) {
  return Boolean(
    value.applicable_branch_id ||
      value.applicable_department_id ||
      value.applicable_position_id ||
      value.applicable_grade_id ||
      value.applicable_employment_type ||
      value.applicable_confirmation_status,
  )
}

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
  const [stage, setStage] = React.useState<PolicyStage>("policy")
  const [narrowCoverage, setNarrowCoverage] = React.useState(false)
  const [showAdvancedRules, setShowAdvancedRules] = React.useState(false)
  const [openTypeIndex, setOpenTypeIndex] = React.useState<number | null>(0)
  const wasOpen = React.useRef(false)

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setStage("policy")
      setNarrowCoverage(hasCoverageLimits(value))
      setShowAdvancedRules(false)
      setOpenTypeIndex(0)
    }
    wasOpen.current = open
  }, [open, value])

  const attachedTypes = value.leave_types.filter((row) => row.leave_type_id)
  const usedTypeIds = new Set(attachedTypes.map((row) => row.leave_type_id))
  const remainingTypes = leaveTypeOptions.filter((option) => !usedTypeIds.has(option.value))
  const hasName = Boolean(value.name.trim())
  const hasTypes = attachedTypes.length > 0
  const canLeavePolicyStage = hasName && hasTypes
  const isEdit = mode === "edit"
  const coverageParts = [
    optionLabel(branchOptions, value.applicable_branch_id, ""),
    optionLabel(departmentOptions, value.applicable_department_id, ""),
    optionLabel(positionOptions, value.applicable_position_id, ""),
    optionLabel(gradeOptions, value.applicable_grade_id, ""),
    optionLabel(EMPLOYMENT_TYPE_OPTIONS, value.applicable_employment_type, ""),
    optionLabel(CONFIRMATION_OPTIONS, value.applicable_confirmation_status, ""),
  ].filter(Boolean)
  const coverageSummary = coverageParts.length ? coverageParts.join(" · ") : "Everyone"
  const typeSummary =
    attachedTypes.length === 0
      ? "No leave types yet"
      : attachedTypes
          .map((row) => {
            const label = leaveTypeOptions.find((option) => option.value === row.leave_type_id)?.label ?? "Leave type"
            return `${label} ${row.annual_quota_days || "0"}d`
          })
          .join(" · ")

  const stageUnlocked: Record<PolicyStage, boolean> = {
    policy: true,
    who: canLeavePolicyStage || isEdit,
    rules: canLeavePolicyStage || isEdit,
  }

  const readinessMessage =
    stage === "policy"
      ? !hasName
        ? "Name the policy to continue."
        : !hasTypes
          ? "Tap a leave type to attach it."
          : "Continue to who this policy covers."
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

  const attachLeaveType = (leaveTypeId: string) => {
    const emptyIndex = value.leave_types.findIndex((row) => !row.leave_type_id)
    if (emptyIndex >= 0) {
      updateAssignment(emptyIndex, { leave_type_id: leaveTypeId })
      setOpenTypeIndex(emptyIndex)
      return
    }
    onValueChange({
      leave_types: [...value.leave_types, { ...emptyLeavePolicyTypeAssignment(), leave_type_id: leaveTypeId }],
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
        <header className="shrink-0 border-b border-border px-4 py-3 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {mode === "create" ? "Create leave policy" : "Edit leave policy"}
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-slate-500">
                {stage === "policy"
                  ? "Name it, then tap the leave types this policy should carry."
                  : stage === "who"
                    ? "Keep it company-wide, or limit it to a group."
                    : "Set how days are counted. Extra rules stay folded away."}
              </SheetDescription>
            </div>
            <nav className="flex items-center gap-1" aria-label="Policy steps">
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
                      className={cn(
                        "relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition",
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
                      <span className="hidden sm:inline">{item.label}</span>
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
            {stage === "policy" ? (
              <motion.div
                key="policy-stage"
                className="flex h-full min-h-0 justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-10"
                {...stageMotion("forward")}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-full max-w-2xl space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Policy name" hint="The name HR will see in the policy list. Keep it specific, e.g. Staff annual rules.">
                      <input
                        autoFocus
                        className={inputClass}
                        placeholder="e.g. Staff leave rules"
                        value={value.name}
                        onChange={(event) => onValueChange({ name: event.target.value })}
                      />
                    </Field>
                    <div className="min-w-0">
                      <FieldLabel label="Status" hint="Active policies can be used. Inactive stays unused." />
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
                    <div className="min-w-0 sm:col-span-2">
                      <FieldLabel label="Accrual" hint="How often days are added. Manual means HR adds them." />
                      <div className="mt-1 grid grid-cols-3 gap-1.5">
                        {[
                          ["yearly", "Yearly"],
                          ["monthly", "Monthly"],
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
                    {value.accrual_method !== "manual" ? (
                      <Field label="Days each period" hint="Days added each accrual period.">
                        <input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={value.accrual_rate}
                          onChange={(event) => onValueChange({ accrual_rate: event.target.value })}
                        />
                      </Field>
                    ) : null}
                    <Field label="Notes" hint="Optional notes for HR about this policy.">
                      <input
                        className={inputClass}
                        placeholder="Optional"
                        value={value.description}
                        onChange={(event) => onValueChange({ description: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel
                        label="Leave types on this policy"
                        hint="Tap a type to attach it. Set the yearly quota on the row. Open a row for encashment and caps."
                      />
                      <span className="text-[11px] font-medium text-primary">
                        {attachedTypes.length} attached
                      </span>
                    </div>

                    {attachedTypes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">No types yet</p>
                        <p className="mt-1 text-xs text-slate-500">Tap a leave type below to put it on this policy.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {value.leave_types.map((assignment, index) => {
                          if (!assignment.leave_type_id) return null
                          const typeName =
                            leaveTypeOptions.find((option) => option.value === assignment.leave_type_id)?.label ??
                            "Leave type"
                          const expanded = openTypeIndex === index
                          return (
                            <div
                              key={`policy-type-${assignment.leave_type_id}-${index}`}
                              className={cn(
                                "overflow-hidden rounded-lg border transition",
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
                                  <p className="text-[11px] text-slate-500">
                                    {assignment.requires_approval === "true" ? "Approval required" : "No approval"}
                                    {assignment.encashment_enabled === "true" ? " · Encashment on" : ""}
                                  </p>
                                </button>
                                <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                  <input
                                    type="number"
                                    min={0}
                                    className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-xs font-semibold text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    value={assignment.annual_quota_days}
                                    onChange={(event) =>
                                      updateAssignment(index, { annual_quota_days: event.target.value })
                                    }
                                    aria-label={`${typeName} annual quota`}
                                  />
                                  <span className="inline-flex items-center gap-1">
                                    days / year
                                    <HintIcon text="Yearly quota for this leave type under this policy. This is the balance employees start with each year." />
                                  </span>
                                </label>
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    className={cn(
                                      "inline-flex h-7 items-center rounded-full px-2 text-[11px] font-semibold transition",
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
                                  <HintIcon text="On means requests of this type wait for a manager or HR. Off submits without that step." />
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                  onClick={() => setOpenTypeIndex(expanded ? null : index)}
                                  aria-expanded={expanded}
                                  aria-label={expanded ? "Hide extra type rules" : "Show extra type rules"}
                                >
                                  <ChevronDown className={cn("size-4 transition", expanded ? "rotate-180" : "")} />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex size-7 items-center justify-center rounded-md text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                                  onClick={() => removeLeaveType(index)}
                                  aria-label={`Remove ${typeName}`}
                                >
                                  <Trash2 className="size-3.5" />
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
                                        hint="Most days an employee can ask for in one request of this type. 0 means no extra cap beyond the yearly quota."
                                      >
                                        <input
                                          type="number"
                                          min={0}
                                          className={inputClass}
                                          value={assignment.max_per_request_days}
                                          onChange={(event) =>
                                            updateAssignment(index, { max_per_request_days: event.target.value })
                                          }
                                        />
                                      </Field>
                                      <Field
                                        label="Type accumulation cap"
                                        hint="Most unused days of this type that can carry into the next period. 0 means this type has no extra carry-over cap."
                                      >
                                        <input
                                          type="number"
                                          min={0}
                                          className={inputClass}
                                          value={assignment.maximum_accumulation_days}
                                          onChange={(event) =>
                                            updateAssignment(index, { maximum_accumulation_days: event.target.value })
                                          }
                                        />
                                      </Field>
                                      <BoolPair
                                        label="Encashment"
                                        hint="Allowed lets employees convert unused days of this type into pay. Not allowed keeps them as leave days only."
                                        value={assignment.encashment_enabled}
                                        layoutId={`policy-type-encash-${index}`}
                                        trueLabel="Allowed"
                                        falseLabel="Not allowed"
                                        onChange={(next) => updateAssignment(index, { encashment_enabled: next })}
                                      />
                                      {assignment.encashment_enabled === "true" ? (
                                        <>
                                          <Field
                                            label="Max encashment days"
                                            hint="Most days of this type that can be cashed in at once."
                                          >
                                            <input
                                              type="number"
                                              min={0}
                                              className={inputClass}
                                              value={assignment.maximum_encashment_days}
                                              onChange={(event) =>
                                                updateAssignment(index, { maximum_encashment_days: event.target.value })
                                              }
                                            />
                                          </Field>
                                          <Field
                                            label="Min balance after"
                                            hint="Days that must remain after encashment so the employee is not left with nothing."
                                          >
                                            <input
                                              type="number"
                                              min={0}
                                              className={inputClass}
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
                                            hint="Required means a manager or HR must approve the cash-out. Not required pays it without a review step."
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
                        <span className="text-[11px] font-medium text-slate-400">Add</span>
                        {remainingTypes.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-primary hover:bg-primary/5 hover:text-primary"
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
                  </div>
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
                                hint="Leave on All branches unless this policy is only for one site."
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
                                hint="Leave on All departments unless this policy is only for one team."
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
                                hint="Leave on All positions unless this policy is only for one job title."
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
                                hint="Leave on All grades unless this policy is only for one pay grade."
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
                                hint="Leave on All types unless this policy is only for full time, contract, intern, or similar."
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
                                hint="Leave on All statuses unless this policy is only for confirmed or probation staff."
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
                    <Field label="Longest stretch" hint="Longest continuous leave this policy allows.">
                      <input
                        type="number"
                        min={1}
                        className={inputClass}
                        value={value.max_consecutive_days}
                        onChange={(event) => onValueChange({ max_consecutive_days: event.target.value })}
                      />
                    </Field>
                    <div className="min-w-0">
                      <div className="mb-1">
                        <FieldLabel label="Weekly offs" hint="Whether weekly offs count as leave days." />
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
                        <FieldLabel label="Holidays" hint="Whether public holidays count as leave days." />
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
                      hint="Can employees on probation use this policy?"
                      value={value.allow_during_probation}
                      layoutId="policy-probation-choice"
                      onChange={(next) => onValueChange({ allow_during_probation: next })}
                    />
                    <BoolPair
                      label="Half day"
                      hint="Allowed lets employees request a morning or afternoon instead of a full day."
                      value={value.allow_half_day}
                      layoutId="policy-halfday-choice"
                      trueLabel="Allowed"
                      falseLabel="Not allowed"
                      onChange={(next) => onValueChange({ allow_half_day: next })}
                    />
                    <BoolPair
                      label="Short leave"
                      hint="Allowed lets employees step out for a few hours without taking a full day."
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
                            hint="Shortest short-leave window, in minutes. Requests shorter than this are rejected."
                          >
                            <input
                              type="number"
                              min={1}
                              className={inputClass}
                              value={value.minimum_short_leave_minutes}
                              onChange={(event) => onValueChange({ minimum_short_leave_minutes: event.target.value })}
                            />
                          </Field>
                          <Field
                            label="Max short leave (min)"
                            hint="Longest short-leave window, in minutes. Longer absences should be a half day or full day."
                          >
                            <input
                              type="number"
                              min={1}
                              className={inputClass}
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
                          <Field label="Service months" hint="Minimum months in service before eligibility.">
                            <input
                              type="number"
                              min={0}
                              className={inputClass}
                              value={value.min_service_months}
                              onChange={(event) => onValueChange({ min_service_months: event.target.value })}
                            />
                          </Field>
                          <Field label="Notice days" hint="Minimum days of notice before leave starts.">
                            <input
                              type="number"
                              min={0}
                              className={inputClass}
                              value={value.minimum_notice_days}
                              onChange={(event) => onValueChange({ minimum_notice_days: event.target.value })}
                            />
                          </Field>
                          <Field label="Backdate days" hint="How far back a request may be dated.">
                            <input
                              type="number"
                              min={0}
                              className={inputClass}
                              value={value.maximum_backdate_days}
                              onChange={(event) => onValueChange({ maximum_backdate_days: event.target.value })}
                            />
                          </Field>
                          <BoolPair
                            label="Negative balance"
                            hint="Can employees request more days than they currently have?"
                            value={value.allow_negative_balance}
                            layoutId="policy-negative-choice"
                            trueLabel="Allowed"
                            falseLabel="Not allowed"
                            onChange={(next) => onValueChange({ allow_negative_balance: next })}
                          />
                          <BoolPair
                            label="Cancel needs approval"
                            hint="Yes means cancelling an already-approved request must be reviewed again."
                            value={value.cancellation_requires_approval}
                            layoutId="policy-cancel-choice"
                            onChange={(next) => onValueChange({ cancellation_requires_approval: next })}
                          />
                          <Field label="Cancel cutoff days" hint="Days before leave when cancellation still needs a check.">
                            <input
                              type="number"
                              min={0}
                              className={inputClass}
                              value={value.cancellation_cutoff_days}
                              onChange={(event) => onValueChange({ cancellation_cutoff_days: event.target.value })}
                            />
                          </Field>
                          <Field label="Max accumulation" hint="Cap on unused days that can be carried.">
                            <input
                              type="number"
                              min={0}
                              className={inputClass}
                              value={value.maximum_accumulation_days}
                              onChange={(event) => onValueChange({ maximum_accumulation_days: event.target.value })}
                            />
                          </Field>
                          <Field label="Priority" hint="Higher numbers win when more than one policy could apply.">
                            <input
                              type="number"
                              className={inputClass}
                              value={value.priority}
                              onChange={(event) => onValueChange({ priority: event.target.value })}
                            />
                          </Field>
                          <BoolPair
                            label="Deduct from attendance"
                            hint="Yes takes days off the leave balance when attendance marks someone absent or on unpaid leave."
                            value={value.attendance_balance_deduction_enabled}
                            layoutId="policy-attendance-choice"
                            onChange={(next) => onValueChange({ attendance_balance_deduction_enabled: next })}
                          />
                          {value.attendance_balance_deduction_enabled === "true" ? (
                            <>
                              <Field
                                label="Absent day"
                                hint="Leave days to deduct for one unmarked absent day. Use 1 for a full day."
                              >
                                <input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  className={inputClass}
                                  value={value.absent_day_deduction_days}
                                  onChange={(event) => onValueChange({ absent_day_deduction_days: event.target.value })}
                                />
                              </Field>
                              <Field
                                label="Unpaid day"
                                hint="Leave days to deduct for one unpaid leave day on the attendance record."
                              >
                                <input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  className={inputClass}
                                  value={value.unpaid_leave_day_deduction_days}
                                  onChange={(event) =>
                                    onValueChange({ unpaid_leave_day_deduction_days: event.target.value })
                                  }
                                />
                              </Field>
                              <Field
                                label="Half-day deduction"
                                hint="Leave days to deduct for a half-day attendance exception. 0.5 is a typical value."
                              >
                                <input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  className={inputClass}
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
              stage === "policy"
                ? canLeavePolicyStage
                  ? "text-emerald-700"
                  : "text-amber-700"
                : "text-emerald-700",
            )}
          >
            {readinessMessage}
          </p>
          <div className="flex flex-wrap gap-2">
            {stage !== "policy" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
                onClick={() => setStage(stage === "rules" ? "who" : "policy")}
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
            {stage === "policy" ? (
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
