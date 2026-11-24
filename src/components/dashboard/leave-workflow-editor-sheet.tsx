"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Building2,
  Check,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import {
  WorkflowChoiceCard,
  WorkflowSectionHeading,
  WorkflowSelect,
} from "@/components/dashboard/leave-workflow-ui"
import { useDashboardMotion } from "@/lib/dashboard-motion"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export type LeaveWorkflowFormValue = {
  name: string
  leave_type_id: string
  status: string
  is_default: string
  /** "" = off */
  reminder_after_days: string
  /** "" = off */
  escalate_after_days: string
  /** "" = default (1) */
  max_escalations?: string
}

export type LeaveWorkflowEditorStep = {
  key: string
  level: string
  action: string
  approverType: string
  approverLabel: string
  branchLabel: string
  departmentLabel: string
  isRequired: boolean
}

type WorkflowOption = {
  value: string
  label: string
}

type LeaveWorkflowEditorSheetProps = {
  open: boolean
  mode: "create" | "edit"
  value: LeaveWorkflowFormValue
  leaveTypeOptions: WorkflowOption[]
  steps: LeaveWorkflowEditorStep[]
  saving: boolean
  canSubmit: boolean
  canManageSteps: boolean
  canDeleteSteps: boolean
  onOpenChange: (open: boolean) => void
  onValueChange: (patch: Partial<LeaveWorkflowFormValue>) => void
  onAddStep: () => void
  onEditStep: (index: number) => void
  onDeleteStep: (index: number) => void
  onSubmit: () => void | Promise<void>
  startStage?: "details" | "path"
  onSaveDraft?: (stage: "details" | "path") => void
  onDiscard?: () => void
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim()
}

function ApprovalPath({
  steps,
  saving,
  canManageSteps,
  canDeleteSteps,
  onAddStep,
  onEditStep,
  onDeleteStep,
}: {
  steps: LeaveWorkflowEditorStep[]
  saving: boolean
  canManageSteps: boolean
  canDeleteSteps: boolean
  onAddStep: () => void
  onEditStep: (index: number) => void
  onDeleteStep: (index: number) => void
}) {
  const { reduce } = useDashboardMotion()
  const ordered = React.useMemo(
    () => [...steps].sort((a, b) => Number(a.level) - Number(b.level) || a.key.localeCompare(b.key)),
    [steps],
  )
  const [activeKey, setActiveKey] = React.useState(ordered[0]?.key ?? "")

  React.useEffect(() => {
    if (!ordered.some((step) => step.key === activeKey)) {
      setActiveKey(ordered[0]?.key ?? "")
    }
  }, [activeKey, ordered])

  if (ordered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">No steps yet</p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Add the first step, choose what it does, and assign who handles it.
        </p>
        <button
          type="button"
          className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
          disabled={saving || !canManageSteps}
          onClick={onAddStep}
        >
          <Plus className="size-3.5" />
          Add workflow step
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-3">
        {ordered.map((step, index) => {
          const selected = step.key === activeKey
          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                onClick={() => setActiveKey(step.key)}
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                  selected ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                )}
                aria-label={`Show level ${step.level}`}
              >
                {selected ? (
                  <motion.span
                    layoutId="workflow-path-node"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative z-10">{step.level}</span>
              </button>
              {index < ordered.length - 1 ? (
                <div className="relative h-0.5 w-8 shrink-0 overflow-hidden rounded-full bg-slate-200">
                  <motion.span
                    className="absolute inset-y-0 w-1/2 rounded-full bg-primary"
                    animate={reduce ? undefined : { x: ["-120%", "220%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.12 }}
                  />
                </div>
              ) : null}
            </React.Fragment>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="relative">
          {ordered.map((step, index) => {
            const last = index === ordered.length - 1
            const selected = step.key === activeKey
            const originalIndex = steps.findIndex((item) => item.key === step.key)
            return (
              <motion.article
                key={step.key}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.22 }}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div className="flex w-7 shrink-0 flex-col items-center self-stretch">
                  <button
                    type="button"
                    onClick={() => setActiveKey(step.key)}
                    className={cn(
                      "relative z-10 flex size-7 items-center justify-center rounded-full text-[11px] font-bold",
                      selected ? "bg-primary text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {step.level}
                  </button>
                  {last ? null : (
                    <div className="relative mt-1 min-h-6 w-px flex-1 overflow-hidden bg-slate-200">
                      <motion.span
                        className="absolute inset-x-0 top-0 bg-primary"
                        initial={reduce ? { height: "100%" } : { height: 0 }}
                        animate={{ height: "100%" }}
                        transition={{ delay: 0.08 + index * 0.06, duration: 0.32 }}
                        style={{ width: 1 }}
                      />
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border px-3 py-2 transition",
                    selected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActiveKey(step.key)}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{titleCase(step.action)}</p>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            step.isRequired ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {step.isRequired ? "Required" : "Optional"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs">
                        <span className="font-semibold text-primary">{step.approverLabel}</span>
                        <span className="text-slate-400"> · </span>
                        <span className="font-medium text-primary">{titleCase(step.approverType)}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        <Building2 className="mr-1 inline size-3" />
                        {step.branchLabel} · {step.departmentLabel}
                      </p>
                    </button>
                    {canManageSteps || canDeleteSteps ? (
                      <div className="flex shrink-0 items-center">
                        {canManageSteps ? (
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-slate-800"
                            onClick={() => onEditStep(originalIndex)}
                            aria-label={`Edit workflow step ${index + 1}`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        {canDeleteSteps ? (
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-md text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => onDeleteStep(originalIndex)}
                            aria-label={`Delete workflow step ${index + 1}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function LeaveWorkflowEditorSheet({
  open,
  mode,
  value,
  leaveTypeOptions,
  steps,
  saving,
  canSubmit,
  canManageSteps,
  canDeleteSteps,
  onOpenChange,
  onValueChange,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onSubmit,
  startStage = "details",
  onSaveDraft,
  onDiscard,
}: LeaveWorkflowEditorSheetProps) {
  const { reduce } = useDashboardMotion()
  const [stage, setStage] = React.useState<"details" | "path">(mode === "create" ? startStage : "path")
  const [leavePromptOpen, setLeavePromptOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setLeavePromptOpen(false)
      return
    }
    setStage(mode === "create" ? startStage : "path")
  }, [mode, open, startStage])

  const hasName = Boolean(value.name.trim())
  const hasLeaveType = Boolean(value.leave_type_id)
  const hasSteps = steps.length > 0
  const hasScope = hasLeaveType || value.is_default === "true"
  const isReady = hasName && hasScope && hasSteps
  const isDirty =
    hasName ||
    hasLeaveType ||
    hasSteps ||
    value.status !== "active" ||
    value.is_default === "true" ||
    stage === "path"
  const canGoNext = hasName && hasScope
  const selectedLeaveType =
    leaveTypeOptions.find((option) => option.value === value.leave_type_id)?.label ?? (value.is_default === "true" ? "All leave types" : "No leave type selected")

  const readinessMessage = !hasName
    ? "Add a workflow name to continue."
    : !hasScope
      ? "Choose the leave type this workflow will handle."
      : stage === "details"
        ? "Continue to the approval path."
        : !hasSteps
          ? "Add at least one approval step."
          : "Ready to save."

  const closeSheet = () => {
    setLeavePromptOpen(false)
    onOpenChange(false)
  }

  const requestClose = () => {
    if (mode === "create" && isDirty) {
      setLeavePromptOpen(true)
      return
    }
    closeSheet()
  }

  const detailsForm = (
    <div className="w-full min-w-0 space-y-4">
      <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>Workflow name</span>
        <input
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-white"
          placeholder="e.g. Annual leave approval"
          value={value.name}
          onChange={(event) => onValueChange({ name: event.target.value })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Remind approvers after (days)</span>
          <input
            type="number"
            min={1}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-white"
            placeholder="Off"
            value={value.reminder_after_days}
            onChange={(event) => onValueChange({ reminder_after_days: event.target.value })}
          />
          <span className="text-xs font-normal text-slate-500">Repeats every N days while a step is waiting.</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          <span>Escalate after (days)</span>
          <input
            type="number"
            min={1}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-white"
            placeholder="Off"
            value={value.escalate_after_days}
            onChange={(event) => onValueChange({ escalate_after_days: event.target.value })}
          />
          <span className="text-xs font-normal text-slate-500">Adds the waiting approver&apos;s manager (or HR), and again every N days.</span>
        </label>
        {value.escalate_after_days ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>Maximum escalations per step</span>
            <input
              type="number"
              min={1}
              max={5}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-white"
              placeholder="1"
              value={value.max_escalations ?? ""}
              onChange={(event) => onValueChange({ max_escalations: event.target.value })}
            />
            <span className="text-xs font-normal text-slate-500">Each escalation goes one level up. After the last one, HR is told once that the request is overdue.</span>
          </label>
        ) : null}
      </div>

      <div className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>Leave type</span>
        <WorkflowSelect
          value={value.leave_type_id}
          options={leaveTypeOptions}
          allLabel={value.is_default === "true" ? "All leave types" : undefined}
          placeholder="Select leave type"
          onValueChange={(next) => onValueChange({ leave_type_id: next })}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ["active", "Active", "Ready for use"],
            ["inactive", "Inactive", "Keep as draft"],
          ].map(([optionValue, label, description]) => {
            const active = value.status === optionValue
            return (
              <WorkflowChoiceCard
                key={optionValue}
                active={active}
                layoutId="workflow-status-choice"
                onClick={() => onValueChange({ status: optionValue })}
              >
                <span className={cn("block text-xs font-semibold", active ? "text-white" : "text-slate-900 dark:text-white")}>
                  {label}
                </span>
                <span className={cn("mt-0.5 block text-[11px]", active ? "text-white/80" : "text-slate-500")}>
                  {description}
                </span>
              </WorkflowChoiceCard>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Routing</p>
        <div className="mt-2 grid gap-2">
          {[
            ["false", "Specific", "Only for the selected leave type."],
            ["true", "Default", "Fallback when no specific workflow matches."],
          ].map(([optionValue, label, description]) => {
            const active = value.is_default === optionValue
            return (
              <WorkflowChoiceCard
                key={optionValue}
                active={active}
                layoutId="workflow-routing-choice"
                onClick={() => onValueChange({ is_default: optionValue })}
                className="flex items-start gap-2.5"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-white bg-white text-primary" : "border-slate-300 text-transparent",
                  )}
                >
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                <span>
                  <span className={cn("block text-sm font-semibold", active ? "text-white" : "text-slate-900 dark:text-white")}>
                    {label}
                  </span>
                  <span className={cn("mt-0.5 block text-xs leading-4", active ? "text-white/80" : "text-slate-500")}>
                    {description}
                  </span>
                </span>
              </WorkflowChoiceCard>
            )
          })}
        </div>
      </div>

      <p className="min-w-0 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
        Route: <span className="font-semibold text-primary">{selectedLeaveType}</span>
        {" · "}
        <span className="font-semibold text-primary">
          {value.is_default === "true" ? "Default fallback" : "Specific workflow"}
        </span>
      </p>
    </div>
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          requestClose()
          return
        }
        onOpenChange(true)
      }}
    >
      <SheetContent
        side="right"
        className="relative inset-0 h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none data-[side=right]:inset-0 data-[side=right]:left-0 data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:border-0 data-[side=right]:sm:max-w-none data-[side=right]:data-starting-style:translate-x-0 data-[side=right]:data-ending-style:translate-x-0"
      >
        <header className="shrink-0 border-b border-border px-4 py-3 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              {mode === "create" ? "Create leave workflow" : "Edit leave workflow"}
            </SheetTitle>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                value.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {value.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
          <SheetDescription className="mt-1 text-sm text-slate-500">
            {stage === "details"
              ? "Start with the name, leave type, status, and routing."
              : "Exactly two required levels: 1 uses DEPARTMENT_MANAGER (the employee’s own department manager, without filters); 2 selects the HR approver."}
          </SheetDescription>
        </header>

        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {stage === "details" ? (
              <motion.div
                key="details-stage"
                className="flex h-full min-h-0 min-w-0 items-start justify-center overflow-y-auto px-4 py-4 sm:items-center sm:px-6 sm:py-8"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -48 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-full min-w-0 max-w-lg">
                  <WorkflowSectionHeading
                    number="01"
                    title="Details"
                    description="Name the workflow and choose exactly when it should be used."
                  />
                  <div className="mt-5 pl-0 sm:pl-7">{detailsForm}</div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="path-stage"
                className="grid h-full min-h-0 min-w-0 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]"
                initial={reduce ? { opacity: 1 } : { opacity: 0, x: 56 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 56 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <section className="min-w-0 space-y-4 overflow-x-hidden overflow-y-auto border-b border-border px-4 py-4 sm:px-6 lg:border-r lg:border-b-0">
                  <WorkflowSectionHeading
                    number="01"
                    title="Details"
                    description="You can still change these while you build the path."
                  />
                  <div className="pl-0 sm:pl-7">{detailsForm}</div>
                </section>
                <section className="flex min-h-[24rem] min-w-0 flex-col">
                  <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <WorkflowSectionHeading
                      number="02"
                      title="Approval path"
                      description="Steps run from the lowest approval level to the highest. Click a level to follow the order."
                    />
                    <button
                      type="button"
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={saving || !canManageSteps}
                      onClick={onAddStep}
                    >
                      <Plus className="size-3.5" />
                      Add workflow step
                    </button>
                  </div>
                  <ApprovalPath
                    steps={steps}
                    saving={saving}
                    canManageSteps={canManageSteps}
                    canDeleteSteps={canDeleteSteps}
                    onAddStep={onAddStep}
                    onEditStep={onEditStep}
                    onDeleteStep={onDeleteStep}
                  />
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SheetFooter className="mt-0 w-full min-w-0 shrink-0 flex-col gap-3 border-t border-border bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 dark:bg-background">
          <p className={cn("min-w-0 whitespace-normal text-xs leading-5 sm:flex-1", stage === "details" ? (canGoNext ? "text-emerald-700" : "text-amber-700") : isReady ? "text-emerald-700" : "text-amber-700")}>
            {readinessMessage}
          </p>
          <div className="flex w-full min-w-0 flex-wrap justify-end gap-2 sm:w-auto sm:shrink-0">
            {stage === "path" ? (
              <button
                type="button"
                className="inline-flex h-9 max-w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
                onClick={() => setStage("details")}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
              onClick={requestClose}
            >
              Cancel
            </button>
            {stage === "details" ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canGoNext}
                onClick={() => setStage("path")}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !canSubmit || !isReady}
                onClick={() => void onSubmit()}
              >
                {saving ? "Saving…" : mode === "create" ? "Create workflow" : "Save workflow"}
              </button>
            )}
          </div>
        </SheetFooter>

        {leavePromptOpen ? (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-xl dark:bg-background">
              <p className="text-base font-semibold text-slate-900 dark:text-white">Save this as a draft?</p>
              <p className="mt-1 text-sm text-slate-500">
                You can continue later from where you left off, or clear everything and start again.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  onClick={() => setLeavePromptOpen(false)}
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  onClick={() => {
                    onDiscard?.()
                    closeSheet()
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95"
                  onClick={() => {
                    onSaveDraft?.(stage)
                    closeSheet()
                  }}
                >
                  Save draft
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
