"use client"

import * as React from "react"
import {
  CalendarDays,
  Clock3,
  Coins,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"

import { TalentDoodle, TalentDoodleSprites } from "@/components/dashboard/talent-visuals"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  attachedLeavePolicyTypes,
  formatPolicyDays,
  hasPolicyAdvancedRules,
  hasPolicyCoverageLimits,
  leavePolicyAccrualLabel,
  leavePolicyCoverageParts,
  leavePolicyTreatmentLabel,
  leavePolicyTypeLabel,
  leavePolicyYesNo,
  type LeavePolicyFormValue,
  type LeavePolicyOption,
} from "@/lib/leave-policy-form"
import { cn } from "@/lib/utils"

type LeavePolicyPreviewSheetProps = {
  open: boolean
  loading?: boolean
  value: LeavePolicyFormValue | null
  leaveTypeOptions: LeavePolicyOption[]
  branchOptions: LeavePolicyOption[]
  departmentOptions: LeavePolicyOption[]
  positionOptions: LeavePolicyOption[]
  gradeOptions: LeavePolicyOption[]
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
}

function Fact({
  label,
  value,
  accent = false,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border px-2 py-1.5",
        accent
          ? "border-primary/20 bg-primary/5"
          : "border-slate-200 bg-white dark:border-border dark:bg-background",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-slate-900 dark:text-white" title={String(value)}>
        {value || "—"}
      </p>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3" />
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{title}</h3>
          {hint ? <p className="text-[10px] leading-tight text-slate-500">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export function LeavePolicyPreviewSheet({
  open,
  loading = false,
  value,
  leaveTypeOptions,
  branchOptions,
  departmentOptions,
  positionOptions,
  gradeOptions,
  canEdit,
  onOpenChange,
  onEdit,
}: LeavePolicyPreviewSheetProps) {
  const attachedTypes = value ? attachedLeavePolicyTypes(value) : []
  const coverageParts = value
    ? leavePolicyCoverageParts(value, {
        branches: branchOptions,
        departments: departmentOptions,
        positions: positionOptions,
        grades: gradeOptions,
      })
    : []
  const coverageSummary = coverageParts.length ? coverageParts.join(" · ") : "Everyone"
  const showAdvanced = value ? hasPolicyAdvancedRules(value) : false
  const narrowed = value ? hasPolicyCoverageLimits(value) : false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg data-[side=right]:sm:max-w-lg"
      >
        <header className="relative shrink-0 overflow-hidden bg-primary px-4 py-3 pr-11 text-white">
          <TalentDoodleSprites />
          <TalentDoodle />
          <div className="relative z-10 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  Leave policy
                </p>
                <SheetTitle className="mt-0.5 text-sm font-semibold tracking-tight text-white">
                  {value?.name.trim() || "Policy details"}
                </SheetTitle>
                <SheetDescription className="mt-0.5 max-w-md text-[11px] leading-snug text-white/80">
                  {value?.description.trim() || "Every rule, quota, and coverage saved on this policy."}
                </SheetDescription>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="inline-flex h-5 items-center rounded-full bg-white/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide">
                  {value?.status === "inactive" ? "Inactive" : "Active"}
                </span>
                <span className="inline-flex h-5 items-center rounded-full bg-white px-1.5 text-[10px] font-semibold text-primary">
                  {leavePolicyAccrualLabel(value?.accrual_method ?? "yearly")}
                  {value && value.accrual_method !== "manual" ? ` · ${value.accrual_rate}d` : ""}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Leave types", value: String(attachedTypes.length) },
                { label: "Coverage", value: narrowed ? "Limited" : "Everyone" },
                { label: "Longest stretch", value: formatPolicyDays(value?.max_consecutive_days ?? "") },
              ].map((stat) => (
                <div key={stat.label} className="rounded-md bg-white/10 px-2 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70">{stat.label}</p>
                  <p className="truncate text-xs font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="pointer-events-none absolute inset-x-4 top-3 z-10 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
              Loading the full policy…
            </div>
          ) : null}

          {value ? (
            <div className="space-y-3.5">
              <Section icon={Sparkles} title="Leave types" hint="Yearly quotas and extra caps attached to this policy.">
                {attachedTypes.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500">
                    No leave types are attached to this policy.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {attachedTypes.map((assignment, index) => {
                      const label = leavePolicyTypeLabel(assignment, leaveTypeOptions)
                      return (
                        <div
                          key={`${assignment.leave_type_id || label}-${index}`}
                          className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-background"
                        >
                          <div className="flex items-stretch gap-0">
                            <div className="flex min-w-14 flex-col items-center justify-center bg-primary px-2 py-1.5 text-white">
                              <span className="text-sm font-semibold tabular-nums leading-none">
                                {assignment.annual_quota_days || "0"}
                              </span>
                              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80">
                                days / yr
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 px-2.5 py-1.5">
                              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{label}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700">
                                  {assignment.requires_approval === "true" ? "Approval" : "No approval"}
                                </span>
                                {assignment.encashment_enabled === "true" ? (
                                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-amber-50 px-1.5 text-[10px] font-medium text-amber-800">
                                    <Coins className="size-2.5" />
                                    Encashment
                                  </span>
                                ) : null}
                                {Number(assignment.max_per_request_days) > 0 ? (
                                  <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700">
                                    Max {assignment.max_per_request_days}/req
                                  </span>
                                ) : null}
                                {Number(assignment.maximum_accumulation_days) > 0 ? (
                                  <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700">
                                    Carry {assignment.maximum_accumulation_days}d
                                  </span>
                                ) : null}
                              </div>
                              {assignment.encashment_enabled === "true" ? (
                                <p className="mt-1 text-[10px] text-slate-500">
                                  Cash up to {assignment.maximum_encashment_days || "0"}d, keep at least{" "}
                                  {assignment.minimum_balance_after_encashment || "0"}d
                                  {assignment.encashment_requires_approval === "true" ? ", approval needed" : ""}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              <Section icon={Users} title="Who it covers" hint={narrowed ? coverageSummary : "Applies company-wide."}>
                {narrowed ? (
                  <div className="flex flex-wrap gap-1">
                    {coverageParts.map((part) => (
                      <span
                        key={part}
                        className="inline-flex h-5 items-center rounded-full border border-primary/20 bg-primary/5 px-2 text-[10px] font-semibold text-primary"
                      >
                        {part}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-border dark:bg-muted/40 dark:text-slate-200">
                    Everyone in the company
                  </div>
                )}
              </Section>

              <Section icon={CalendarDays} title="Day rules" hint="How days are counted when someone requests leave.">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  <Fact label="Longest stretch" value={formatPolicyDays(value.max_consecutive_days)} accent />
                  <Fact label="Weekly offs" value={leavePolicyTreatmentLabel(value.weekly_off_treatment)} />
                  <Fact label="Holidays" value={leavePolicyTreatmentLabel(value.holiday_treatment)} />
                  <Fact label="During probation" value={leavePolicyYesNo(value.allow_during_probation)} />
                  <Fact label="Half day" value={value.allow_half_day === "true" ? "Allowed" : "Not allowed"} />
                  <Fact label="Short leave" value={value.allow_short_leave === "true" ? "Allowed" : "Not allowed"} />
                  {value.allow_short_leave === "true" ? (
                    <>
                      <Fact label="Min short leave" value={`${value.minimum_short_leave_minutes} min`} />
                      <Fact label="Max short leave" value={`${value.maximum_short_leave_minutes} min`} />
                    </>
                  ) : null}
                </div>
              </Section>

              {showAdvanced ? (
                <Section icon={ShieldCheck} title="Extra rules" hint="Notice, cancellation, carry-over, and attendance.">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    <Fact label="Service months" value={value.min_service_months} />
                    <Fact label="Notice days" value={formatPolicyDays(value.minimum_notice_days)} />
                    <Fact label="Backdate days" value={formatPolicyDays(value.maximum_backdate_days)} />
                    <Fact
                      label="Negative balance"
                      value={value.allow_negative_balance === "true" ? "Allowed" : "Not allowed"}
                    />
                    <Fact label="Cancel needs approval" value={leavePolicyYesNo(value.cancellation_requires_approval)} />
                    <Fact label="Cancel cutoff" value={formatPolicyDays(value.cancellation_cutoff_days)} />
                    <Fact label="Max accumulation" value={formatPolicyDays(value.maximum_accumulation_days)} />
                    <Fact label="Priority" value={value.priority} />
                    <Fact
                      label="Deduct from attendance"
                      value={leavePolicyYesNo(value.attendance_balance_deduction_enabled)}
                    />
                    {value.attendance_balance_deduction_enabled === "true" ? (
                      <>
                        <Fact label="Absent day" value={formatPolicyDays(value.absent_day_deduction_days)} />
                        <Fact label="Unpaid day" value={formatPolicyDays(value.unpaid_leave_day_deduction_days)} />
                        <Fact label="Half-day deduction" value={formatPolicyDays(value.half_day_deduction_days)} />
                      </>
                    ) : null}
                  </div>
                </Section>
              ) : (
                <Section icon={Clock3} title="Extra rules" hint="No extra notice, cancellation, or attendance rules were set.">
                  <div className="rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-500">
                    Defaults only. Open the editor if you want to add notice, cancellation, or attendance deductions.
                  </div>
                </Section>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select a leave policy to review it.</p>
          )}
        </div>

        <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-end gap-1.5 border-t border-border bg-white px-4 py-2 dark:bg-background">
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Close
          </button>
          {canEdit ? (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-white transition hover:brightness-95"
              onClick={onEdit}
            >
              Open in editor
            </button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
