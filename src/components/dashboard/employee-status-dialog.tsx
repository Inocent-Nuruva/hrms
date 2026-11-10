"use client"

import * as React from "react"
import Link from "next/link"
import {
  Dialog as FluentDialog,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components"
import { AlertCircle, CheckCircle2, Circle, Loader2, X } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  getEmployeeStatusRequirements,
  patchEmployeeStatus,
  readStatusFieldErrors,
  type EmployeeStatusPayload,
  type EmployeeStatusRequirements,
  type EmployeeStatusValue,
  type StatusRequirement,
  type StatusRequirementState,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"

const EXIT_STATUSES: EmployeeStatusValue[] = ["resigned", "terminated", "retired", "deceased", "exited"]

/** Preferred first choice in the status dropdown for each current status. */
const SUGGESTED_TARGET: Partial<Record<EmployeeStatusValue, EmployeeStatusValue>> = {
  onboarding: "active",
  active: "suspended",
  suspended: "active",
  inactive: "active",
  resigned: "exited",
  terminated: "exited",
  retired: "exited",
}

const SUSPENSION_REASON_LABELS: Record<string, string> = {
  disciplinary: "Disciplinary",
  investigation: "Pending investigation",
  medical: "Medical",
  administrative: "Administrative",
  other: "Other",
}

type ExitReason = NonNullable<EmployeeStatusPayload["exit"]>["reason"]
type PayStatus = NonNullable<EmployeeStatusPayload["suspension"]>["pay_status"]

type Option = { id: number; name: string }
type ScheduleCurrent = { mode: "shift" | "timetable"; id: number; name: string; effective_from: string | null; source: string }
type ScheduleOptions = {
  shifts: Array<Option & { start_time?: string; end_time?: string }>
  timetables: Array<Option & { is_default?: boolean }>
}
type ChecklistItem = {
  step_id: number
  title: string
  description: string | null
  task_type: string
  required: boolean
  can_complete_now: boolean
}

type FormState = {
  target: EmployeeStatusValue | ""
  effectiveDate: string
  notes: string
  schedule: {
    keepCurrent: boolean
    mode: "shift" | "timetable"
    id: string
    startDate: string
    startDateTouched: boolean
  }
  leavePolicyId: string
  attendancePolicyId: string
  suspension: {
    reason: string
    startDate: string
    expectedEndDate: string
    payStatus: PayStatus
    pauseAttendance: boolean
    disableLogin: boolean
    notifyManager: boolean
  }
  exit: {
    exitDate: string
    lastWorkingDay: string
    reason: ExitReason | ""
    reasonDetails: string
    rehireEligible: boolean
    endSchedule: boolean
    completedStepIds: number[]
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function statusLabel(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ") : ""
}

function emptyForm(notes: string): FormState {
  const today = todayIso()
  return {
    target: "",
    effectiveDate: today,
    notes,
    schedule: { keepCurrent: false, mode: "shift", id: "", startDate: today, startDateTouched: false },
    leavePolicyId: "",
    attendancePolicyId: "",
    suspension: {
      reason: "",
      startDate: today,
      expectedEndDate: "",
      payStatus: "unpaid",
      pauseAttendance: true,
      disableLogin: true,
      notifyManager: true,
    },
    exit: {
      exitDate: today,
      lastWorkingDay: today,
      reason: "",
      reasonDetails: "",
      rehireEligible: true,
      endSchedule: true,
      completedStepIds: [],
    },
  }
}

function findRequirement(requirements: EmployeeStatusRequirements | null, key: string) {
  return requirements?.requirements.find((row) => row.key === key) ?? null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** Applies server defaults for the selected target onto the form. */
function applyDefaults(form: FormState, requirements: EmployeeStatusRequirements): FormState {
  const next: FormState = {
    ...form,
    schedule: { ...form.schedule },
    suspension: { ...form.suspension },
    exit: { ...form.exit, completedStepIds: [] },
  }
  const effectiveDate = form.effectiveDate || requirements.context.today

  const schedule = findRequirement(requirements, "work_schedule")
  if (schedule) {
    const current = asRecord(schedule.current) as ScheduleCurrent | null
    const fallback = asRecord(schedule.default) as { mode: "shift" | "timetable"; id: number } | null
    next.schedule = {
      keepCurrent: Boolean(current),
      mode: current?.mode ?? fallback?.mode ?? "shift",
      id: current ? "" : fallback ? String(fallback.id) : "",
      startDate: effectiveDate,
      startDateTouched: false,
    }
    if (current) {
      next.schedule.mode = fallback?.mode ?? current.mode
      next.schedule.id = fallback ? String(fallback.id) : ""
    }
  }
  const leave = findRequirement(requirements, "leave_policy")
  next.leavePolicyId = leave?.default ? String(leave.default) : ""
  const attendance = findRequirement(requirements, "attendance_policy")
  next.attendancePolicyId = attendance?.default ? String(attendance.default) : ""

  if (requirements.target_status === "suspended") {
    const pay = findRequirement(requirements, "pay_status")
    const actions = asRecord(findRequirement(requirements, "suspension_actions")?.default)
    next.suspension = {
      ...next.suspension,
      startDate: effectiveDate,
      expectedEndDate: "",
      payStatus: (pay?.default as PayStatus) ?? "unpaid",
      pauseAttendance: actions?.pause_attendance !== false,
      disableLogin: actions?.disable_login !== false,
      notifyManager: actions?.notify_manager !== false,
    }
  }

  if (EXIT_STATUSES.includes(requirements.target_status)) {
    const reason = findRequirement(requirements, "exit_reason")
    next.exit = {
      ...next.exit,
      exitDate: effectiveDate,
      lastWorkingDay: effectiveDate,
      reason: (reason?.default as ExitReason) ?? "",
      rehireEligible: true,
      endSchedule: true,
      completedStepIds: [],
    }
  }
  return next
}

type ItemStatus = { key: string; label: string; required: boolean; state: StatusRequirementState }

/** Client-side requirement states derived from the current form values. */
function computeItemStatuses(form: FormState, requirements: EmployeeStatusRequirements | null): ItemStatus[] {
  if (!requirements) return []
  const target = requirements.target_status
  const items: ItemStatus[] = []
  const done = (ok: boolean): StatusRequirementState => (ok ? "complete" : "needs_input")

  if (target === "active") {
    const contract = findRequirement(requirements, "contract")
    if (contract) {
      items.push({ key: "contract", label: contract.label, required: true, state: done(contract.state === "complete") })
    }
    const schedule = findRequirement(requirements, "work_schedule")
    if (schedule) {
      const hasCurrent = Boolean(asRecord(schedule.current))
      const coveredByDefault = schedule.state === "complete" && !hasCurrent
      const ok = form.schedule.keepCurrent
        ? hasCurrent
        : Boolean(form.schedule.id && form.schedule.startDate) || coveredByDefault
      items.push({ key: "work_schedule", label: "Work schedule", required: true, state: done(ok) })
    }
    for (const key of ["leave_policy", "attendance_policy", "probation_end_date"]) {
      const row = findRequirement(requirements, key)
      if (row) items.push({ key, label: row.label, required: false, state: "optional" })
    }
  } else if (target === "suspended") {
    items.push(
      { key: "suspension_reason", label: "Suspension reason", required: true, state: done(Boolean(form.suspension.reason)) },
      {
        key: "suspension_dates",
        label: "Suspension period",
        required: true,
        state: done(
          Boolean(form.suspension.startDate) &&
            (!form.suspension.expectedEndDate || form.suspension.expectedEndDate >= form.suspension.startDate),
        ),
      },
      { key: "pay_status", label: "Pay status", required: true, state: done(Boolean(form.suspension.payStatus)) },
      { key: "suspension_actions", label: "Suspension actions", required: false, state: "optional" },
    )
  } else if (EXIT_STATUSES.includes(target)) {
    items.push(
      {
        key: "exit_dates",
        label: "Exit date and last working day",
        required: true,
        state: done(
          Boolean(form.exit.exitDate && form.exit.lastWorkingDay) && form.exit.lastWorkingDay <= form.exit.exitDate,
        ),
      },
      {
        key: "exit_reason",
        label: "Exit reason",
        required: true,
        state: done(Boolean(form.exit.reason) && (form.exit.reason !== "other" || form.exit.reasonDetails.trim().length >= 3)),
      },
      { key: "offboarding_checklist", label: "Offboarding checklist", required: false, state: "optional" },
      { key: "rehire_eligible", label: "Rehire eligibility", required: true, state: "complete" },
      { key: "end_schedule", label: "End current schedule", required: false, state: "optional" },
    )
  }
  return items
}

function StateIcon({ state }: { state: StatusRequirementState }) {
  if (state === "complete") return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Complete" />
  if (state === "needs_input") return <AlertCircle className="size-4 shrink-0 text-amber-600" aria-label="Needs input" />
  return <Circle className="size-4 shrink-0 text-slate-400" aria-label="Optional" />
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
      {required ? <span className="text-rose-600"> *</span> : null}
    </span>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-rose-600">{message}</p> : null
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex w-full rounded-md border border-slate-300 p-0.5 sm:w-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
            value === option.value ? "bg-primary !text-white" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function RequirementCard({
  state,
  title,
  required,
  description,
  children,
}: {
  state: StatusRequirementState
  title: string
  required?: boolean
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-3",
        state === "complete" && "border-emerald-200 bg-emerald-50/40",
        state === "needs_input" && "border-amber-200 bg-amber-50/40",
        state === "optional" && "border-slate-200",
      )}
    >
      <div className="flex items-start gap-2">
        <StateIcon state={state} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">
            {title}
            {required ? null : <span className="ml-1 text-xs font-normal text-slate-500">(optional)</span>}
          </p>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="mt-3 grid gap-3">{children}</div> : null}
    </div>
  )
}

export function EmployeeStatusDialog({
  open,
  onOpenChange,
  token,
  employeeId,
  employeeName,
  currentStatus,
  currentNotes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  employeeId: number
  employeeName: string
  currentStatus: EmployeeStatusValue
  currentNotes: string
  onSaved: () => void | Promise<void>
}) {
  const [form, setForm] = React.useState<FormState>(() => emptyForm(currentNotes))
  const [requirements, setRequirements] = React.useState<EmployeeStatusRequirements | null>(null)
  const [allowedTargets, setAllowedTargets] = React.useState<EmployeeStatusValue[]>([])
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [step, setStep] = React.useState<"form" | "confirm">("form")
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const loadSeq = React.useRef(0)

  const loadRequirements = React.useCallback(
    async (target: EmployeeStatusValue, base: FormState) => {
      const seq = ++loadSeq.current
      setLoading(true)
      setLoadError(null)
      try {
        const data = await getEmployeeStatusRequirements(token, employeeId, target)
        if (seq !== loadSeq.current) return
        setRequirements(data)
        setAllowedTargets(data.allowed_targets ?? [])
        setForm(applyDefaults({ ...base, target }, data))
      } catch (error) {
        if (seq !== loadSeq.current) return
        setRequirements(null)
        setLoadError(error instanceof Error ? error.message : "Could not load the requirements for this status.")
      } finally {
        if (seq === loadSeq.current) setLoading(false)
      }
    },
    [employeeId, token],
  )

  // Reset and pre-load the suggested target whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return
    const base = emptyForm(currentNotes)
    setForm(base)
    setRequirements(null)
    setAllowedTargets([])
    setDirty(false)
    setStep("form")
    setConfirmDiscard(false)
    setSubmitError(null)
    setFieldErrors({})
    const suggested = SUGGESTED_TARGET[currentStatus]
    if (suggested) {
      void loadRequirements(suggested, base)
    } else {
      setLoadError(null)
    }
  }, [open, currentStatus, currentNotes, loadRequirements])

  const update = React.useCallback((recipe: (prev: FormState) => FormState) => {
    setForm(recipe)
    setDirty(true)
    setSubmitError(null)
  }, [])

  const target = form.target
  const isExit = target ? EXIT_STATUSES.includes(target) : false
  const itemStatuses = React.useMemo(() => computeItemStatuses(form, requirements), [form, requirements])
  const requiredItems = itemStatuses.filter((row) => row.required)
  const completeRequired = requiredItems.filter((row) => row.state === "complete").length
  const blocking = requirements?.blocking ?? []
  const stateOf = (key: string): StatusRequirementState =>
    itemStatuses.find((row) => row.key === key)?.state ?? "optional"

  const canSubmit =
    Boolean(target) &&
    Boolean(requirements) &&
    requirements?.target_status === target &&
    !loading &&
    blocking.length === 0 &&
    completeRequired === requiredItems.length &&
    Boolean(form.effectiveDate)

  const requestClose = () => {
    if (submitting) return
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onOpenChange(false)
  }

  const handleTargetChange = (value: string) => {
    const next = value as EmployeeStatusValue
    setDirty(true)
    setFieldErrors({})
    setSubmitError(null)
    setForm((prev) => ({ ...prev, target: next }))
    void loadRequirements(next, { ...form, target: next })
  }

  const handleEffectiveDateChange = (value: string) => {
    update((prev) => ({
      ...prev,
      effectiveDate: value,
      // Dependent dates follow the effective date until edited directly.
      schedule: prev.schedule.startDateTouched ? prev.schedule : { ...prev.schedule, startDate: value },
      suspension: { ...prev.suspension, startDate: dirtyDate(prev.suspension.startDate, prev.effectiveDate, value) },
      exit: {
        ...prev.exit,
        exitDate: dirtyDate(prev.exit.exitDate, prev.effectiveDate, value),
        lastWorkingDay: dirtyDate(prev.exit.lastWorkingDay, prev.effectiveDate, value),
      },
    }))
  }

  const scheduleRequirement = findRequirement(requirements, "work_schedule")
  const scheduleCurrent = asRecord(scheduleRequirement?.current) as ScheduleCurrent | null
  const scheduleOptions = (asRecord(scheduleRequirement?.options) as ScheduleOptions | null) ?? {
    shifts: [],
    timetables: [],
  }
  const checklistItems = (findRequirement(requirements, "offboarding_checklist")?.options as ChecklistItem[] | undefined) ?? []
  const finalExitStatus =
    form.exit.reason && requirements?.context.final_status_by_exit_reason
      ? requirements.context.final_status_by_exit_reason[form.exit.reason]
      : null

  const buildPayload = (): EmployeeStatusPayload => {
    const payload: EmployeeStatusPayload = {
      employment_status: target as EmployeeStatusPayload["employment_status"],
      effective_date: form.effectiveDate,
      notes: form.notes.trim() || undefined,
    }
    if (target === "active") {
      if (!form.schedule.keepCurrent && form.schedule.id) {
        payload.schedule = {
          mode: form.schedule.mode,
          id: Number(form.schedule.id),
          effective_from: form.schedule.startDate || form.effectiveDate,
        }
      }
      if (requirements?.path === "onboarding_completion") {
        const activation: NonNullable<EmployeeStatusPayload["activation"]> = {}
        if (form.leavePolicyId) activation.leave_policy_id = Number(form.leavePolicyId)
        if (form.attendancePolicyId) activation.attendance_policy_id = Number(form.attendancePolicyId)
        if (Object.keys(activation).length) payload.activation = activation
      }
    } else if (target === "suspended") {
      payload.suspension = {
        reason: form.suspension.reason,
        start_date: form.suspension.startDate,
        expected_end_date: form.suspension.expectedEndDate || null,
        pay_status: form.suspension.payStatus,
        pause_attendance: form.suspension.pauseAttendance,
        disable_login: form.suspension.disableLogin,
        notify_manager: form.suspension.notifyManager,
      }
    } else if (isExit && form.exit.reason) {
      payload.exit = {
        exit_date: form.exit.exitDate,
        last_working_day: form.exit.lastWorkingDay,
        reason: form.exit.reason,
        reason_details: form.exit.reasonDetails.trim() || undefined,
        rehire_eligible: form.exit.rehireEligible,
        end_schedule: form.exit.endSchedule,
        completed_step_ids: form.exit.completedStepIds,
      }
    }
    return payload
  }

  const summaryLines = (): Array<[string, string]> => {
    if (!requirements || !target) return []
    const lines: Array<[string, string]> = []
    const deferred = requirements.path === "offboarding_request"
    lines.push([
      "Status",
      deferred
        ? `${statusLabel(currentStatus)} → ${statusLabel(finalExitStatus ?? target)} when offboarding is finalized`
        : `${statusLabel(currentStatus)} → ${statusLabel(target)}`,
    ])
    lines.push(["Effective date", form.effectiveDate])
    if (target === "active") {
      if (requirements.path === "onboarding_completion") lines.push(["Onboarding", "Completed through the onboarding workflow"])
      if (form.schedule.keepCurrent && scheduleCurrent) {
        lines.push(["Work schedule", `Keep ${scheduleCurrent.mode} "${scheduleCurrent.name}"`])
      } else if (form.schedule.id) {
        const list = form.schedule.mode === "shift" ? scheduleOptions.shifts : scheduleOptions.timetables
        const name = list.find((row) => String(row.id) === form.schedule.id)?.name ?? `#${form.schedule.id}`
        lines.push(["Work schedule", `Assign ${form.schedule.mode} "${name}" from ${form.schedule.startDate}`])
      }
      if (requirements.path === "onboarding_completion") {
        const leave = (findRequirement(requirements, "leave_policy")?.options as Option[] | undefined)?.find(
          (row) => String(row.id) === form.leavePolicyId,
        )
        const attendance = (findRequirement(requirements, "attendance_policy")?.options as Option[] | undefined)?.find(
          (row) => String(row.id) === form.attendancePolicyId,
        )
        if (leave) lines.push(["Leave policy", leave.name])
        if (attendance) lines.push(["Attendance policy", attendance.name])
      }
      if (currentStatus === "suspended") lines.push(["Access", "Login and attendance tracking restored if paused by the suspension"])
    } else if (target === "suspended") {
      lines.push([
        "Suspension",
        `${SUSPENSION_REASON_LABELS[form.suspension.reason] ?? form.suspension.reason}, from ${form.suspension.startDate}${
          form.suspension.expectedEndDate ? ` until ${form.suspension.expectedEndDate}` : " (open-ended)"
        }, ${form.suspension.payStatus}`,
      ])
      const access = [
        form.suspension.pauseAttendance ? "attendance tracking paused" : null,
        form.suspension.disableLogin ? "system login disabled" : null,
        form.suspension.notifyManager ? "line manager notified" : null,
      ].filter(Boolean)
      lines.push(["Access changes", access.length ? access.join(", ") : "None"])
    } else if (isExit) {
      lines.push(["Exit", `Exit date ${form.exit.exitDate}, last working day ${form.exit.lastWorkingDay}`])
      lines.push(["Reason", EXIT_REASON_OPTIONS.find((row) => row.value === form.exit.reason)?.label ?? form.exit.reason])
      const pending = checklistItems.length - form.exit.completedStepIds.length
      lines.push([
        "Offboarding",
        `Request created; ${form.exit.completedStepIds.length} item(s) marked done, ${pending} pending task(s) in the Offboarding tab`,
      ])
      lines.push(["Rehire eligible", form.exit.rehireEligible ? "Yes" : "No"])
      if (!deferred) lines.push(["Schedule", form.exit.endSchedule ? `Ends on ${form.exit.exitDate}` : "Unchanged"])
    }
    if (form.notes.trim()) lines.push(["Notes", form.notes.trim()])
    return lines
  }

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    setFieldErrors({})
    try {
      const result = (await patchEmployeeStatus(token, employeeId, buildPayload())) as Record<string, unknown> | null
      const data = asRecord(result?.data) ?? result
      const statusChange = asRecord(data?.status_change)
      if (statusChange?.status_deferred) {
        toast.success(`Offboarding ${String(statusChange.offboarding_code ?? "")} started`.replace("  ", " "), {
          description: `Status will change to ${statusLabel(finalExitStatus ?? target)} when offboarding is finalized.`,
        })
      } else {
        toast.success(`Status updated to ${statusLabel(target)}`)
      }
      setDirty(false)
      onOpenChange(false)
      await onSaved()
    } catch (error) {
      const errors = readStatusFieldErrors(error)
      setFieldErrors(errors)
      setSubmitError(error instanceof Error ? error.message : "Failed to update status.")
      setStep("form")
    } finally {
      setSubmitting(false)
    }
  }

  const targetOptions = (allowedTargets.length ? allowedTargets : form.target ? [form.target] : []).map((value) => ({
    value,
    label: statusLabel(value),
  }))

  return (
    <FluentDialog
      modalType="modal"
      open={open}
      onOpenChange={(_event, data) => {
        if (data.open) onOpenChange(true)
        else requestClose()
      }}
    >
      <DialogSurface
        aria-describedby="employee-status-dialog-subtitle"
        className={cn(
          "!flex !flex-col !p-0 !gap-0 overflow-hidden",
          "!w-[min(720px,calc(100vw-2rem))] !max-w-[720px] !max-h-[calc(100dvh-2rem)]",
          "max-sm:!m-0 max-sm:!h-dvh max-sm:!max-h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!rounded-none",
        )}
      >
        {/* Fixed header */}
        <div className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle as="h2" className="!text-lg !font-semibold">
                Update Employee Status
              </DialogTitle>
              <p id="employee-status-dialog-subtitle" className="mt-0.5 text-sm text-muted-foreground">
                Update lifecycle status and complete everything it requires in one step.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="truncate font-medium text-slate-800">{employeeName}</span>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  Current: {statusLabel(currentStatus)}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={requestClose}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {confirmDiscard ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-medium">Discard unsaved changes?</p>
              <p className="mt-0.5 text-xs">The status change and the requirement values you entered will be lost.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium"
                  onClick={() => setConfirmDiscard(false)}
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium !text-white"
                  onClick={() => {
                    setConfirmDiscard(false)
                    setDirty(false)
                    onOpenChange(false)
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="grid gap-3">
              <p className="text-sm font-medium text-slate-800">Review the changes before saving</p>
              <dl className="divide-y divide-border rounded-md border border-border">
                {summaryLines().map(([label, value]) => (
                  <div key={label} className="grid gap-1 px-3 py-2 sm:grid-cols-[160px_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="whitespace-pre-line break-words text-sm text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
              {requirements?.path_note ? <p className="text-xs text-muted-foreground">{requirements.path_note}</p> : null}
              <p className="text-xs text-muted-foreground">Everything is saved together. If any part fails, nothing is saved.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {/* 1. Status + effective date */}
              <section className="grid gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1">
                  <FieldLabel required>Employment Status</FieldLabel>
                  <FluentSelect
                    ariaLabel="Employment Status"
                    value={form.target}
                    placeholder={targetOptions.length ? "Select status" : "No changes available"}
                    disabled={!targetOptions.length && !loading}
                    onChange={handleTargetChange}
                    options={targetOptions}
                  />
                  <FieldError message={fieldErrors.employment_status} />
                </label>
                <label className="grid min-w-0 gap-1">
                  <FieldLabel required>Effective Date</FieldLabel>
                  <DatePickerPresets value={form.effectiveDate} onChange={handleEffectiveDateChange} />
                  <FieldError message={fieldErrors.effective_date} />
                </label>
              </section>

              {/* 2. Requirements */}
              {target ? (
                <section className="grid gap-3" aria-busy={loading}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Requirements for {statusLabel(target)}</h3>
                      {requirements && requiredItems.length ? (
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                          {completeRequired} of {requiredItems.length} requirements complete
                        </p>
                      ) : null}
                    </div>
                    {requirements && itemStatuses.length ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          if (!requirements) return
                          setDirty(true)
                          setForm((prev) => applyDefaults(prev, requirements))
                        }}
                      >
                        Use defaults
                      </button>
                    ) : null}
                  </div>

                  {loading ? (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading requirements…
                    </div>
                  ) : loadError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {loadError}{" "}
                      <button
                        type="button"
                        className="font-medium underline"
                        onClick={() => target && void loadRequirements(target, form)}
                      >
                        Retry
                      </button>
                    </div>
                  ) : requirements ? (
                    <>
                      {requirements.path_note ? (
                        <p
                          className={cn(
                            "rounded-md border px-3 py-2 text-xs",
                            requirements.path === "offboarding_request"
                              ? "border-sky-200 bg-sky-50 text-sky-900"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                          )}
                        >
                          {requirements.path === "offboarding_request" && finalExitStatus
                            ? `An offboarding request will be created. Status will change to ${statusLabel(finalExitStatus)} when offboarding is finalized.`
                            : requirements.path_note}
                        </p>
                      ) : null}

                      {blocking.length ? (
                        <RequirementCard
                          state="needs_input"
                          required
                          title="Outstanding items that must be completed first"
                          description="These can't be completed in this dialog. Update Status stays disabled until they're done."
                        >
                          <ul className="grid gap-1 text-sm">
                            {blocking.filter((row) => row.key !== "contract").map((row) => (
                              <li key={row.key} className="flex flex-wrap items-center gap-x-2">
                                <span className="text-slate-700">• {row.label}</span>
                                {row.link ? (
                                  <Link href={row.link} className="text-xs font-medium text-primary hover:underline">
                                    Open
                                  </Link>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <FieldError message={fieldErrors.onboarding} />
                        </RequirementCard>
                      ) : null}

                      {target === "active" ? (
                        <ActivationFields
                          form={form}
                          update={update}
                          requirements={requirements}
                          scheduleCurrent={scheduleCurrent}
                          scheduleOptions={scheduleOptions}
                          scheduleState={stateOf("work_schedule")}
                          fieldErrors={fieldErrors}
                        />
                      ) : null}

                      {target === "suspended" ? (
                        <SuspensionFields form={form} update={update} stateOf={stateOf} fieldErrors={fieldErrors} requirements={requirements} />
                      ) : null}

                      {isExit ? (
                        <ExitFields
                          form={form}
                          update={update}
                          stateOf={stateOf}
                          fieldErrors={fieldErrors}
                          checklistItems={checklistItems}
                          checklistDescription={findRequirement(requirements, "offboarding_checklist")?.description}
                          deferred={requirements.path === "offboarding_request"}
                        />
                      ) : null}

                      {!itemStatuses.length && !blocking.length ? (
                        <p className="rounded-md border border-slate-200 px-3 py-2 text-sm text-muted-foreground">
                          No additional requirements for this status.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </section>
              ) : null}

              {/* 3. Notes */}
              <label className="grid gap-1">
                <FieldLabel>Notes</FieldLabel>
                <Textarea
                  value={form.notes}
                  onChange={(event) => update((prev) => ({ ...prev, notes: event.target.value }))}
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <FieldError message={fieldErrors.notes} />
              </label>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-border bg-background px-5 py-3 sm:px-6">
          {submitError ? (
            <p role="alert" className="mb-2 text-sm text-rose-600">
              {submitError}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            {step === "confirm" ? (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                  onClick={() => setStep("form")}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting || !canSubmit}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
                  onClick={() => void submit()}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {submitting ? "Saving…" : "Confirm"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                  onClick={requestClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
                  onClick={() => {
                    setSubmitError(null)
                    setStep("confirm")
                  }}
                >
                  Update Status
                </button>
              </>
            )}
          </div>
        </div>
      </DialogSurface>
    </FluentDialog>
  )
}

/** Keeps a dependent date in sync with the effective date unless it was changed independently. */
function dirtyDate(current: string, previousEffective: string, nextEffective: string) {
  return !current || current === previousEffective ? nextEffective : current
}

const EXIT_REASON_OPTIONS: Array<{ value: ExitReason; label: string }> = [
  { value: "resignation", label: "Resignation" },
  { value: "termination", label: "Termination" },
  { value: "end_of_contract", label: "End of contract" },
  { value: "retirement", label: "Retirement" },
  { value: "other", label: "Other" },
]

type SectionProps = {
  form: FormState
  update: (recipe: (prev: FormState) => FormState) => void
  fieldErrors: Record<string, string>
}

function ActivationFields({
  form,
  update,
  requirements,
  scheduleCurrent,
  scheduleOptions,
  scheduleState,
  fieldErrors,
}: SectionProps & {
  requirements: EmployeeStatusRequirements
  scheduleCurrent: ScheduleCurrent | null
  scheduleOptions: ScheduleOptions
  scheduleState: StatusRequirementState
}) {
  const schedule = findRequirement(requirements, "work_schedule")
  const leave = findRequirement(requirements, "leave_policy")
  const attendance = findRequirement(requirements, "attendance_policy")
  const probation = findRequirement(requirements, "probation_end_date")
  const list = form.schedule.mode === "shift" ? scheduleOptions.shifts : scheduleOptions.timetables
  const scheduleError = fieldErrors["schedule.id"] ?? fieldErrors.schedule
  const contract = findRequirement(requirements, "contract")
  const contractCurrent = asRecord(contract?.current)

  return (
    <>
      {contract ? (
        <RequirementCard
          state={contract.state === "complete" && !fieldErrors.contract ? "complete" : "needs_input"}
          required
          title="Employment contract"
          description={contract.description}
        >
          {contractCurrent ? (
            <p className="rounded-md bg-white/70 px-2 py-1.5 text-sm text-slate-700">
              <span className="font-medium">{String(contractCurrent.reference_no ?? "")}</span> · from{" "}
              {String(contractCurrent.start_date ?? "")}
              {contractCurrent.end_date ? ` to ${String(contractCurrent.end_date)}` : " (no end date)"}
            </p>
          ) : typeof contract.default === "string" ? (
            <Link href={contract.default} className="text-sm font-medium text-primary hover:underline">
              Open contracts
            </Link>
          ) : null}
          <FieldError message={fieldErrors.contract} />
        </RequirementCard>
      ) : null}

      {schedule ? (
        <RequirementCard
          state={scheduleError ? "needs_input" : scheduleState}
          required
          title="Work schedule"
          description={
            form.schedule.keepCurrent && scheduleCurrent
              ? undefined
              : schedule.description ?? "Pre-selected from the most used schedule in this branch and department."
          }
        >
          {scheduleCurrent ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5 text-sm">
              <span className="text-slate-700">
                {scheduleCurrent.source === "onboarding_selection" ? "Selected in onboarding" : "Current"}:{" "}
                <span className="font-medium">
                  {scheduleCurrent.mode === "shift" ? "Shift" : "Timetable"} “{scheduleCurrent.name}”
                </span>
                {scheduleCurrent.effective_from ? ` from ${scheduleCurrent.effective_from}` : ""}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  update((prev) => ({ ...prev, schedule: { ...prev.schedule, keepCurrent: !prev.schedule.keepCurrent } }))
                }
              >
                {form.schedule.keepCurrent ? "Assign a different schedule" : "Keep current schedule"}
              </button>
            </div>
          ) : null}
          {!form.schedule.keepCurrent || !scheduleCurrent ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1 sm:col-span-2">
                <FieldLabel>Schedule type</FieldLabel>
                <Segmented
                  ariaLabel="Schedule type"
                  value={form.schedule.mode}
                  onChange={(mode) =>
                    update((prev) => {
                      const options = mode === "shift" ? scheduleOptions.shifts : scheduleOptions.timetables
                      const fallback = asRecord(schedule.default) as { mode: string; id: number } | null
                      const preferred =
                        fallback?.mode === mode
                          ? String(fallback.id)
                          : mode === "timetable"
                            ? String(scheduleOptions.timetables.find((row) => row.is_default)?.id ?? options[0]?.id ?? "")
                            : String(options[0]?.id ?? "")
                      return { ...prev, schedule: { ...prev.schedule, mode, id: preferred } }
                    })
                  }
                  options={[
                    { value: "shift", label: "Shift" },
                    { value: "timetable", label: "Timetable" },
                  ]}
                />
              </div>
              <label className="grid min-w-0 gap-1">
                <FieldLabel required>{form.schedule.mode === "shift" ? "Shift" : "Timetable"}</FieldLabel>
                <FluentSelect
                  ariaLabel={form.schedule.mode === "shift" ? "Shift" : "Timetable"}
                  value={form.schedule.id}
                  placeholder={list.length ? "Select" : `No active ${form.schedule.mode}s`}
                  disabled={!list.length}
                  onChange={(value) => update((prev) => ({ ...prev, schedule: { ...prev.schedule, id: value } }))}
                  options={list.map((row) => ({
                    value: String(row.id),
                    label: row.name,
                    description:
                      "start_time" in row && row.start_time ? `${row.start_time} – ${row.end_time ?? ""}` : undefined,
                  }))}
                />
              </label>
              <label className="grid min-w-0 gap-1">
                <FieldLabel required>Schedule start date</FieldLabel>
                <DatePickerPresets
                  value={form.schedule.startDate}
                  onChange={(value) =>
                    update((prev) => ({ ...prev, schedule: { ...prev.schedule, startDate: value, startDateTouched: true } }))
                  }
                />
              </label>
            </div>
          ) : null}
          <FieldError message={scheduleError} />
        </RequirementCard>
      ) : null}

      {leave ? (
        <RequirementCard state="optional" title="Leave policy" description={leave.description}>
          <FluentSelect
            ariaLabel="Leave policy"
            value={form.leavePolicyId}
            placeholder="Use matching rules"
            onChange={(value) => update((prev) => ({ ...prev, leavePolicyId: value }))}
            options={((leave.options as Option[] | undefined) ?? []).map((row) => ({ value: String(row.id), label: row.name }))}
          />
          <FieldError message={fieldErrors["activation.leave_policy_id"]} />
        </RequirementCard>
      ) : null}

      {attendance ? (
        <RequirementCard state="optional" title="Attendance policy">
          <FluentSelect
            ariaLabel="Attendance policy"
            value={form.attendancePolicyId}
            placeholder="Company default"
            onChange={(value) => update((prev) => ({ ...prev, attendancePolicyId: value }))}
            options={((attendance.options as Option[] | undefined) ?? []).map((row) => ({
              value: String(row.id),
              label: row.name,
            }))}
          />
          <FieldError message={fieldErrors["activation.attendance_policy_id"]} />
        </RequirementCard>
      ) : null}

      {probation ? (
        <RequirementCard
          state="optional"
          title={`Probation end date: ${String(probation.current ?? probation.default ?? "Not applicable")}`}
          description={probation.description}
        />
      ) : null}
    </>
  )
}

function SuspensionFields({
  form,
  update,
  stateOf,
  fieldErrors,
  requirements,
}: SectionProps & {
  stateOf: (key: string) => StatusRequirementState
  requirements: EmployeeStatusRequirements
}) {
  const reasons = (findRequirement(requirements, "suspension_reason")?.options as string[] | undefined) ?? Object.keys(SUSPENSION_REASON_LABELS)
  const actionContext = asRecord(findRequirement(requirements, "suspension_actions")?.current)
  const setSuspension = (patch: Partial<FormState["suspension"]>) =>
    update((prev) => ({ ...prev, suspension: { ...prev.suspension, ...patch } }))

  return (
    <>
      <RequirementCard state={stateOf("suspension_reason")} required title="Suspension reason">
        <FluentSelect
          ariaLabel="Suspension reason"
          value={form.suspension.reason}
          placeholder="Select a reason"
          onChange={(value) => setSuspension({ reason: value })}
          options={reasons.map((value) => ({ value, label: SUSPENSION_REASON_LABELS[value] ?? statusLabel(value) }))}
        />
        <FieldError message={fieldErrors["suspension.reason"] ?? fieldErrors.suspension} />
      </RequirementCard>

      <RequirementCard state={stateOf("suspension_dates")} required title="Suspension period">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1">
            <FieldLabel required>Start date</FieldLabel>
            <DatePickerPresets value={form.suspension.startDate} onChange={(value) => setSuspension({ startDate: value })} />
          </label>
          <label className="grid min-w-0 gap-1">
            <FieldLabel>Expected end date</FieldLabel>
            <DatePickerPresets
              value={form.suspension.expectedEndDate}
              placeholder="Open-ended"
              onChange={(value) => setSuspension({ expectedEndDate: value })}
            />
          </label>
        </div>
        <FieldError message={fieldErrors["suspension.expected_end_date"]} />
      </RequirementCard>

      <RequirementCard state={stateOf("pay_status")} required title="Pay status during suspension">
        <Segmented<PayStatus>
          ariaLabel="Pay status"
          value={form.suspension.payStatus}
          onChange={(payStatus) => setSuspension({ payStatus })}
          options={[
            { value: "paid", label: "Paid" },
            { value: "unpaid", label: "Unpaid" },
            { value: "partial", label: "Partial" },
          ]}
        />
      </RequirementCard>

      <RequirementCard state="optional" title="Suspension actions">
        <CheckRow
          checked={form.suspension.pauseAttendance}
          onChange={(value) => setSuspension({ pauseAttendance: value })}
          label="Pause attendance tracking"
          hint="The employee is exempted from attendance from the start date."
        />
        <CheckRow
          checked={form.suspension.disableLogin}
          disabled={actionContext?.has_login === false}
          onChange={(value) => setSuspension({ disableLogin: value })}
          label="Disable system login"
          hint={actionContext?.has_login === false ? "This employee has no login." : "Restored automatically on reactivation."}
        />
        <CheckRow
          checked={form.suspension.notifyManager}
          disabled={actionContext?.has_manager === false}
          onChange={(value) => setSuspension({ notifyManager: value })}
          label="Notify the line manager"
          hint={actionContext?.has_manager === false ? "No line manager is set." : undefined}
        />
      </RequirementCard>
    </>
  )
}

function ExitFields({
  form,
  update,
  stateOf,
  fieldErrors,
  checklistItems,
  checklistDescription,
  deferred,
}: SectionProps & {
  stateOf: (key: string) => StatusRequirementState
  checklistItems: ChecklistItem[]
  checklistDescription?: string
  deferred: boolean
}) {
  const setExit = (patch: Partial<FormState["exit"]>) => update((prev) => ({ ...prev, exit: { ...prev.exit, ...patch } }))
  const toggleStep = (stepId: number, checked: boolean) =>
    update((prev) => ({
      ...prev,
      exit: {
        ...prev.exit,
        completedStepIds: checked
          ? [...new Set([...prev.exit.completedStepIds, stepId])]
          : prev.exit.completedStepIds.filter((id) => id !== stepId),
      },
    }))
  const exitError = fieldErrors.exit

  return (
    <>
      <RequirementCard state={stateOf("exit_dates")} required title="Exit date and last working day">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1">
            <FieldLabel required>Exit date</FieldLabel>
            <DatePickerPresets value={form.exit.exitDate} onChange={(value) => setExit({ exitDate: value })} />
            <FieldError message={fieldErrors["exit.exit_date"]} />
          </label>
          <label className="grid min-w-0 gap-1">
            <FieldLabel required>Last working day</FieldLabel>
            <DatePickerPresets value={form.exit.lastWorkingDay} onChange={(value) => setExit({ lastWorkingDay: value })} />
            <FieldError
              message={
                fieldErrors["exit.last_working_day"] ??
                (form.exit.lastWorkingDay > form.exit.exitDate ? "Last working day cannot be after the exit date." : undefined)
              }
            />
          </label>
        </div>
      </RequirementCard>

      <RequirementCard state={stateOf("exit_reason")} required title="Exit reason">
        <FluentSelect
          ariaLabel="Exit reason"
          value={form.exit.reason}
          placeholder="Select a reason"
          onChange={(value) => setExit({ reason: value as ExitReason })}
          options={EXIT_REASON_OPTIONS}
        />
        {form.exit.reason === "other" ? (
          <label className="grid gap-1">
            <FieldLabel required>Details</FieldLabel>
            <input
              value={form.exit.reasonDetails}
              onChange={(event) => setExit({ reasonDetails: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Describe the reason"
            />
          </label>
        ) : null}
        <FieldError message={fieldErrors["exit.reason_details"] ?? fieldErrors["exit.reason"]} />
      </RequirementCard>

      <RequirementCard
        state={exitError || fieldErrors["exit.completed_step_ids"] ? "needs_input" : "optional"}
        title="Offboarding checklist"
        description={checklistDescription ?? "Tick items already done. The rest become tasks in the Offboarding tab."}
      >
        {checklistItems.length ? (
          <div className="grid gap-2">
            {checklistItems.map((item) => (
              <CheckRow
                key={item.step_id}
                checked={form.exit.completedStepIds.includes(item.step_id)}
                disabled={!item.can_complete_now}
                onChange={(checked) => toggleStep(item.step_id, checked)}
                label={item.title}
                hint={
                  !item.can_complete_now
                    ? "Needs evidence or runs automatically; complete it in the Offboarding tab."
                    : form.exit.completedStepIds.includes(item.step_id)
                      ? "Done now"
                      : `Pending task (${statusLabel(item.task_type)})`
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">The default offboarding workflow has no checklist items.</p>
        )}
        <FieldError message={fieldErrors["exit.completed_step_ids"] ?? exitError} />
      </RequirementCard>

      <RequirementCard state="complete" required title="Rehire eligibility">
        <Segmented<"yes" | "no">
          ariaLabel="Rehire eligibility"
          value={form.exit.rehireEligible ? "yes" : "no"}
          onChange={(value) => setExit({ rehireEligible: value === "yes" })}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
      </RequirementCard>

      {!deferred ? (
        <RequirementCard state="optional" title="Work schedule">
          <CheckRow
            checked={form.exit.endSchedule}
            onChange={(value) => setExit({ endSchedule: value })}
            label="End the current shift/timetable assignment on the exit date"
          />
        </RequirementCard>
      ) : null}
    </>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className={cn("flex items-start gap-2 text-sm", disabled && "opacity-60")}>
      <Checkbox
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <span className="min-w-0">
        <span className="text-slate-800">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  )
}

export type { StatusRequirement }
