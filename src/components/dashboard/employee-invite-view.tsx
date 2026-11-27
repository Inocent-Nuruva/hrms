"use client"

import { PageHeader } from "@/components/ui/page-header"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { InfoIcon, MailIcon, RotateCcwIcon, UserPlus2Icon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"
import {
} from "@fluentui/react-components"

import {
  createEmployeeInvitation,
  getEmployeeInvitationPositionCapacity,
  listBranches,
  listDepartmentPositions,
  listDepartments,
  listEmployees,
  listOnboardingWorkflows,
  listPositions,
  type AdminRecord,
  type CreateEmployeeInvitationPayload,
  type PositionCapacity,
} from "@/lib/admin-api"
import { positionCapacityWarning } from "@/lib/position-capacity"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { Button } from "@/components/ui/button"
import { Dropdown, Option } from "@/components/ui/dropdown"
import { Input as FluentInput } from "@/components/ui/input"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Skeleton } from "@/components/ui/skeleton"
import {
  invitationChannels,
  invitationDeliveryOutcome,
} from "@/lib/employee-invitation-channels"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { FormField } from "@/components/ui/form-field"
import { PhoneInput, isValidPhone } from "@/components/ui/phone-input"
import { Checkbox } from "@/components/ui/checkbox"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const INVITE_DRAFT_STORAGE_KEY = "hrms.employee.invite.draft.v1"

type StoredInviteDraft = {
  firstName?: string
  lastName?: string
  gender?: string
  email?: string
  phone?: string
  branchId?: number | null
  departmentId?: number | null
  positionId?: number | null
  reportsToId?: number | null
  employmentType?: string
  hireDate?: string
  workflowId?: number | null
  savedAt?: string
}

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const

const EMPLOYMENT_TYPES: ReadonlyArray<{
  value: CreateEmployeeInvitationPayload["employment_type"]
  label: string
}> = [
  { value: "full_time", label: "Permanent" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "temporary", label: "Temporary" },
  { value: "probation", label: "Probation" },
]

type LookupOption = {
  id: number
  label: string
  branchId: number | null
  departmentId: number | null
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null
    ? (value as AdminRecord)
    : null
}

function readStoredToken(): string {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) return direct
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) return ""
  try {
    const parsed = JSON.parse(authTokensRaw) as {
      accessToken?: string
      access_token?: string
    }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function getId(record: AdminRecord): number | null {
  const nested =
    typeof record.employee === "object" && record.employee !== null
      ? (record.employee as AdminRecord)
      : null
  const candidates = [record, nested]
  const keys = ["id", "employee_id", "employeeId", "request_id", "requestId"]
  for (const source of candidates) {
    if (!source) continue
    for (const k of keys) {
      const v = source[k]
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return v
      if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
        const parsed = Number(v)
        if (parsed > 0) return parsed
      }
    }
  }
  return null
}

function getName(record: AdminRecord, ...keys: string[]): string {
  for (const k of keys) {
    const v = record[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  for (const k of [
    "fullName",
    "full_name",
    "displayName",
    "display_name",
    "name",
  ]) {
    const v = record[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  const first =
    (typeof record.first_name === "string" && record.first_name) ||
    (typeof record.firstName === "string" && record.firstName) ||
    ""
  const middle =
    (typeof record.middle_name === "string" && record.middle_name) ||
    (typeof record.middleName === "string" && record.middleName) ||
    ""
  const last =
    (typeof record.last_name === "string" && record.last_name) ||
    (typeof record.lastName === "string" && record.lastName) ||
    ""
  const full = [first, middle, last].filter(Boolean).join(" ").trim()
  if (full) return full
  const employeeNo =
    (typeof record.employeeNo === "string" && record.employeeNo.trim()) ||
    (typeof record.employee_no === "string" && record.employee_no.trim()) ||
    ""
  if (employeeNo) return employeeNo
  const id = getId(record)
  return id !== null ? `Employee #${id}` : "—"
}

function readNumberish(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (
    typeof value === "string" &&
    value.trim() &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value)
  }
  return null
}

function readRelatedId(record: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const direct = record[key]
    if (typeof direct === "number" && Number.isFinite(direct)) {
      return direct
    }
    if (
      typeof direct === "string" &&
      direct.trim() &&
      !Number.isNaN(Number(direct))
    ) {
      return Number(direct)
    }
    if (typeof direct === "object" && direct !== null) {
      const nestedId = getId(direct as AdminRecord)
      if (nestedId !== null) {
        return nestedId
      }
    }
  }
  return null
}

function relatedDepartmentIds(record: AdminRecord) {
  const ids = new Set<number>()

  for (const value of [
    record.department_id,
    record.departmentId,
    record.primary_department_id,
    record.primaryDepartmentId,
  ]) {
    const id = readNumberish(value)
    if (id !== null) ids.add(id)
  }

  for (const key of [
    "department",
    "departmentDetail",
    "primary_department",
    "primaryDepartment",
  ]) {
    const nestedId = getId(asRecord(record[key]) ?? {})
    if (nestedId !== null) ids.add(nestedId)
  }

  const directIds = Array.isArray(record.department_ids)
    ? record.department_ids
    : Array.isArray(record.departmentIds)
      ? record.departmentIds
      : []
  for (const value of directIds) {
    const id = readNumberish(value)
    if (id !== null) ids.add(id)
  }

  const assignments = Array.isArray(record.departments)
    ? record.departments
    : []
  for (const value of assignments) {
    const directAssignmentId = readNumberish(value)
    if (
      directAssignmentId !== null &&
      (typeof value === "number" || typeof value === "string")
    ) {
      ids.add(directAssignmentId)
      continue
    }
    const assignment = asRecord(value)
    if (!assignment) continue
    const nestedDepartment =
      asRecord(assignment.department) ?? asRecord(assignment.departmentDetail)
    const id =
      readNumberish(assignment.department_id) ??
      readNumberish(assignment.departmentId) ??
      getId(nestedDepartment ?? {}) ??
      getId(assignment)
    if (id !== null) ids.add(id)
  }

  return ids
}

function relatedBranchId(record: AdminRecord) {
  return (
    getId(asRecord(record.branch) ?? {}) ??
    getId(asRecord(record.primary_branch) ?? {}) ??
    getId(asRecord(record.primaryBranch) ?? {}) ??
    readNumberish(record.branch_id) ??
    readNumberish(record.branchId) ??
    readNumberish(record.primary_branch_id) ??
    readNumberish(record.primaryBranchId)
  )
}

function normalizeDepartmentPositionRows(
  rows: AdminRecord[],
  departmentId: number,
) {
  return rows.map((row) => {
    const nestedPosition =
      asRecord(row.position) ??
      asRecord(row.positionDetail) ??
      asRecord(row.primary_position) ??
      asRecord(row.primaryPosition)
    const position = nestedPosition
      ? ({ ...row, ...nestedPosition } as AdminRecord)
      : row
    const existingIds = relatedDepartmentIds(position)
    existingIds.add(departmentId)
    return {
      ...position,
      department_id: position.department_id ?? departmentId,
      department_ids: Array.from(existingIds),
    } as AdminRecord
  })
}

function getSelectedLabel(
  options: LookupOption[],
  id: number | null,
  fallback: string,
) {
  if (id === null) return fallback
  return options.find((option) => option.id === id)?.label ?? fallback
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeInvitationPhone(value: string) {
  const compact = value.trim().replace(/[()\s-]/g, "")
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact
}

function isValidE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value) && isValidPhone(value)
}

function toLookupOptions(
  rows: AdminRecord[],
  labelKeys: string[],
  branchKeys: string[],
  departmentKeys: string[],
): LookupOption[] {
  return rows
    .map<LookupOption | null>((row) => {
      const id = getId(row)
      if (id === null) return null
      return {
        id,
        label: getName(row, ...labelKeys),
        branchId: readRelatedId(row, branchKeys),
        departmentId: readRelatedId(row, departmentKeys),
      }
    })
    .filter((option): option is LookupOption => option !== null)
}

function FieldShell({
  label,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <FormField
      label={<span id={htmlFor ? `${htmlFor}-label` : undefined}>{label}</span>}
      htmlFor={htmlFor}
      required={required}
      className={className}
    >
      {children}
    </FormField>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold tracking-tight text-foreground">
      {title}
    </h3>
  )
}

export function EmployeeInviteView() {
  const actor = useDashboardActor()
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [branchId, setBranchId] = React.useState<number | null>(null)
  const [departmentId, setDepartmentId] = React.useState<number | null>(null)
  const [positionId, setPositionId] = React.useState<number | null>(null)
  const [reportsToId, setReportsToId] = React.useState<number | null>(null)
  const [employmentType, setEmploymentType] =
    React.useState<string>("full_time")
  const [hireDate, setHireDate] = React.useState<string>("")
  const [sendSmsReminder, setSendSmsReminder] = React.useState(true)
  const [workflowId, setWorkflowId] = React.useState<number | null>(null)

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [departmentPositions, setDepartmentPositions] = React.useState<
    AdminRecord[]
  >([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])

  const [loading, setLoading] = React.useState(false)
  const [departmentPositionsLoading, setDepartmentPositionsLoading] =
    React.useState(false)
  const [departmentPositionsLoaded, setDepartmentPositionsLoaded] =
    React.useState(false)
  const [employeesLoading, setEmployeesLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState("")
  const [savedInviteDraft, setSavedInviteDraft] = React.useState<StoredInviteDraft | null>(null)
  const [inviteDraftReady, setInviteDraftReady] = React.useState(false)
  const canReadOnboardingWorkflows = React.useMemo(
    () =>
      canPerformPermission(actor.permissionLabels, "onboarding_workflows:read"),
    [actor.permissionLabels],
  )

  React.useEffect(() => {
    setToken(readStoredToken())
  }, [])

  // Warn before sending when the chosen position has no free seat.
  const [positionCapacity, setPositionCapacity] =
    React.useState<PositionCapacity | null>(null)
  React.useEffect(() => {
    setPositionCapacity(null)
    if (!token || positionId === null || departmentId === null) return
    let active = true
    getEmployeeInvitationPositionCapacity(token, positionId, departmentId)
      .then((capacity) => {
        if (active) setPositionCapacity(capacity)
      })
      // The server rechecks the current staffing policy when saving.
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [token, positionId, departmentId])
  const capacityWarning = positionCapacityWarning(positionCapacity)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(INVITE_DRAFT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredInviteDraft
        if (parsed.firstName || parsed.lastName || parsed.email || parsed.phone) {
          setSavedInviteDraft(parsed)
        }
      }
    } catch {
      window.localStorage.removeItem(INVITE_DRAFT_STORAGE_KEY)
    } finally {
      setInviteDraftReady(true)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined" || !inviteDraftReady || savedInviteDraft) return
    window.localStorage.setItem(
      INVITE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        firstName,
        lastName,
        gender,
        email,
        phone,
        branchId,
        departmentId,
        positionId,
        reportsToId,
        employmentType,
        hireDate,
        workflowId,
        savedAt: new Date().toISOString(),
      } satisfies StoredInviteDraft),
    )
  }, [inviteDraftReady, savedInviteDraft, firstName, lastName, gender, email, phone, branchId, departmentId, positionId, reportsToId, employmentType, hireDate, workflowId])

  React.useEffect(() => {
    if (!token) {
      setError("Authentication token not found. Please log in again.")
      return
    }
    if (!actor.ready) {
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const workflowLookup = canReadOnboardingWorkflows
          ? listOnboardingWorkflows(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            })
          : Promise.resolve({
              rows: [] as AdminRecord[],
              page: 1,
              limit: 0,
              total: 0,
              totalPages: 0,
            })
        const [br, de, po, wo] = await Promise.allSettled([
          listBranches(token, {
            page: 1,
            limit: 100,
            sortBy: "name",
            sortOrder: "ASC",
          }),
          listDepartments(token, {
            page: 1,
            limit: 200,
            sortBy: "name",
            sortOrder: "ASC",
          }),
          listPositions(token, {
            page: 1,
            limit: 200,
            sortBy: "name",
            sortOrder: "ASC",
          }),
          workflowLookup,
        ])
        if (cancelled) return

        const failures: string[] = []

        if (br.status === "fulfilled") {
          setBranches(br.value.rows || [])
        } else {
          setBranches([])
          failures.push("branches")
        }

        if (de.status === "fulfilled") {
          setDepartments(de.value.rows || [])
        } else {
          setDepartments([])
          failures.push("departments")
        }

        if (po.status === "fulfilled") {
          setPositions(po.value.rows || [])
        } else {
          setPositions([])
          failures.push("positions")
        }

        if (wo.status === "fulfilled") {
          setWorkflows(wo.value.rows || [])
        } else {
          setWorkflows([])
          if (canReadOnboardingWorkflows) {
            failures.push("workflows")
          }
        }

        setEmployees([])

        if (failures.length > 0) {
          setError(
            `Some reference data could not be loaded: ${failures.join(", ")}.`,
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [actor.ready, canReadOnboardingWorkflows, token])

  const branchOptions = React.useMemo(
    () =>
      toLookupOptions(branches, ["branch_name", "branchName", "name"], [], []),
    [branches],
  )

  const allDepartmentOptions = React.useMemo(
    () =>
      toLookupOptions(
        departments,
        ["department_name", "departmentName", "name"],
        [
          "branch_id",
          "branchId",
          "primary_branch_id",
          "primaryBranchId",
          "branch",
        ],
        [],
      ),
    [departments],
  )

  // Strict cascade: departments only for the selected branch (no “show all” fallback).
  const departmentOptions = React.useMemo(() => {
    if (branchId === null) return []
    return allDepartmentOptions.filter((option) => option.branchId === branchId)
  }, [allDepartmentOptions, branchId])

  const allPositionOptions = React.useMemo(
    () =>
      toLookupOptions(
        positions,
        ["position_name", "positionName", "name", "title"],
        [
          "branch_id",
          "branchId",
          "primary_branch_id",
          "primaryBranchId",
          "branch",
        ],
        [
          "department_id",
          "departmentId",
          "primary_department_id",
          "primaryDepartmentId",
          "department",
        ],
      ),
    [positions],
  )

  const positionOptions = React.useMemo(() => {
    if (departmentId === null) return []
    if (departmentPositionsLoaded) {
      return toLookupOptions(
        departmentPositions,
        ["position_name", "positionName", "name", "title"],
        [
          "branch_id",
          "branchId",
          "primary_branch_id",
          "primaryBranchId",
          "branch",
        ],
        [
          "department_id",
          "departmentId",
          "primary_department_id",
          "primaryDepartmentId",
          "department",
        ],
      )
    }
    const byDepartmentCandidates: Array<LookupOption | null> = positions
      .filter((record) => relatedDepartmentIds(record).has(departmentId))
      .map<LookupOption | null>((record) => {
        const id = getId(record)
        if (id === null) return null
        return {
          id,
          label: getName(
            record,
            "position_name",
            "positionName",
            "name",
            "title",
          ),
          branchId: relatedBranchId(record),
          departmentId,
        } satisfies LookupOption
      })
    const byDepartment = byDepartmentCandidates.filter(
      (option): option is LookupOption => option !== null,
    )
    if (byDepartment.length > 0) return byDepartment
    return allPositionOptions.filter(
      (option) =>
        option.departmentId === null &&
        (option.branchId === null || option.branchId === branchId),
    )
  }, [
    allPositionOptions,
    branchId,
    departmentId,
    departmentPositions,
    departmentPositionsLoaded,
    positions,
  ])

  const employeeOptions = React.useMemo(() => {
    if (departmentId === null) return []
    const candidates: Array<LookupOption | null> = employees
      .filter((record) => {
        const employeeBranchId = relatedBranchId(record)
        return (
          branchId === null ||
          employeeBranchId === null ||
          employeeBranchId === branchId
        )
      })
      .map<LookupOption | null>((record) => {
        const id = getId(record)
        if (id === null) return null
        return {
          id,
          label: getName(
            record,
            "fullName",
            "full_name",
            "displayName",
            "display_name",
            "name",
            "firstName",
            "first_name",
          ),
          branchId: relatedBranchId(record),
          departmentId,
        } satisfies LookupOption
      })
    return candidates.filter(
      (option): option is LookupOption => option !== null,
    )
  }, [branchId, departmentId, employees])

  const workflowOptions = React.useMemo(
    () =>
      toLookupOptions(
        workflows,
        ["name", "title", "workflow_name", "workflowName"],
        [],
        [],
      ),
    [workflows],
  )

  React.useEffect(() => {
    if (departmentId === null || !token) {
      setDepartmentPositions([])
      setDepartmentPositionsLoaded(false)
      setDepartmentPositionsLoading(false)
      setEmployees([])
      setEmployeesLoading(false)
      return
    }

    let cancelled = false
    setDepartmentPositionsLoading(true)
    setDepartmentPositionsLoaded(false)
    setEmployeesLoading(true)

    void Promise.allSettled([
      listDepartmentPositions(token, departmentId),
      listEmployees(token, {
        page: 1,
        limit: 200,
        sortBy: "first_name",
        sortOrder: "ASC",
        employment_status: "active",
        department_id: departmentId,
      }),
    ])
      .then(([departmentPositionResult, employeeResult]) => {
        if (cancelled) return
        if (departmentPositionResult.status === "fulfilled") {
          setDepartmentPositions(
            normalizeDepartmentPositionRows(
              departmentPositionResult.value,
              departmentId,
            ),
          )
          setDepartmentPositionsLoaded(true)
        } else {
          setDepartmentPositions([])
          setDepartmentPositionsLoaded(false)
        }
        if (employeeResult.status === "fulfilled") {
          setEmployees(employeeResult.value.rows || [])
        } else {
          setEmployees([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDepartmentPositionsLoading(false)
          setEmployeesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [departmentId, token])

  React.useEffect(() => {
    if (
      positionId !== null &&
      !positionOptions.some((option) => option.id === positionId)
    ) {
      setPositionId(null)
    }
  }, [positionId, positionOptions])

  React.useEffect(() => {
    if (
      reportsToId !== null &&
      !employeeOptions.some((option) => option.id === reportsToId)
    ) {
      setReportsToId(null)
    }
  }, [employeeOptions, reportsToId])

  const handleBranchChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setBranchId(Number.isFinite(next as number) ? next : null)
    setDepartmentId(null)
    setPositionId(null)
    setReportsToId(null)
    setDepartmentPositions([])
    setDepartmentPositionsLoaded(false)
    setDepartmentPositionsLoading(false)
    setEmployees([])
    setEmployeesLoading(false)
  }

  const handleDepartmentChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setDepartmentId(Number.isFinite(next as number) ? next : null)
    setPositionId(null)
    setReportsToId(null)
    setDepartmentPositions([])
    setDepartmentPositionsLoaded(false)
    setDepartmentPositionsLoading(false)
    setEmployees([])
    setEmployeesLoading(false)
  }

  const handlePositionChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setPositionId(Number.isFinite(next as number) ? next : null)
  }

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setGender("")
    setEmail("")
    setPhone("")
    setBranchId(null)
    setDepartmentId(null)
    setPositionId(null)
    setReportsToId(null)
    setEmploymentType("full_time")
    setHireDate("")
    setSendSmsReminder(true)
    setWorkflowId(null)
    setSavedInviteDraft(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(INVITE_DRAFT_STORAGE_KEY)
    }
  }

  const resumeInviteDraft = () => {
    const draft = savedInviteDraft
    if (!draft) return
    setFirstName(draft.firstName ?? "")
    setLastName(draft.lastName ?? "")
    setGender(draft.gender ?? "")
    setEmail(draft.email ?? "")
    setPhone(draft.phone ?? "")
    setBranchId(draft.branchId ?? null)
    setDepartmentId(draft.departmentId ?? null)
    setPositionId(draft.positionId ?? null)
    setReportsToId(draft.reportsToId ?? null)
    setEmploymentType(draft.employmentType ?? "full_time")
    setHireDate(draft.hireDate ?? "")
    setWorkflowId(draft.workflowId ?? null)
    setSavedInviteDraft(null)
  }

  const discardInviteDraft = () => {
    setSavedInviteDraft(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(INVITE_DRAFT_STORAGE_KEY)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (positionCapacity?.enforced && capacityWarning) { toast.error(capacityWarning); return }
    if (!token) {
      toast.error("Authentication required. Please log in again.")
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required.")
      return
    }
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = normalizeInvitationPhone(phone)
    if (!normalizedEmail) {
      toast.error("Email is required.")
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      toast.error("Enter a valid email address.")
      return
    }
    if (!normalizedPhone) {
      toast.error("Phone number is required.")
      return
    }
    if (!isValidE164Phone(normalizedPhone)) {
      toast.error(
        "Enter the phone number with country code, for example +255712345678.",
      )
      return
    }
    if (!gender) {
      toast.error("Please select a gender.")
      return
    }
    if (!branchId) {
      toast.error("Please select a branch first.")
      return
    }
    if (!departmentId) {
      toast.error("Please select a department for the selected branch.")
      return
    }
    if (!positionId) {
      toast.error("Please select a position.")
      return
    }
    if (canReadOnboardingWorkflows && !workflowId) {
      toast.error("Please select an onboarding workflow.")
      return
    }

    const payload: CreateEmployeeInvitationPayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender,
      email: normalizedEmail,
      phone: normalizedPhone,
      primary_branch_id: branchId,
      primary_department_id: departmentId,
      primary_position_id: positionId,
      employment_type:
        employmentType as CreateEmployeeInvitationPayload["employment_type"],
      reports_to: reportsToId ?? undefined,
      hire_date: hireDate || undefined,
      onboarding_workflow_id: workflowId ?? undefined,
      channels: invitationChannels(sendSmsReminder),
    }

    setSubmitting(true)
    try {
      const invitation = await createEmployeeInvitation(token, payload)
      const outcome = invitationDeliveryOutcome({
        email: invitation.delivery?.email?.status,
        sms: invitation.delivery?.sms?.status,
      })
      if (outcome.kind === "partial") {
        showErrorAlert(outcome.message)
      } else {
        showSuccessAlert(outcome.message)
      }
      const overfillWarning = positionCapacityWarning(invitation.capacity)
      if (overfillWarning) toast.warning(overfillWarning)
      resetForm()
    } catch (err: unknown) {
      const status =
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        typeof (err as { status?: unknown }).status === "number"
          ? (err as { status: number }).status
          : null
      const detail =
        err instanceof Error ? err.message : "The invitation could not be sent."
      const message =
        status === 404 || status === 405
          ? "The backend invitation endpoint is not available yet. Implement POST /api/employee-invitations using the provided backend contract."
          : `Failed to send the invitation${status ? ` (${status})` : ""}. ${detail}`
      showErrorAlert(message)
    } finally {
      setSubmitting(false)
    }
  }

  const departmentDisabled = branchId === null || loading
  const positionDisabled =
    departmentId === null || loading || departmentPositionsLoading
  const reportsToDisabled = departmentId === null || loading || employeesLoading

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-8">
      <PageHeader
        className="border-b border-border pb-3"
        title="Invite employee"
        description="Send a new hire an invitation to complete their own registration details."
      />
      {savedInviteDraft ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Continue where you left off?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You have an unfinished invitation
                {savedInviteDraft.firstName || savedInviteDraft.lastName
                  ? ` for ${[savedInviteDraft.firstName, savedInviteDraft.lastName].filter(Boolean).join(" ")}`
                  : ""}.
                {savedInviteDraft.savedAt ? ` Saved ${new Date(savedInviteDraft.savedAt).toLocaleString()}.` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" appearance="outline" size="small" onClick={discardInviteDraft}>
                Start fresh
              </Button>
              <Button type="button" appearance="primary" size="small" onClick={resumeInviteDraft}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeader title="Personal details" />
            {canPerformPermission(actor.permissionLabels, "employees:create") ? (
              <Button
                as="a"
                href="/dashboard/employees/onboarding?tab=invitations"
                className="!no-underline hover:!no-underline focus:!no-underline"
              >
                View invitations
              </Button>
            ) : null}
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldShell label="First name" htmlFor="first_name" required>
                <FluentInput
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  className="w-full"
                  required
                />
              </FieldShell>
              <FieldShell label="Last name" htmlFor="last_name" required>
                <FluentInput
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                  className="w-full"
                  required
                />
              </FieldShell>
              <FieldShell label="Work email" htmlFor="email" required>
                <FluentInput
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  contentBefore={<MailIcon className="size-4 text-muted-foreground" />}
                  className="w-full"
                  required
                />
              </FieldShell>
              <FieldShell label="Phone number" htmlFor="phone" required>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onChange={(value) => setPhone(value)}
                  placeholder="712 345 678"
                  className="w-full"
                />
              </FieldShell>
              <FieldShell label="Gender" htmlFor="gender" required>
                <Dropdown
                  id="gender"
                  aria-labelledby="gender-label"
                  value={GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? ""}
                  selectedOptions={gender ? [gender] : []}
                  onOptionSelect={(_event, data) => setGender(data.optionValue ?? "")}
                  placeholder="Select gender"
                  className="w-full"
                >
                  {GENDER_OPTIONS.map((option) => (
                    <Option key={option.value} value={option.value} text={option.label}>
                      {option.label}
                    </Option>
                  ))}
                </Dropdown>
              </FieldShell>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader title="Work assignment" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldShell label="Branch" htmlFor="branch" required>
              <Dropdown
                id="branch"
                aria-labelledby="branch-label"
                value={getSelectedLabel(branchOptions, branchId, "")}
                selectedOptions={branchId != null ? [String(branchId)] : []}
                onOptionSelect={(_event, data) => handleBranchChange(data.optionValue ?? null)}
                placeholder="Select branch"
                disabled={loading}
                className="w-full"
              >
                {branchOptions.length === 0 ? (
                  <Option disabled>No branches found</Option>
                ) : null}
                {branchOptions.map((option) => (
                  <Option key={option.id} value={String(option.id)} text={option.label}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </FieldShell>

            <FieldShell label="Department" htmlFor="department" required>
              <Dropdown
                id="department"
                aria-labelledby="department-label"
                value={getSelectedLabel(departmentOptions, departmentId, "")}
                selectedOptions={departmentId != null ? [String(departmentId)] : []}
                onOptionSelect={(_event, data) => handleDepartmentChange(data.optionValue ?? null)}
                placeholder={branchId === null ? "Select branch first" : "Select department"}
                disabled={departmentDisabled}
                className="w-full"
              >
                {departmentOptions.length === 0 ? (
                  <Option disabled>
                    {branchId === null ? "Select a branch first" : "No departments for this branch"}
                  </Option>
                ) : null}
                {departmentOptions.map((option) => (
                  <Option key={option.id} value={String(option.id)} text={option.label}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </FieldShell>

            <FieldShell label="Position" htmlFor="position" required>
              <Dropdown
                id="position"
                aria-labelledby="position-label"
                value={getSelectedLabel(positionOptions, positionId, "")}
                selectedOptions={positionId != null ? [String(positionId)] : []}
                onOptionSelect={(_event, data) => handlePositionChange(data.optionValue ?? null)}
                placeholder={departmentId === null ? "Select department first" : departmentPositionsLoading ? "Loading positions..." : "Select position"}
                disabled={positionDisabled}
                className="w-full"
              >
                {positionOptions.length === 0 ? (
                  <Option disabled>
                    {departmentId === null ? "Select a department first" : departmentPositionsLoading ? "Loading positions..." : "No positions for this department"}
                  </Option>
                ) : null}
                {positionOptions.map((option) => (
                  <Option key={option.id} value={String(option.id)} text={option.label}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
              {capacityWarning ? (
                <p
                  role="status"
                  className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  {capacityWarning}
                </p>
              ) : null}
            </FieldShell>

            <FieldShell label="Reports to" htmlFor="reports_to">
              <Dropdown
                id="reports_to"
                aria-labelledby="reports_to-label"
                value={getSelectedLabel(employeeOptions, reportsToId, "")}
                selectedOptions={reportsToId != null ? [String(reportsToId)] : []}
                onOptionSelect={(_event, data) => setReportsToId(data.optionValue ? Number(data.optionValue) : null)}
                placeholder={departmentId === null ? "Select department first" : employeesLoading ? "Loading managers..." : "Select manager (optional)"}
                disabled={reportsToDisabled}
                clearable
                className="w-full"
              >
                {employeeOptions.length === 0 ? (
                  <Option disabled>
                    {departmentId === null ? "Select a department first" : employeesLoading ? "Loading managers..." : "No managers found in this department"}
                  </Option>
                ) : null}
                {employeeOptions.map((option) => (
                  <Option key={option.id} value={String(option.id)} text={option.label}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </FieldShell>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader title="Employment & onboarding" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldShell label="Employment type" htmlFor="employment_type" required>
              <Dropdown
                id="employment_type"
                aria-labelledby="employment_type-label"
                value={EMPLOYMENT_TYPES.find((type) => type.value === employmentType)?.label ?? "Employment type"}
                selectedOptions={employmentType ? [employmentType] : []}
                onOptionSelect={(_event, data) => setEmploymentType(data.optionValue || "full_time")}
                disabled={loading}
                className="w-full"
              >
                {EMPLOYMENT_TYPES.map((type) => (
                  <Option key={type.value} value={type.value} text={type.label}>
                    {type.label}
                  </Option>
                ))}
              </Dropdown>
            </FieldShell>

            <FieldShell
              label="Onboarding workflow"
              htmlFor="onboarding_workflow"
              required={canReadOnboardingWorkflows}
            >
              <Dropdown
                id="onboarding_workflow"
                aria-labelledby="onboarding_workflow-label"
                value={canReadOnboardingWorkflows ? getSelectedLabel(workflowOptions, workflowId, "") : "Workflow assigned automatically"}
                selectedOptions={workflowId != null ? [String(workflowId)] : []}
                onOptionSelect={(_event, data) => setWorkflowId(data.optionValue ? Number(data.optionValue) : null)}
                placeholder={canReadOnboardingWorkflows ? "Select workflow" : "Workflow assigned automatically"}
                disabled={loading || !canReadOnboardingWorkflows}
                className="w-full"
              >
                {workflowOptions.length === 0 ? (
                  <Option disabled>
                    {canReadOnboardingWorkflows ? "No workflows found" : "Your role cannot view workflow templates."}
                  </Option>
                ) : null}
                {workflowOptions.map((option) => (
                  <Option key={option.id} value={String(option.id)} text={option.label}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </FieldShell>

            <FieldShell label="Hire date">
              <DatePickerPresets
                value={hireDate}
                onChange={setHireDate}
                placeholder="Select hire date"
              />
            </FieldShell>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="mr-auto inline-flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={sendSmsReminder}
              onCheckedChange={(checked) => setSendSmsReminder(Boolean(checked))}
              disabled={submitting}
            />
            Also send an SMS reminder
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    appearance="subtle"
                    size="small"
                    icon={<InfoIcon />}
                    aria-label="About this action"
                  />
                }
              />
              <TooltipContent side="top" className="max-w-xs text-left">
                Emails one secure registration link. The optional SMS is a
                reminder to check email and never contains the link.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            type="button"
            appearance="outline"
            onClick={resetForm}
            disabled={submitting}
            icon={<RotateCcwIcon />}
          >
            Reset
          </Button>
          <Button
            type="submit"
            appearance="primary"
            size="large"
            disabled={submitting || loading || Boolean(positionCapacity?.enforced && capacityWarning)}
            icon={submitting ? <FluentLoadingIndicator className="animate-spin" /> : <UserPlus2Icon />}
          >
            {submitting
              ? "Sending…"
              : sendSmsReminder
                ? "Send email & SMS invitation"
                : "Send email invitation"}
          </Button>
        </div>
      </form>
    </div>
  )
}
