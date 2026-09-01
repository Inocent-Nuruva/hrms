import type {
  EmployeeOnboardingInput,
  OnboardingAttendanceMode,
  OnboardingProvisioning,
} from "@/lib/admin-api"

export type OnboardingShiftAssignmentDraft = {
  shiftId: string
  effectiveFrom: string
  effectiveTo: string
  rotationGroupId: string
  isPrimary: boolean
}

export type OnboardingTimetableAssignmentDraft = {
  timetableId: string
  effectiveFrom: string
  effectiveTo: string
}

export type OnboardingDeviceAssignmentDraft = {
  enabled: boolean
  employeeNo: string
  accessGroupId: string
  organizationId: string
  validEnabled: boolean
  validBeginTime: string
  validEndTime: string
  localUiRight: boolean
  closeDelayEnabled: boolean
  maxOpenDoorTime: string
  openDoorTime: string
  userVerifyMode: string
  deviceIds: number[]
  syncNow: boolean
  continueOnError: boolean
}

export type OnboardingProvisioningDraft = {
  roleIds: number[]
  branchAccessIds: number[]
  attendanceMode: "" | OnboardingAttendanceMode
  shiftAssignment: OnboardingShiftAssignmentDraft
  timetableAssignment: OnboardingTimetableAssignmentDraft
  deviceAssignment: OnboardingDeviceAssignmentDraft
}

type BuildProvisioningResult = {
  error?: string
  provisioning?: OnboardingProvisioning
}

type BuildEmployeeOnboardingInputArgs = {
  enabled: boolean
  autoStart: boolean
  workflowId: string
  title: string
  description: string
  plannedStartDate: string
  plannedCompletionDate: string
  submit: boolean
  fallbackEmployeeNo?: string
  provisioningDraft: OnboardingProvisioningDraft
}

function toOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildOnboardingProvisioningPayload(
  draft: OnboardingProvisioningDraft,
  options: { fallbackEmployeeNo?: string } = {}
): BuildProvisioningResult {
  if (draft.attendanceMode === "shift" && !draft.shiftAssignment.shiftId) {
    return { error: "Shift assignment is required when attendance mode is shift." }
  }

  if (draft.attendanceMode === "timetable" && !draft.timetableAssignment.timetableId) {
    return { error: "Timetable assignment is required when attendance mode is timetable." }
  }

  if (draft.deviceAssignment.enabled) {
    if (!draft.deviceAssignment.accessGroupId) {
      return { error: "Access group is required when device setup is enabled." }
    }
    if (draft.deviceAssignment.deviceIds.length === 0) {
      return { error: "Select at least one device when device setup is enabled." }
    }
  }

  const provisioning: OnboardingProvisioning = {}
  const normalizedRoleIds = draft.roleIds.filter((value) => Number.isFinite(value))
  const normalizedBranchAccessIds = draft.branchAccessIds.filter((value) => Number.isFinite(value))

  if (normalizedRoleIds.length > 0) {
    provisioning.role_ids = normalizedRoleIds
  }

  if (normalizedBranchAccessIds.length > 0) {
    provisioning.branch_access_ids = normalizedBranchAccessIds
  }

  if (draft.attendanceMode) {
    provisioning.attendance_mode = draft.attendanceMode
  }

  if (draft.attendanceMode === "shift") {
    const shiftId = toOptionalNumber(draft.shiftAssignment.shiftId)
    if (shiftId === null) {
      return { error: "Select a valid shift assignment." }
    }

    const rotationGroupId = toOptionalNumber(draft.shiftAssignment.rotationGroupId)
    if (rotationGroupId === null) {
      return { error: "Select a valid rotation group." }
    }

    provisioning.shift_assignment = {
      shift_id: shiftId!,
      effective_from: draft.shiftAssignment.effectiveFrom || undefined,
      effective_to: draft.shiftAssignment.effectiveTo || undefined,
      rotation_group_id: rotationGroupId,
      is_primary: draft.shiftAssignment.isPrimary,
    }
  }

  if (draft.attendanceMode === "timetable") {
    const timetableId = toOptionalNumber(draft.timetableAssignment.timetableId)
    if (timetableId === null) {
      return { error: "Select a valid timetable assignment." }
    }

    provisioning.timetable_assignment = {
      timetable_id: timetableId!,
      effective_from: draft.timetableAssignment.effectiveFrom || undefined,
      effective_to: draft.timetableAssignment.effectiveTo || undefined,
    }
  }

  if (draft.deviceAssignment.enabled) {
    const accessGroupId = toOptionalNumber(draft.deviceAssignment.accessGroupId)
    if (accessGroupId === null) {
      return { error: "Select a valid access group." }
    }

    const organizationId = toOptionalNumber(draft.deviceAssignment.organizationId)
    if (organizationId === null) {
      return { error: "Select a valid organization." }
    }

    const maxOpenDoorTime = toOptionalNumber(draft.deviceAssignment.maxOpenDoorTime)
    if (maxOpenDoorTime === null) {
      return { error: "Max open door time must be a valid number." }
    }

    const openDoorTime = toOptionalNumber(draft.deviceAssignment.openDoorTime)
    if (openDoorTime === null) {
      return { error: "Open door time must be a valid number." }
    }

    provisioning.device_assignment = {
      employee_no:
        draft.deviceAssignment.employeeNo.trim() || options.fallbackEmployeeNo?.trim() || undefined,
      access_group_id: accessGroupId!,
      organization_id: organizationId ?? undefined,
      valid_enabled: draft.deviceAssignment.validEnabled,
      valid_begin_time: draft.deviceAssignment.validBeginTime || undefined,
      valid_end_time: draft.deviceAssignment.validEndTime || undefined,
      local_ui_right: draft.deviceAssignment.localUiRight,
      close_delay_enabled: draft.deviceAssignment.closeDelayEnabled,
      max_open_door_time: maxOpenDoorTime ?? undefined,
      open_door_time: openDoorTime ?? undefined,
      user_verify_mode: draft.deviceAssignment.userVerifyMode.trim() || undefined,
      device_ids: draft.deviceAssignment.deviceIds,
      sync_now: draft.deviceAssignment.syncNow,
      continue_on_error: draft.deviceAssignment.continueOnError,
    }
  }

  if (Object.keys(provisioning).length === 0) {
    return {}
  }

  return { provisioning }
}

export function buildEmployeeOnboardingInput(
  args: BuildEmployeeOnboardingInputArgs
): { error?: string; onboarding?: EmployeeOnboardingInput } {
  const hasWorkflow =
    Boolean(args.workflowId?.trim()) && args.workflowId.trim() !== "none"

  // Explicitly disable auto-start so a company default workflow is not submitted
  // during employee create when onboarding was left optional.
  if (!args.enabled || !hasWorkflow) {
    return {
      onboarding: {
        auto_start: false,
        submit: false,
      },
    }
  }

  const workflowId = args.workflowId ? toOptionalNumber(args.workflowId) : undefined
  if (workflowId === null) {
    return { error: "Select a valid onboarding workflow." }
  }

  const { error, provisioning } = buildOnboardingProvisioningPayload(args.provisioningDraft, {
    fallbackEmployeeNo: args.fallbackEmployeeNo,
  })
  if (error) {
    return { error }
  }

  return {
    onboarding: {
      auto_start: args.autoStart,
      workflow_id: workflowId,
      title: args.title.trim() || undefined,
      description: args.description.trim() || undefined,
      planned_start_date: args.plannedStartDate || undefined,
      planned_completion_date: args.plannedCompletionDate || undefined,
      submit: args.submit,
      provisioning,
    },
  }
}
