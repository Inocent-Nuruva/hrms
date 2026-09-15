"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ListChecks,
  MessageSquareText,
  Minus,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  WorkflowChoiceCard,
  WorkflowSectionHeading,
  WorkflowSelect,
  type WorkflowOption,
} from "@/components/dashboard/leave-workflow-ui"
import { cn } from "@/lib/utils"

export type LeaveWorkflowStepFormValue = {
  approval_level: string
  approver_type: string
  action_type: string
  role_id: string
  position_id: string
  company_user_id: string
  assigned_branch_id: string
  assigned_department_id: string
  is_required: string
}

type LeaveWorkflowStepDialogProps = {
  open: boolean
  mode: "create" | "edit"
  value: LeaveWorkflowStepFormValue
  roleOptions: WorkflowOption[]
  positionOptions: WorkflowOption[]
  companyUserOptions: WorkflowOption[]
  branchOptions: WorkflowOption[]
  departmentOptions: WorkflowOption[]
  saving: boolean
  canSubmit: boolean
  onOpenChange: (open: boolean) => void
  onValueChange: (patch: Partial<LeaveWorkflowStepFormValue>) => void
  onSubmit: () => void | Promise<void>
}

const actionOptions = [
  {
    value: "recommend",
    label: "Recommend",
    description: "Advise the next level before they decide.",
    icon: MessageSquareText,
  },
  {
    value: "verify",
    label: "Verify",
    description: "Confirm the request and its documents.",
    icon: ListChecks,
  },
  {
    value: "approve",
    label: "Approve",
    description: "Record the decision at this level.",
    icon: BadgeCheck,
  },
] as const

const approverTypeOptions = [
  {
    value: "role",
    label: "Role",
    description: "Anyone who currently holds the role.",
    icon: UsersRound,
  },
  {
    value: "position",
    label: "Position",
    description: "Whoever holds the position, even after a change.",
    icon: BriefcaseBusiness,
  },
  {
    value: "company_user",
    label: "Person",
    description: "One named person only.",
    icon: UserRound,
  },
] as const

function formatAction(value: string) {
  return actionOptions.find((option) => option.value === value)?.label ?? "Choose an action"
}

function PreviewRow({ label, value, pending }: { label: string; value: string; pending?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-sm font-semibold",
          pending ? "text-amber-600" : "text-primary",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function LeaveWorkflowStepDialog({
  open,
  mode,
  value,
  roleOptions,
  positionOptions,
  companyUserOptions,
  branchOptions,
  departmentOptions,
  saving,
  canSubmit,
  onOpenChange,
  onValueChange,
  onSubmit,
}: LeaveWorkflowStepDialogProps) {
  const approverConfig =
    value.approver_type === "position"
      ? {
          label: "Position",
          placeholder: "Search positions",
          options: positionOptions,
          selectedValue: value.position_id,
          hint: "Follows the seat, not the person currently in it.",
        }
      : value.approver_type === "company_user"
        ? {
            label: "Person",
            placeholder: "Search by name",
            options: companyUserOptions,
            selectedValue: value.company_user_id,
            hint: "Only this person receives the step.",
          }
        : {
            label: "Role",
            placeholder: "Search roles",
            options: roleOptions,
            selectedValue: value.role_id,
            hint: "Anyone with this role can take the step.",
          }

  const approverLabel =
    approverConfig.options.find((option) => option.value === approverConfig.selectedValue)?.label ?? "Not selected"
  const branchLabel =
    branchOptions.find((option) => option.value === value.assigned_branch_id)?.label ?? "All branches"
  const departmentLabel =
    departmentOptions.find((option) => option.value === value.assigned_department_id)?.label ?? "All departments"
  const levelNumber = Number(value.approval_level)
  const hasValidLevel = Number.isFinite(levelNumber) && levelNumber >= 1
  const hasApprover = Boolean(approverConfig.selectedValue)
  const isReady = hasValidLevel && hasApprover
  const missingHint = !hasValidLevel
    ? "Set a level of 1 or higher."
    : !hasApprover
      ? `Select a ${approverConfig.label.toLowerCase()}.`
      : "Ready to save."

  const bumpLevel = (delta: number) => {
    const current = Number.isFinite(levelNumber) ? levelNumber : 1
    onValueChange({ approval_level: String(Math.max(1, current + delta)) })
  }

  const updateApproverType = (nextType: string) => {
    onValueChange({
      approver_type: nextType,
      role_id: nextType === "role" ? value.role_id : "",
      position_id: nextType === "position" ? value.position_id : "",
      company_user_id: nextType === "company_user" ? value.company_user_id : "",
    })
  }

  const updateApproverValue = (nextValue: string) => {
    if (value.approver_type === "position") {
      onValueChange({ position_id: nextValue })
      return
    }
    if (value.approver_type === "company_user") {
      onValueChange({ company_user_id: nextValue })
      return
    }
    onValueChange({ role_id: nextValue })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        className="flex max-h-[min(90dvh,calc(100vh-1.5rem))] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
      >
        <header className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {mode === "create" ? "Add workflow step" : "Edit workflow step"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            Place this step in the flow, choose the action, then pick who owns it.
          </DialogDescription>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="divide-y divide-border">
              <section className="space-y-4 px-5 py-5 sm:px-6">
                <WorkflowSectionHeading
                  number="01"
                  title="Order"
                  description="Lower numbers run first. Each step needs its own level."
                />
                <div className="flex items-center gap-3 pl-9">
                  <span className="text-sm text-slate-600">Level</span>
                  <div className="inline-flex items-center rounded-md border border-slate-300 bg-white dark:border-border dark:bg-background">
                    <button
                      type="button"
                      className="inline-flex size-10 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                      onClick={() => bumpLevel(-1)}
                      aria-label="Decrease level"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <input
                      id="workflow-step-level"
                      type="number"
                      min={1}
                      className="h-10 w-14 border-x border-slate-300 bg-transparent text-center text-sm font-semibold tabular-nums text-slate-900 outline-none dark:border-border dark:text-white"
                      value={value.approval_level}
                      onChange={(event) => onValueChange({ approval_level: event.target.value })}
                    />
                    <button
                      type="button"
                      className="inline-flex size-10 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                      onClick={() => bumpLevel(1)}
                      aria-label="Increase level"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4 px-5 py-5 sm:px-6">
                <WorkflowSectionHeading
                  number="02"
                  title="Action"
                  description="This is the decision the approver is asked to make."
                />
                <div className="grid gap-2 pl-9 sm:grid-cols-3">
                  {actionOptions.map((option) => {
                    const active = value.action_type === option.value
                    const ActionIcon = option.icon
                    return (
                      <WorkflowChoiceCard
                        key={option.value}
                        active={active}
                        layoutId="workflow-action-choice"
                        onClick={() => onValueChange({ action_type: option.value })}
                      >
                        <ActionIcon className={cn("size-4", active ? "text-white" : "text-slate-400")} />
                        <span className={cn("mt-2 block text-sm font-semibold", active ? "text-white" : "text-slate-900 dark:text-white")}>
                          {option.label}
                        </span>
                        <span className={cn("mt-1 block text-xs leading-4", active ? "text-white/80" : "text-slate-500")}>
                          {option.description}
                        </span>
                      </WorkflowChoiceCard>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-4 px-5 py-5 sm:px-6">
                <WorkflowSectionHeading
                  number="03"
                  title="Approver"
                  description="Pick one routing method, then the matching person, role, or position."
                />
                <div className="grid gap-2 pl-9 sm:grid-cols-3">
                  {approverTypeOptions.map((option) => {
                    const active = value.approver_type === option.value
                    const ApproverIcon = option.icon
                    return (
                      <WorkflowChoiceCard
                        key={option.value}
                        active={active}
                        layoutId="workflow-approver-choice"
                        onClick={() => updateApproverType(option.value)}
                      >
                        <ApproverIcon className={cn("size-4", active ? "text-white" : "text-slate-400")} />
                        <span className={cn("mt-2 block text-sm font-semibold", active ? "text-white" : "text-slate-900 dark:text-white")}>
                          {option.label}
                        </span>
                        <span className={cn("mt-1 block text-xs leading-4", active ? "text-white/80" : "text-slate-500")}>
                          {option.description}
                        </span>
                      </WorkflowChoiceCard>
                    )
                  })}
                </div>
                <div className="pl-9">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={value.approver_type}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-2"
                    >
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {approverConfig.label}
                      </p>
                      <WorkflowSelect
                        value={approverConfig.selectedValue}
                        options={approverConfig.options}
                        placeholder={approverConfig.placeholder}
                        onValueChange={updateApproverValue}
                      />
                      <p className="text-xs text-slate-500">{approverConfig.hint}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </section>

              <section className="space-y-4 px-5 py-5 sm:px-6">
                <WorkflowSectionHeading
                  number="04"
                  title="Scope"
                  description="Leave blank to apply the step company-wide."
                />
                <div className="grid gap-3 pl-9 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-slate-400" />
                      Branch
                    </span>
                    <WorkflowSelect
                      value={value.assigned_branch_id}
                      options={branchOptions}
                      placeholder="All branches"
                      allLabel="All branches"
                      onValueChange={(next) => onValueChange({ assigned_branch_id: next })}
                    />
                  </div>
                  <div className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <UsersRound className="size-3.5 text-slate-400" />
                      Department
                    </span>
                    <WorkflowSelect
                      value={value.assigned_department_id}
                      options={departmentOptions}
                      placeholder="All departments"
                      allLabel="All departments"
                      onValueChange={(next) => onValueChange({ assigned_department_id: next })}
                    />
                  </div>
                </div>
                <div className="pl-9">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Required?</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      ["true", "Required", "This step must finish before the flow continues."],
                      ["false", "Optional", "The flow may skip this step."],
                    ].map(([optionValue, label, description]) => {
                      const active = value.is_required === optionValue
                      return (
                        <WorkflowChoiceCard
                          key={optionValue}
                          active={active}
                          layoutId="workflow-required-choice"
                          onClick={() => onValueChange({ is_required: optionValue })}
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
              </section>
            </div>

            <aside className="border-t border-border bg-slate-50/80 lg:border-t-0 lg:border-l dark:bg-muted/20">
              <div className="px-5 py-5 lg:sticky lg:top-0">
                <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Preview</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={value.action_type}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="mt-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-white"
                  >
                    {formatAction(value.action_type)}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-sm text-slate-500">
                  Level {hasValidLevel ? levelNumber : "—"} · {value.is_required === "true" ? "Required" : "Optional"}
                </p>
                <div className="mt-5 divide-y divide-border border-y border-border">
                  <PreviewRow label="Assigned to" value={approverLabel} pending={!hasApprover} />
                  <PreviewRow
                    label="Via"
                    value={approverTypeOptions.find((option) => option.value === value.approver_type)?.label ?? "—"}
                  />
                  <PreviewRow label="Branch" value={branchLabel} />
                  <PreviewRow label="Department" value={departmentLabel} />
                </div>
                <p className={cn("mt-4 text-xs", isReady ? "text-emerald-700" : "text-amber-700")}>{missingHint}</p>
              </div>
            </aside>
          </div>
        </div>

        <DialogFooter className="mt-0 shrink-0 border-t border-border bg-white px-5 py-3 sm:justify-end sm:px-6 dark:bg-background">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || !canSubmit || !isReady}
            onClick={() => void onSubmit()}
          >
            {saving ? "Saving…" : mode === "create" ? "Add step" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
