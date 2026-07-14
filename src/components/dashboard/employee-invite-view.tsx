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
  createEmployeeProfile,
  listBranches,
  listDepartments,
  listEmployees,
  listOnboardingWorkflows,
  listPositions,
  type AdminRecord,
  type CreateEmployeePayload,
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

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "probation", label: "Probation" },
  { value: "intern", label: "Intern" },
  { value: "consultant", label: "Consultant" },
  { value: "temporary", label: "Temporary" },
] as const

type LookupOption = {
  id: number
  label: string
  branchId: number | null
  departmentId: number | null
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
  const candidates = ["id", "value", "employee_id", "employeeId", "branch_id", "department_id", "position_id"]
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
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [branchId, setBranchId] = React.useState<number | null>(null)
  const [departmentId, setDepartmentId] = React.useState<number | null>(null)
  const [positionId, setPositionId] = React.useState<number | null>(null)
  const [reportsToId, setReportsToId] = React.useState<number | null>(null)
  const [employmentType, setEmploymentType] = React.useState<string>("full_time")
  const [hireDate, setHireDate] = React.useState<string>("")
  const [probationEndDate, setProbationEndDate] = React.useState<string>("")
  const [workflowId, setWorkflowId] = React.useState<number | null>(null)

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])

  const [loading, setLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState("")

  React.useEffect(() => {
    setToken(readStoredToken())
  }, [])

  React.useEffect(() => {
    if (!token) {
      setError("Authentication token not found. Please log in again.")
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [br, de, po, wo, em] = await Promise.allSettled([
          listBranches(token, { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }),
          listDepartments(token, { page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
          listPositions(token, { page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
          listOnboardingWorkflows(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
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
          failures.push("workflows")
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
  }, [token])

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
    const byDepartment = allPositionOptions.filter((option) => option.departmentId === departmentId)
    if (byDepartment.length > 0) return byDepartment
    // Positions with no department set still constrained by branch when possible.
    return allPositionOptions.filter(
      (option) =>
        option.departmentId === null &&
        (option.branchId === null || option.branchId === branchId)
    )
  }, [allPositionOptions, branchId, departmentId])

  const allEmployeeOptions = React.useMemo(
    () =>
      toLookupOptions(
        employees,
        ["fullName", "full_name", "displayName", "display_name", "name", "firstName", "first_name"],
        ["primary_branch_id", "branch_id", "primaryBranchId", "primary_branch", "branch"],
        [
          "primary_department_id",
          "department_id",
          "primaryDepartmentId",
          "departmentId",
          "primary_department",
          "department",
        ]
      ),
    [employees]
  )

  const employeeOptions = React.useMemo(() => {
    if (departmentId === null) return allEmployeeOptions
    const filtered = allEmployeeOptions.filter(
      (option) => option.departmentId === null || option.departmentId === departmentId
    )
    return filtered.length > 0 ? filtered : allEmployeeOptions
  }, [allEmployeeOptions, departmentId])

  const workflowOptions = React.useMemo(
    () => toLookupOptions(workflows, ["name", "title", "workflow_name", "workflowName"], [], []),
    [workflows]
  )

  const handleBranchChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setBranchId(Number.isFinite(next as number) ? next : null)
    setDepartmentId(null)
    setPositionId(null)
    setReportsToId(null)
  }

  const handleDepartmentChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setDepartmentId(Number.isFinite(next as number) ? next : null)
    setPositionId(null)
    setReportsToId(null)
  }

  const handlePositionChange = (value: string | null) => {
    const next = value ? Number(value) : null
    setPositionId(Number.isFinite(next as number) ? next : null)
  }

  React.useEffect(() => {
    if (employmentType !== "probation" && probationEndDate) {
      setProbationEndDate("")
    }
  }, [employmentType, probationEndDate])

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setBranchId(null)
    setDepartmentId(null)
    setPositionId(null)
    setReportsToId(null)
    setEmploymentType("full_time")
    setHireDate("")
    setProbationEndDate("")
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
    if (!workflowId) {
      toast.error("Please select an onboarding workflow.")
      return
    }

    const payload: CreateEmployeePayload = {
      employee_no: "",
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
      probation_end_date: employmentType === "probation" ? probationEndDate || undefined : undefined,
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
      onboarding: {
        auto_start: true,
        submit: true,
        workflow_id: workflowId,
        title: `Onboarding for ${firstName.trim()} ${lastName.trim()}`.trim(),
        description: "",
        planned_start_date: hireDate || undefined,
        planned_completion_date: undefined,
        provisioning: {
          role_ids: [],
          branch_access_ids: branchId ? [branchId] : [],
          attendance_mode: "shift",
        },
      },
      metadata: {
        source: "invite",
        branch_name: getSelectedLabel(branchOptions, branchId, ""),
        department_name: getSelectedLabel(departmentOptions, departmentId, ""),
        position_name: getSelectedLabel(positionOptions, positionId, ""),
      },
    }

    setSubmitting(true)
    try {
      await createEmployeeProfile(token, payload)
      showSuccessAlert("Employee invite created successfully. Onboarding started.")
      resetForm()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create employee invite."
      showErrorAlert(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const departmentDisabled = branchId === null || loading
  const positionDisabled = departmentId === null || loading

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
                      departmentId === null ? "Select department first" : "Select position"
                    }
                  >
                    {departmentId === null
                      ? "Select department first"
                      : getSelectedLabel(positionOptions, positionId, "Select position")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positionOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {departmentId === null
                        ? "Select a department first"
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
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select manager (optional)">
                    {getSelectedLabel(employeeOptions, reportsToId, "Select manager (optional)")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {loading ? "Loading employees…" : "No employees found"}
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

            <FieldShell label="Onboarding workflow" required>
              <Select
                value={workflowId != null ? String(workflowId) : null}
                onValueChange={(value) => setWorkflowId(value ? Number(value) : null)}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select workflow">
                    {getSelectedLabel(workflowOptions, workflowId, "Select workflow")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workflowOptions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No workflows found</div>
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

            {employmentType === "probation" ? (
              <FieldShell label="Probation end date">
                <DatePickerPresets
                  value={probationEndDate}
                  onChange={setProbationEndDate}
                  placeholder="Select probation end date"
                />
              </FieldShell>
            ) : null}
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
