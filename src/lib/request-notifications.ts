"use client"

import {
  createTestNotification,
  listAllCurrentCompanyUsers,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  canPerformPermission,
  decodeJwtPayload,
  readPermissionLabelsFromUnknown,
  type PermissionRequirement,
} from "@/lib/dashboard-permissions"

type RequestNotificationKind =
  | "profile_update_request"
  | "attendance_correction_request"
  | "leave_request"
  | "onboarding_request"
  | "offboarding_request"

type RequestNotificationConfig = {
  actionUrl: string
  category: "HR"
  entityType: RequestNotificationKind
  fallbackRequirement: PermissionRequirement | null
  priority: "MEDIUM" | "HIGH"
  relatedModule: string
  resolveTitle: (requesterLabel: string) => string
  resolveMessage: (requesterLabel: string) => string
  type: string
}

type NotifySubmittedRequestOptions = {
  kind: RequestNotificationKind
  loadRequest?: () => Promise<unknown>
  request: unknown
  requesterName?: string
  token: string
}

type LeaveRequestDecisionAction = "approve" | "reject" | "return_for_correction"

type NotifyLeaveRequestRequesterOptions = {
  action: LeaveRequestDecisionAction
  actorName?: string
  loadRequest?: () => Promise<unknown>
  request: unknown
  token: string
}

type RequestApprovalRecipient = {
  companyUserId: number | null
  level: number | null
  status: string
}

const NOTIFICATION_CONFIG: Record<RequestNotificationKind, RequestNotificationConfig> = {
  profile_update_request: {
    actionUrl: "/dashboard/employees/profile-update-approvals",
    category: "HR",
    entityType: "profile_update_request",
    fallbackRequirement: {
      permissions: [
        "self_service_requests:approve",
        "self_service_requests:update",
        "self_service_requests:read",
        "employees:update",
        "employees:read",
        "hr_profile_update_requests:approve",
        "hr_profile_update_requests:read",
      ],
      mode: "any",
    },
    priority: "HIGH",
    relatedModule: "employees",
    resolveTitle: (requesterLabel) => `${requesterLabel} submitted a profile update`,
    resolveMessage: (requesterLabel) =>
      `${requesterLabel} submitted profile changes that are waiting for approval.`,
    type: "profile_update_submitted",
  },
  attendance_correction_request: {
    actionUrl: "/dashboard/attendance/correction-requests",
    category: "HR",
    entityType: "attendance_correction_request",
    fallbackRequirement: {
      permissions: [
        "self_service_requests:approve",
        "self_service_requests:update",
        "self_service_requests:read",
        "attendance_corrections:approve",
        "attendance_corrections:update",
        "attendance_corrections:read",
        "attendance:update",
        "attendance:read",
      ],
      mode: "any",
    },
    priority: "HIGH",
    relatedModule: "attendance",
    resolveTitle: (requesterLabel) => `${requesterLabel} submitted an attendance correction`,
    resolveMessage: (requesterLabel) =>
      `${requesterLabel} submitted an attendance correction request that needs approval.`,
    type: "attendance_correction_submitted",
  },
  leave_request: {
    actionUrl: "/dashboard/leave-management/requests",
    category: "HR",
    entityType: "leave_request",
    fallbackRequirement: {
      permissions: [
        "leave_requests:approve",
        "leave_requests:update",
        "leave_requests:read",
        "leave_workflows:update",
        "leave_workflows:read",
        "leave:approve",
        "leave:update",
        "leave:read",
        "self_service_requests:approve",
      ],
      mode: "any",
    },
    priority: "MEDIUM",
    relatedModule: "leave_management",
    resolveTitle: (requesterLabel) => `${requesterLabel} submitted a leave request`,
    resolveMessage: (requesterLabel) =>
      `${requesterLabel} submitted a leave request that is waiting for review.`,
    type: "leave_request_submitted",
  },
  onboarding_request: {
    actionUrl: "/dashboard/employees/onboarding",
    category: "HR",
    entityType: "onboarding_request",
    fallbackRequirement: {
      permissions: [
        "onboarding_requests:approve",
        "onboarding_requests:update",
        "onboarding_requests:read",
        "onboarding_workflows:update",
        "onboarding_workflows:read",
        "employees:create",
        "employees:read",
      ],
      mode: "any",
    },
    priority: "HIGH",
    relatedModule: "employees",
    resolveTitle: (requesterLabel) => `Onboarding request submitted for ${requesterLabel}`,
    resolveMessage: (requesterLabel) =>
      `${requesterLabel}'s onboarding request is waiting for approval.`,
    type: "onboarding_request_submitted",
  },
  offboarding_request: {
    actionUrl: "/dashboard/employees/offboarding",
    category: "HR",
    entityType: "offboarding_request",
    fallbackRequirement: {
      permissions: [
        "offboarding_requests:approve",
        "offboarding_requests:update",
        "offboarding_requests:read",
        "offboarding_workflows:update",
        "offboarding_workflows:read",
        "employees:update",
        "employees:read",
      ],
      mode: "any",
    },
    priority: "HIGH",
    relatedModule: "employees",
    resolveTitle: (requesterLabel) => `Offboarding request submitted for ${requesterLabel}`,
    resolveMessage: (requesterLabel) =>
      `${requesterLabel}'s offboarding request is waiting for approval.`,
    type: "offboarding_request_submitted",
  },
}

const APPROVER_ROLE_HINTS = new Set([
  "admin",
  "administrator",
  "hr",
  "human resources",
  "human_resources",
  "human-resources",
  "manager",
  "line manager",
  "line_manager",
  "supervisor",
  "approver",
  "leave approver",
  "leave_approver",
  "super admin",
  "super_admin",
  "owner",
  "root",
])

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
}

function asRecordList(value: unknown): AdminRecord[] {
  return Array.isArray(value)
    ? value
        .map((entry) => asRecord(entry))
        .filter((entry): entry is AdminRecord => Boolean(entry))
    : []
}

function readNumber(record: AdminRecord | null, keys: string[]) {
  if (!record) {
    return null
  }

  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

function readString(record: AdminRecord | null, keys: string[]) {
  if (!record) {
    return ""
  }

  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ")
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))))
}

function unwrapRequestRecord(value: unknown): AdminRecord | null {
  const direct = asRecord(value)
  if (!direct) {
    return null
  }

  if (readRequestId(direct) !== null) {
    return direct
  }

  for (const key of ["data", "result", "item", "request", "payload", "record", "entity"]) {
    const nested = asRecord(direct[key])
    if (!nested) {
      continue
    }
    if (readRequestId(nested) !== null) {
      return nested
    }
  }

  return direct
}

function readRequestId(record: AdminRecord | null) {
  return readNumber(record, [
    "id",
    "request_id",
    "requestId",
    "leave_request_id",
    "leaveRequestId",
    "onboarding_request_id",
    "onboardingRequestId",
    "offboarding_request_id",
    "offboardingRequestId",
  ])
}

function readCurrentCompanyUserId(token: string) {
  const jwt = decodeJwtPayload(token)
  return readNumber(jwt, ["company_user_id", "companyUserId", "membership_id", "membershipId"])
}

function readCompanyUserId(record: AdminRecord | null) {
  if (!record) {
    return null
  }

  // Prefer explicit membership fields before bare `id` (which may be a platform user id).
  const explicit = readNumber(record, [
    "company_user_id",
    "companyUserId",
    "membership_id",
    "membershipId",
    "company_userId",
  ])
  if (explicit !== null) {
    return explicit
  }

  const nestedMembership =
    asRecord(record.company_user) ??
    asRecord(record.companyUser) ??
    asRecord(record.membership) ??
    asRecord(record.member)
  const nestedId = readNumber(nestedMembership, ["id", "company_user_id", "companyUserId"])
  if (nestedId !== null) {
    return nestedId
  }

  return readNumber(record, ["id"])
}

function readNestedCompanyUserId(record: AdminRecord | null) {
  if (!record) {
    return null
  }

  const direct = readNumber(record, [
    "requester_company_user_id",
    "requesterCompanyUserId",
    "employee_company_user_id",
    "employeeCompanyUserId",
    "owner_company_user_id",
    "ownerCompanyUserId",
    "created_by_company_user_id",
    "createdByCompanyUserId",
    "company_user_id",
    "companyUserId",
    "membership_id",
    "membershipId",
  ])
  if (direct !== null) {
    return direct
  }

  for (const key of [
    "requester",
    "requested_by",
    "requestedBy",
    "employee_company_user",
    "employeeCompanyUser",
    "company_user",
    "companyUser",
    "membership",
    "member",
  ]) {
    const nestedId = readCompanyUserId(asRecord(record[key]))
    if (nestedId !== null) {
      return nestedId
    }
  }

  return null
}

function readRequestEmployeeId(record: AdminRecord | null) {
  if (!record) {
    return null
  }

  const nestedEmployee = asRecord(record.employee)
  return (
    readNumber(record, ["employee_id", "employeeId", "requester_employee_id", "requesterEmployeeId"]) ??
    readNumber(nestedEmployee, ["id", "employee_id", "employeeId"])
  )
}

function readRequesterEmail(record: AdminRecord | null) {
  if (!record) {
    return ""
  }

  const nestedEmployee = asRecord(record.employee)
  const nestedUser = asRecord(nestedEmployee?.user)
  const nestedRequester = asRecord(record.requester) ?? asRecord(record.requested_by) ?? asRecord(record.requestedBy)

  return (
    readString(record, ["requester_email", "requesterEmail", "employee_email", "employeeEmail", "email"]) ||
    readString(nestedEmployee, ["email", "work_email", "workEmail"]) ||
    readString(nestedUser, ["email"]) ||
    readString(nestedRequester, ["email"])
  ).toLowerCase()
}

async function resolveRequesterCompanyUserId(token: string, request: AdminRecord | null) {
  if (!request) {
    return null
  }

  const nestedEmployee = asRecord(request.employee)
  const explicit =
    readNestedCompanyUserId(request) ??
    readNestedCompanyUserId(nestedEmployee)
  if (explicit !== null) {
    return explicit
  }

  const employeeId = readRequestEmployeeId(request)
  const requesterEmail = readRequesterEmail(request)
  if (employeeId === null && !requesterEmail) {
    return null
  }

  try {
    const companyUsers = await listAllCurrentCompanyUsers(token)
    const match = companyUsers.find((companyUser) => {
      const companyUserEmployee = asRecord(companyUser.employee)
      const companyUserUser = asRecord(companyUser.user)
      const candidateEmployeeId =
        readNumber(companyUser, ["employee_id", "employeeId"]) ??
        readNumber(companyUserEmployee, ["id", "employee_id", "employeeId"])
      if (employeeId !== null && candidateEmployeeId === employeeId) {
        return true
      }

      if (!requesterEmail) {
        return false
      }

      const candidateEmail = (
        readString(companyUser, ["email"]) ||
        readString(companyUserUser, ["email"]) ||
        readString(companyUserEmployee, ["email", "work_email", "workEmail"])
      ).toLowerCase()
      return Boolean(candidateEmail && candidateEmail === requesterEmail)
    })

    return readCompanyUserId(match ?? null)
  } catch (errorObject) {
    console.warn("[notifications] Failed to resolve requester company user.", errorObject)
    return null
  }
}

function readNestedRequesterName(record: AdminRecord | null) {
  if (!record) {
    return ""
  }

  const direct = readString(record, [
    "employee_name",
    "employeeName",
    "requester_name",
    "requesterName",
    "full_name",
    "fullName",
    "display_name",
    "displayName",
    "name",
  ])
  if (direct) {
    return direct
  }

  const nestedFirst = [
    "employee",
    "requester",
    "requested_by",
    "requestedBy",
    "user",
    "profile",
  ]
    .map((key) => asRecord(record[key]))
    .find((entry) => entry !== null)

  if (!nestedFirst) {
    return ""
  }

  return (
    readString(nestedFirst, [
      "full_name",
      "fullName",
      "display_name",
      "displayName",
      "employee_name",
      "employeeName",
      "name",
    ]) ||
    [
      readString(nestedFirst, ["first_name", "firstName", "preferred_name", "preferredName"]),
      readString(nestedFirst, ["middle_name", "middleName"]),
      readString(nestedFirst, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
  )
}

function readRequesterLabel(
  request: AdminRecord | null,
  token: string,
  preferredName?: string
) {
  if (preferredName && preferredName.trim()) {
    return preferredName.trim()
  }

  const requestName = readNestedRequesterName(request)
  if (requestName) {
    return requestName
  }

  const jwt = decodeJwtPayload(token)
  const jwtName =
    readString(jwt, ["name", "full_name", "fullName", "display_name", "displayName"]) ||
    [
      readString(jwt, ["first_name", "firstName"]),
      readString(jwt, ["middle_name", "middleName"]),
      readString(jwt, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
  if (jwtName) {
    return jwtName
  }

  return "An employee"
}

function appendRequestHighlight(url: string, requestId: number) {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}highlight=${encodeURIComponent(String(requestId))}`
}

function isPendingApprovalStatus(status: string) {
  const normalized = normalizeStatus(status)
  if (!normalized) {
    return true
  }
  if (
    ["approved", "rejected", "cancelled", "canceled", "completed", "skipped", "withdrawn"].includes(
      normalized
    )
  ) {
    return false
  }
  return (
    normalized === "pending" ||
    normalized.includes("pending") ||
    normalized.includes("awaiting") ||
    normalized.includes("waiting") ||
    normalized.includes("in progress") ||
    normalized.includes("open") ||
    normalized.includes("review")
  )
}

function extractLeaveApprovalRecipients(request: AdminRecord | null) {
  if (!request) {
    return []
  }

  const approvals = asRecordList(request.approvals)
    .map((approval) => {
      const approver = asRecord(approval.approver)
      return {
        companyUserId:
          readNumber(approval, [
            "approver_company_user_id",
            "approverCompanyUserId",
            "assigned_company_user_id",
            "assignedCompanyUserId",
            "company_user_id",
            "companyUserId",
          ]) ?? readCompanyUserId(approver),
        level: readNumber(approval, ["approval_level", "approvalLevel", "level", "step"]),
        status: normalizeStatus(readString(approval, ["status"]) || "pending"),
      } satisfies RequestApprovalRecipient
    })
    .filter((approval) => approval.companyUserId !== null)

  const pendingApprovals = approvals.filter((approval) => isPendingApprovalStatus(approval.status))
  if (pendingApprovals.length === 0) {
    return []
  }

  const currentLevel = readNumber(request, [
    "current_approval_level",
    "currentApprovalLevel",
    "current_level",
    "currentLevel",
  ])
  const effectiveLevel =
    currentLevel ??
    pendingApprovals
      .map((approval) => approval.level)
      .filter((level): level is number => level !== null)
      .sort((left, right) => left - right)[0] ??
    null

  const activeApprovals =
    effectiveLevel === null
      ? pendingApprovals
      : pendingApprovals.filter((approval) => approval.level === effectiveLevel)

  return uniqueNumbers(
    activeApprovals
      .map((approval) => approval.companyUserId)
      .filter((companyUserId): companyUserId is number => companyUserId !== null)
  )
}

function collectExplicitRecipientIds(value: unknown, sink: Set<number>, depth = 0) {
  if (depth > 4) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectExplicitRecipientIds(entry, sink, depth + 1))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const directCompanyUserId = readNumber(record, [
    "approver_company_user_id",
    "approverCompanyUserId",
    "assigned_company_user_id",
    "assignedCompanyUserId",
    "reviewer_company_user_id",
    "reviewerCompanyUserId",
    "current_approver_company_user_id",
    "currentApproverCompanyUserId",
    "hr_company_user_id",
    "hrCompanyUserId",
    "manager_company_user_id",
    "managerCompanyUserId",
  ])
  if (directCompanyUserId !== null) {
    sink.add(directCompanyUserId)
  }

  for (const key of [
    "approver",
    "reviewer",
    "assigned_user",
    "assignedUser",
    "current_approver",
    "currentApprover",
    "handler",
    "hr_user",
    "hrUser",
    "manager",
    "line_manager",
    "lineManager",
    "company_user",
    "companyUser",
  ]) {
    const nested = asRecord(record[key])
    const nestedCompanyUserId = readCompanyUserId(nested)
    if (nestedCompanyUserId !== null) {
      sink.add(nestedCompanyUserId)
    }
  }

  for (const key of [
    "approvals",
    "pending_approvals",
    "pendingApprovals",
    "current_approvals",
    "currentApprovals",
    "approvers",
    "reviewers",
    "assignees",
    "workflow_steps",
    "workflowSteps",
    "approval_steps",
    "approvalSteps",
  ]) {
    collectExplicitRecipientIds(record[key], sink, depth + 1)
  }
}

function resolveRequestRecipientIds(request: AdminRecord | null, kind: RequestNotificationKind) {
  if (!request) {
    return []
  }

  if (kind === "leave_request") {
    const leaveRecipients = extractLeaveApprovalRecipients(request)
    if (leaveRecipients.length > 0) {
      return leaveRecipients
    }
  }

  const recipients = new Set<number>()
  collectExplicitRecipientIds(request, recipients)
  return uniqueNumbers(Array.from(recipients))
}

function companyUserLooksLikeApprover(companyUser: AdminRecord) {
  const identityHints = new Set<string>()
  const pushHint = (value: string) => {
    const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ")
    if (normalized) {
      identityHints.add(normalized)
    }
  }

  for (const key of ["role", "user_type", "userType", "type", "title", "job_title", "jobTitle"]) {
    const value = readString(companyUser, [key])
    if (value) {
      pushHint(value)
    }
  }

  for (const key of ["roles", "role_assignments", "roleAssignments"]) {
    const list = companyUser[key]
    if (!Array.isArray(list)) {
      continue
    }
    for (const entry of list) {
      if (typeof entry === "string") {
        pushHint(entry)
        continue
      }
      const record = asRecord(entry)
      if (!record) {
        continue
      }
      const nestedRole = asRecord(record.role)
      const roleName =
        readString(record, ["name", "key", "code", "slug", "title"]) ||
        readString(nestedRole, ["name", "key", "code", "slug", "title"])
      if (roleName) {
        pushHint(roleName)
      }
    }
  }

  return Array.from(identityHints).some((hint) => APPROVER_ROLE_HINTS.has(hint))
}

async function resolveFallbackRecipientIds(
  token: string,
  requirement: PermissionRequirement | null,
  excludeCompanyUserId: number | null
) {
  try {
    const companyUsers = await listAllCurrentCompanyUsers(token)
    const matchingUsers = companyUsers.filter((companyUser) => {
      if (requirement && canPerformPermission(readPermissionLabelsFromUnknown(companyUser), requirement)) {
        return true
      }
      return companyUserLooksLikeApprover(companyUser)
    })

    return uniqueNumbers(
      matchingUsers
        .map((companyUser) => readCompanyUserId(companyUser))
        .filter((companyUserId): companyUserId is number => companyUserId !== null)
        .filter((companyUserId) => companyUserId !== excludeCompanyUserId)
    )
  } catch (errorObject) {
    console.warn("[notifications] Failed to resolve fallback approver recipients.", errorObject)
    return []
  }
}

export async function notifySubmittedRequestApprovers(
  options: NotifySubmittedRequestOptions
) {
  // Onboarding notifications are sequenced by the backend alongside tasks.
  // A client fallback must not broadcast to future approvers or unrelated HR users.
  if (options.kind === "onboarding_request") return 0
  const config = NOTIFICATION_CONFIG[options.kind]
  const senderCompanyUserId = readCurrentCompanyUserId(options.token)

  try {
    let request = unwrapRequestRecord(options.request)
    let requestId = readRequestId(request)
    let recipientIds = resolveRequestRecipientIds(request, options.kind).filter(
      (companyUserId) => companyUserId !== senderCompanyUserId
    )

    // Always re-fetch when possible so workflow approvals are available after submit.
    if (options.loadRequest) {
      try {
        const loaded = unwrapRequestRecord(await options.loadRequest())
        if (loaded) {
          request = loaded
          requestId = readRequestId(loaded) ?? requestId
          recipientIds = resolveRequestRecipientIds(loaded, options.kind).filter(
            (companyUserId) => companyUserId !== senderCompanyUserId
          )
        }
      } catch (errorObject) {
        console.warn(
          `[notifications] Failed to load ${options.kind} detail before notifying approvers.`,
          errorObject
        )
      }
    }

    if (recipientIds.length === 0) {
      recipientIds = await resolveFallbackRecipientIds(
        options.token,
        config.fallbackRequirement,
        senderCompanyUserId
      )
    }

    if (requestId === null) {
      console.warn(
        `[notifications] Skipping ${config.entityType} notification — request id could not be resolved.`,
        options.request
      )
      return 0
    }

    if (recipientIds.length === 0) {
      console.warn(
        `[notifications] Skipping ${config.entityType} ${String(
          requestId
        )} notification — no approver recipients resolved.`
      )
      return 0
    }

    const requesterLabel = readRequesterLabel(request, options.token, options.requesterName)
    const baseDedupeKey = `${config.entityType}:${requestId}:submitted`
    const results = await Promise.allSettled(
      recipientIds.map((receiverCompanyUserId) =>
        createTestNotification(options.token, {
          receiver_company_user_id: receiverCompanyUserId,
          title: config.resolveTitle(requesterLabel),
          message: config.resolveMessage(requesterLabel),
          type: config.type,
          category: config.category,
          priority: config.priority,
          related_module: config.relatedModule,
          entity_type: config.entityType,
          entity_id: String(requestId),
          action_url: appendRequestHighlight(config.actionUrl, requestId),
          dedupe_key: `${baseDedupeKey}:${receiverCompanyUserId}`,
          metadata: {
            entity_type: config.entityType,
            related_module: config.relatedModule,
            request_id: requestId,
            highlight: requestId,
            requester_name: requesterLabel,
          },
        })
      )
    )

    const successCount = results.filter((result) => result.status === "fulfilled").length
    if (successCount === 0) {
      console.warn(
        `[notifications] No approver notifications were delivered for ${config.entityType} ${String(
          requestId
        )}.`,
        results
      )
    } else if (process.env.NODE_ENV === "development") {
      console.debug(
        `[notifications] Delivered ${successCount}/${recipientIds.length} notifications for ${config.entityType} ${String(
          requestId
        )}.`
      )
    }
    return successCount
  } catch (errorObject) {
    console.warn(
      `[notifications] Failed to notify approvers for ${config.entityType}.`,
      errorObject
    )
    return 0
  }
}

export async function notifyLeaveRequestRequester(
  options: NotifyLeaveRequestRequesterOptions
) {
  const senderCompanyUserId = readCurrentCompanyUserId(options.token)
  const actionLabel =
    options.action === "approve"
      ? "approved"
      : options.action === "reject"
        ? "rejected"
        : "returned for correction"

  try {
    let request = unwrapRequestRecord(options.request)
    let requestId = readRequestId(request)

    if (options.loadRequest) {
      try {
        const loaded = unwrapRequestRecord(await options.loadRequest())
        if (loaded) {
          request = loaded
          requestId = readRequestId(loaded) ?? requestId
        }
      } catch (errorObject) {
        console.warn("[notifications] Failed to load leave request detail before notifying requester.", errorObject)
      }
    }

    if (requestId === null) {
      console.warn("[notifications] Skipping leave requester notification — request id could not be resolved.")
      return 0
    }

    const receiverCompanyUserId = await resolveRequesterCompanyUserId(options.token, request)
    if (receiverCompanyUserId === null || receiverCompanyUserId === senderCompanyUserId) {
      console.warn(
        `[notifications] Skipping leave request ${String(requestId)} ${actionLabel} notification — requester recipient could not be resolved or is the actor.`
      )
      return 0
    }

    const actorLabel = options.actorName?.trim() || "An approver"
    const leaveNo = readString(request, ["leave_no", "leaveNo", "request_no", "requestNo"])
    const requestLabel = leaveNo || `leave request #${requestId}`
    await createTestNotification(options.token, {
      receiver_company_user_id: receiverCompanyUserId,
      title: `Your leave request was ${actionLabel}`,
      message: `${actorLabel} ${actionLabel} ${requestLabel}.`,
      type: `leave_request_${options.action === "return_for_correction" ? "returned" : actionLabel}`,
      category: "HR",
      priority: options.action === "approve" ? "MEDIUM" : "HIGH",
      related_module: "leave_management",
      entity_type: "leave_request",
      entity_id: String(requestId),
      action_url: appendRequestHighlight("/dashboard/me/leave/requests", requestId),
      dedupe_key: `leave_request:${requestId}:${options.action}:requester:${receiverCompanyUserId}:${Date.now()}`,
      metadata: {
        entity_type: "leave_request",
        related_module: "leave_management",
        request_id: requestId,
        highlight: requestId,
        action: options.action,
        actor_name: actorLabel,
      },
    })

    return 1
  } catch (errorObject) {
    console.warn("[notifications] Failed to notify requester for leave approval action.", errorObject)
    return 0
  }
}
