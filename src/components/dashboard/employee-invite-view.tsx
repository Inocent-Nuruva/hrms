"use client"

import * as React from "react"
import {
  InfoIcon,
  Loader2Icon,
  MailIcon,
  PhoneIcon,
  RotateCcwIcon,
  UserPlus2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createOnboardingRequest,
  createEmployeeProfile,
  getOnboardingRequest,
  listBranches,
  listDepartmentPositions,
  listDepartments,
  listEmployees,
  listOnboardingWorkflows,
  listPositions,
  type AdminRecord,
  type CreateEmployeePayload,
  type CreateEmployeeResponse,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const

const EMPLOYMENT_TYPES: ReadonlyArray<{
  value: NonNullable<CreateEmployeePayload["employment_type"]>
  label: string
}> = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "temporary", label: "Temporary" },
]

type LookupOption = {
  id: number
  label: string
  branchId: number | null
  departmentId: number | null
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function readStoredToken(): string {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) return direct
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) return ""
  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function getId(record: AdminRecord): number | null {
  const candidates = ["id", "value", "request_id", "requestId", "employee_id", "employeeId", "branch_id", "department_id", "position_id"]
  for (const k of candidates) {
    const v = record[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v)
  }
  return null
}

function getName(record: AdminRecord, ...keys: string[]): string {
  for (const k of keys) {
    const v = record[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  for (const k of ["fullName", "full_name", "displayName", "display_name", "name"]) {
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
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
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
    if (typeof direct === "string" && direct.trim() && !Number.isNaN(Number(direct))) {
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

  for (const key of ["department", "departmentDetail", "primary_department", "primaryDepartment"]) {
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

  const assignments = Array.isArray(record.departments) ? record.departments : []
  for (const value of assignments) {
    const directAssignmentId = readNumberish(value)
    if (directAssignmentId !== null && (typeof value === "number" || typeof value === "string")) {
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

function normalizeDepartmentPositionRows(rows: AdminRecord[], departmentId: number) {
  return rows.map((row) => {
    const nestedPosition =
      asRecord(row.position) ??
      asRecord(row.positionDetail) ??
      asRecord(row.primary_position) ??
      asRecord(row.primaryPosition)
    const position = nestedPosition ? ({ ...row, ...nestedPosition } as AdminRecord) : row
    const existingIds = relatedDepartmentIds(position)
    existingIds.add(departmentId)
    return {
      ...position,
      department_id: position.department_id ?? departmentId,
      department_ids: Array.from(existingIds),
    } as AdminRecord
  })
}

function getSelectedLabel(options: LookupOption[], id: number | null, fallback: string) {
  if (id === null) return fallback
  return options.find((option) => option.id === id)?.label ?? fallback
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function toLookupOptions(
  rows: AdminRecord[],
  labelKeys: string[],
  branchKeys: string[],
  departmentKeys: string[]
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
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
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
  const [employmentType, setEmploymentType] = React.useState<string>("full_time")
  const [hireDate, setHireDate] = React.useState<string>("")
  const [workflowId, setWorkflowId] = React.useState<number | null>(null)

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [departmentPositions, setDepartmentPositions] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])

  const [loading, setLoading] = React.useState(false)
  const [departmentPositionsLoading, setDepartmentPositionsLoading] = React.useState(false)
  const [departmentPositionsLoaded, setDepartmentPositionsLoaded] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState("")
  const canReadOnboardingWorkflows = React.useMemo(
    () => canPerformPermission(actor.permissionLabels, "onboarding_workflows:read"),
    [actor.permissionLabels]
  )

  React.useEffect(() => {
    setToken(readStoredToken())
  }, [])

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
        const [br, de, po, wo, em] = await Promise.allSettled([
          listBranches(token, { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }),
          listDepartments(token, { page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
          listPositions(token, { page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
          workflowLookup,
          listEmployees(token, {
            page: 1,
            limit: 200,
            sortBy: "first_name",
            sortOrder: "ASC",
            employment_status: "active",
          }),
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

        if (em.status === "fulfilled") {
          setEmployees(em.value.rows || [])
        } else {
          setEmployees([])
          failures.push("employees")
        }

        if (failures.length > 0) {
          setError(`Some reference data could not be loaded: ${failures.join(", ")}.`)
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
    () => toLookupOptions(branches, ["branch_name", "branchName", "name"], [], []),
    [branches]
  )

  const allDepartmentOptions = React.useMemo(
    () =>
      toLookupOptions(
        departments,
        ["department_name", "departmentName", "name"],
        ["branch_id", "branchId", "primary_branch_id", "primaryBranchId", "branch"],
        []
      ),
    [departments]
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
        ["branch_id", "branchId", "primary_branch_id", "primaryBranchId", "branch"],
        ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId", "department"]
      ),
    [positions]
  )

  const positionOptions = React.useMemo(() => {
    if (departmentId === null) return []
    if (departmentPositionsLoaded) {
      return toLookupOptions(
        departmentPositions,
        ["position_name", "positionName", "name", "title"],
        ["branch_id", "branchId", "primary_branch_id", "primaryBranchId", "branch"],
        ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId", "department"]
      )
    }
    const byDepartmentCandidates: Array<LookupOption | null> = positions
      .filter((record) => relatedDepartmentIds(record).has(departmentId))
      .map<LookupOption | null>((record) => {
        const id = getId(record)
        if (id === null) return null
        return {
          id,
          label: getName(record, "position_name", "positionName", "name", "title"),
          branchId: relatedBranchId(record),
          departmentId,
        } satisfies LookupOption
      })
    const byDepartment = byDepartmentCandidates.filter(
      (option): option is LookupOption => option !== null
    )
    if (byDepartment.length > 0) return byDepartment
    return allPositionOptions.filter(
      (option) =>
        option.departmentId === null &&
        (option.branchId === null || option.branchId === branchId)
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
        if (!relatedDepartmentIds(record).has(departmentId)) {
          return false
        }
        const employeeBranchId = relatedBranchId(record)
        return branchId === null || employeeBranchId === null || employeeBranchId === branchId
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
            "first_name"
          ),
          branchId: relatedBranchId(record),
          departmentId,
        } satisfies LookupOption
      })
    return candidates.filter((option): option is LookupOption => option !== null)
  }, [branchId, departmentId, employees])

  const workflowOptions = React.useMemo(
    () => toLookupOptions(workflows, ["name", "title", "workflow_name", "workflowName"], [], []),
    [workflows]
  )

  React.useEffect(() => {
    if (departmentId === null || !token) {
      setDepartmentPositions([])
      setDepartmentPositionsLoaded(false)
      setDepartmentPositionsLoading(false)
      return
    }

    let cancelled = false
    setDepartmentPositionsLoading(true)
    setDepartmentPositionsLoaded(false)

    void listDepartmentPositions(token, departmentId)
      .then((rows) => {
        if (cancelled) return
        setDepartmentPositions(normalizeDepartmentPositionRows(rows, departmentId))
        setDepartmentPositionsLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setDepartmentPositions([])
        setDepartmentPositionsLoaded(false)
      })
      .finally(() => {
        if (!cancelled) {
          setDepartmentPositionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [departmentId, token])

  React.useEffect(() => {
    if (positionId !== null && !positionOptions.some((option) => option.id === positionId)) {
      setPositionId(null)
    }
  }, [positionId, positionOptions])

  React.useEffect(() => {
    if (reportsToId !== null && !employeeOptions.some((option) => option.id === reportsToId)) {
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
  }

  const handleDepartmentChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setDepartmentId(Number.isFinite(next as number) ? next : null)
    setPositionId(null)
    setReportsToId(null)
    setDepartmentPositions([])
    setDepartmentPositionsLoaded(false)
    setDepartmentPositionsLoading(false)
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
    setWorkflowId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      toast.error("No auth token")
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required.")
      return
    }
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone.trim()
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

    const payload: CreateEmployeePayload = {
      employee_no: undefined,
      gender,
      primary_branch_id: branchId,
      primary_department_id: departmentId,
      primary_position_id: positionId,
      position_id: positionId,
      employment_status: "onboarding",
      employment_type: employmentType as CreateEmployeePayload["employment_type"],
      reports_to: reportsToId ?? undefined,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      hire_date: hireDate || undefined,
      departments: [{ is_primary: true, department_id: departmentId }],
      contacts: [
        {
          contact_type: "work",
          is_primary: true,
          email: normalizedEmail,
          phone_number: normalizedPhone,
          notes: "Created from recruitment invite.",
        },
      ],
      addresses: [],
      relatives: [],
      identifications: [],
      bank_accounts: [],
      academic_qualifications: [],
      professional_qualifications: [],
      experience_details: [],
      metadata: {
        source: "invite",
        registration_mode: "send_invite",
        branch_name: getSelectedLabel(branchOptions, branchId, ""),
        department_name: getSelectedLabel(departmentOptions, departmentId, ""),
        position_name: getSelectedLabel(positionOptions, positionId, ""),
      },
    }

    setSubmitting(true)
    let createdEmployee: CreateEmployeeResponse | null = null
    try {
      createdEmployee = await createEmployeeProfile(token, payload)
      const employeeId = getId(createdEmployee)

      if (employeeId === null) {
        throw new Error("Employee was created but no employee id was returned for onboarding.")
      }

      // Recruitment invite starts onboarding through the dedicated onboarding requests API.
      const onboardingRequest = await createOnboardingRequest(token, {
        employee_id: employeeId,
        workflow_id: workflowId ?? undefined,
        submit: true,
        title: `Onboarding for ${firstName.trim()} ${lastName.trim()}`.trim(),
        planned_start_date: hireDate || undefined,
      })
      const onboardingRecord =
        typeof onboardingRequest === "object" && onboardingRequest !== null
          ? (onboardingRequest as AdminRecord)
          : null
      const onboardingRequestId = onboardingRecord ? getId(onboardingRecord) : null
      void notifySubmittedRequestApprovers({
        kind: "onboarding_request",
        token,
        request: onboardingRequest,
        requesterName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        loadRequest:
          onboardingRequestId === null
            ? undefined
            : () => getOnboardingRequest(token, onboardingRequestId),
      })

      showSuccessAlert("Employee invite created successfully. Onboarding started.")
      resetForm()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create employee invite."
      const status =
        typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
          ? err.status
          : null
      if (process.env.NODE_ENV !== "production") {
        const errorPayload =
          typeof err === "object" && err !== null && "payload" in err
            ? (err as { payload?: unknown }).payload
            : undefined
        console.error(
          "[recruitment-invite] submit failed",
          JSON.stringify(
            {
              status,
              message: msg,
              employeeCreatePayload: payload,
              onboardingRequestPayload: createdEmployee
                ? {
                    employee_id: getId(createdEmployee),
                    workflow_id: workflowId ?? undefined,
                    submit: true,
                    title: `Onboarding for ${firstName.trim()} ${lastName.trim()}`.trim(),
                    planned_start_date: hireDate || undefined,
                  }
                : null,
              errorPayload,
            },
            null,
            2
          )
        )
      }
      const message = createdEmployee
        ? status
          ? `Employee invite was created, but onboarding could not be started (${status}). ${msg}`
          : `Employee invite was created, but onboarding could not be started. ${msg}`
        : status
          ? `Failed to create employee invite (${status}). ${msg}`
          : `Failed to create employee invite. ${msg}`
      showErrorAlert(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const departmentDisabled = branchId === null || loading
  const positionDisabled = departmentId === null || loading || departmentPositionsLoading
  const reportsToDisabled = departmentId === null || loading

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-8">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <SectionHeader title="Personal details" />
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldShell label="First name" htmlFor="first_name" required>
                <Input
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  required
                />
              </FieldShell>
              <FieldShell label="Last name" htmlFor="last_name" required>
                <Input
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                  required
                />
              </FieldShell>
              <FieldShell label="Work email" htmlFor="email" required>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="pl-9"
                    required
                  />
                </div>
              </FieldShell>
              <FieldShell label="Phone number" htmlFor="phone" required>
                <div className="relative">
                  <PhoneIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+255 7XX XXX XXX"
                    autoComplete="tel"
                    className="pl-9"
                    required
                  />
                </div>
              </FieldShell>
              <FieldShell label="Gender" required>
                <Select value={gender || null} onValueChange={(value) => setGender(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender">
                      {GENDER_OPTIONS.find((option) => option.value === gender)?.label ??
                        "Select gender"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldShell>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader title="Work assignment" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldShell label="Branch" required>
              <Select
                value={branchId != null ? String(branchId) : null}
                onValueChange={handleBranchChange}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch">
                    {getSelectedLabel(branchOptions, branchId, "Select branch")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No branches found</div>
                  ) : null}
                  {branchOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>

            <FieldShell label="Department" required>
              <Select
                value={departmentId != null ? String(departmentId) : null}
                onValueChange={handleDepartmentChange}
                disabled={departmentDisabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={branchId === null ? "Select branch first" : "Select department"}
                  >
                    {branchId === null
                      ? "Select branch first"
                      : getSelectedLabel(departmentOptions, departmentId, "Select department")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {branchId === null
                        ? "Select a branch first"
                        : "No departments for this branch"}
                    </div>
                  ) : null}
                  {departmentOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>

            <FieldShell label="Position" required>
              <Select
                value={positionId != null ? String(positionId) : null}
                onValueChange={handlePositionChange}
                disabled={positionDisabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      departmentId === null
                        ? "Select department first"
                        : departmentPositionsLoading
                          ? "Loading positions..."
                          : "Select position"
                    }
                  >
                    {departmentId === null
                      ? "Select department first"
                      : departmentPositionsLoading
                        ? "Loading positions..."
                      : getSelectedLabel(positionOptions, positionId, "Select position")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positionOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {departmentId === null
                        ? "Select a department first"
                        : departmentPositionsLoading
                          ? "Loading positions..."
                        : "No positions for this department"}
                    </div>
                  ) : null}
                  {positionOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>

            <FieldShell label="Reports to">
              <Select
                value={reportsToId != null ? String(reportsToId) : null}
                onValueChange={(value) => setReportsToId(value ? Number(value) : null)}
                disabled={reportsToDisabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      departmentId === null
                        ? "Select department first"
                        : "Select manager (optional)"
                    }
                  >
                    {departmentId === null
                      ? "Select department first"
                      : getSelectedLabel(employeeOptions, reportsToId, "Select manager (optional)")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {departmentId === null
                        ? "Select a department first"
                        : loading
                          ? "Loading employees..."
                          : "No managers found in this department"}
                    </div>
                  ) : null}
                  {employeeOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader title="Employment & onboarding" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldShell label="Employment type" required>
              <Select
                value={employmentType}
                onValueChange={(value) => setEmploymentType(value || "full_time")}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {EMPLOYMENT_TYPES.find((type) => type.value === employmentType)?.label ??
                      "Employment type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>

            <FieldShell label="Onboarding workflow" required={canReadOnboardingWorkflows}>
              <Select
                value={workflowId != null ? String(workflowId) : null}
                onValueChange={(value) => setWorkflowId(value ? Number(value) : null)}
                disabled={loading || !canReadOnboardingWorkflows}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      canReadOnboardingWorkflows
                        ? "Select workflow"
                        : "Workflow assigned automatically"
                    }
                  >
                    {canReadOnboardingWorkflows
                      ? getSelectedLabel(workflowOptions, workflowId, "Select workflow")
                      : "Workflow assigned automatically"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workflowOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {canReadOnboardingWorkflows
                        ? "No workflows found"
                        : "Your role cannot view workflow templates."}
                    </div>
                  ) : null}
                  {workflowOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="About this action"
              >
                <InfoIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left">
                Submitting creates the employee profile and starts the selected onboarding workflow.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
            <RotateCcwIcon data-icon="inline-start" />
            Reset
          </Button>
          <Button type="submit" size="lg" disabled={submitting || loading}>
            {submitting ? (
              <>
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus2Icon data-icon="inline-start" />
                Invite & start onboarding
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
