"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  createEmployeeProfile,
  listBranches,
  listDepartments,
  listEmployees,
  listOnboardingWorkflows,
  listPositions,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "probation", label: "Probation" },
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

function getName(record: AdminRecord, ...keys: string[]): string {
  for (const k of keys) {
    const v = record[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  if (record.name && typeof record.name === "string") return record.name.trim()
  const first = typeof record.first_name === "string" ? record.first_name : ""
  const last = typeof record.last_name === "string" ? record.last_name : ""
  const full = `${first} ${last}`.trim()
  return full || "—"
}

function getId(record: AdminRecord): number | null {
  const candidates = ["id", "value", "employee_id", "branch_id", "department_id", "position_id"]
  for (const k of candidates) {
    const v = record[k]
    if (typeof v === "number") return v
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v)
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

function getSelectedLabel(options: LookupOption[], id: number | null, fallback: string) {
  if (id === null) {
    return fallback
  }
  return options.find((option) => option.id === id)?.label ?? fallback
}

export function EmployeeInviteView() {
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
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
          listDepartments(token, { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }),
          listPositions(token, { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }),
          listOnboardingWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
          listEmployees(token, { page: 1, limit: 200, sortBy: "first_name", sortOrder: "ASC", employment_status: "active" }),
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
    load()
    return () => { cancelled = true }
  }, [token])

  const branchOptions = React.useMemo(
    () =>
      branches
        .map<LookupOption | null>((branch) => {
          const id = getId(branch)
          return id !== null ? { id, label: getName(branch, "branch_name", "name"), branchId: null, departmentId: null } : null
        })
        .filter((option): option is LookupOption => option !== null),
    [branches]
  )
  const allDepartmentOptions = React.useMemo(
    () =>
      departments
        .map<LookupOption | null>((department) => {
          const id = getId(department)
          if (id === null) {
            return null
          }
          return {
            id,
            label: getName(department, "department_name", "name"),
            branchId: readRelatedId(department, ["branch_id", "primary_branch_id", "branch"]) ?? null,
            departmentId: null,
          }
        })
        .filter((option): option is LookupOption => option !== null),
    [departments]
  )
  const departmentOptions = React.useMemo(() => {
    if (branchId === null) {
      return allDepartmentOptions
    }
    const filtered = allDepartmentOptions.filter(
      (option) => option.branchId === null || option.branchId === branchId
    )
    return filtered.length > 0 ? filtered : allDepartmentOptions
  }, [allDepartmentOptions, branchId])
  const allPositionOptions = React.useMemo(
    () =>
      positions
        .map<LookupOption | null>((position) => {
          const id = getId(position)
          if (id === null) {
            return null
          }
          return {
            id,
            label: getName(position, "position_name", "name", "title"),
            branchId: readRelatedId(position, ["branch_id", "primary_branch_id", "branch"]) ?? null,
            departmentId:
              readRelatedId(position, ["department_id", "primary_department_id", "department"]) ?? null,
          }
        })
        .filter((option): option is LookupOption => option !== null),
    [positions]
  )
  const positionOptions = React.useMemo(() => {
    const filtered = allPositionOptions.filter((option) => {
      const matchesBranch = branchId === null || option.branchId === null || option.branchId === branchId
      const matchesDepartment =
        departmentId === null || option.departmentId === null || option.departmentId === departmentId
      return matchesBranch && matchesDepartment
    })
    return filtered.length > 0 ? filtered : allPositionOptions
  }, [allPositionOptions, branchId, departmentId])
  const allEmployeeOptions = React.useMemo(
    () =>
      employees
        .map<LookupOption | null>((employee) => {
          const id = getId(employee)
          if (id === null) {
            return null
          }
          return {
            id,
            label: getName(employee, "full_name", "name", "first_name"),
            branchId:
              readRelatedId(employee, ["primary_branch_id", "branch_id", "primary_branch", "branch"]) ?? null,
            departmentId:
              readRelatedId(employee, [
                "primary_department_id",
                "department_id",
                "primary_department",
                "department",
              ]) ?? null,
          }
        })
        .filter((option): option is LookupOption => option !== null),
    [employees]
  )
  const employeeOptions = React.useMemo(() => {
    const filtered = allEmployeeOptions.filter((option) => {
      const matchesDepartment =
        departmentId === null || option.departmentId === null || option.departmentId === departmentId
      return matchesDepartment
    })
    return filtered.length > 0 ? filtered : allEmployeeOptions
  }, [allEmployeeOptions, departmentId])
  const workflowOptions = React.useMemo(
    () =>
      workflows
        .map<LookupOption | null>((workflow) => {
          const id = getId(workflow)
          return id !== null ? { id, label: getName(workflow, "name", "title", "workflow_name"), branchId: null, departmentId: null } : null
        })
        .filter((option): option is LookupOption => option !== null),
    [workflows]
  )

  React.useEffect(() => {
    if (branchId === null) {
      return
    }
    if (!departmentOptions.some((option) => option.id === departmentId)) {
      setDepartmentId(null)
    }
  }, [branchId, departmentId, departmentOptions])

  React.useEffect(() => {
    if (departmentId === null) {
      return
    }
    if (!positionOptions.some((option) => option.id === positionId)) {
      setPositionId(null)
    }
    if (!employeeOptions.some((option) => option.id === reportsToId)) {
      setReportsToId(null)
    }
  }, [departmentId, employeeOptions, positionId, positionOptions, reportsToId])

  React.useEffect(() => {
    if (employmentType !== "probation" && probationEndDate) {
      setProbationEndDate("")
    }
  }, [employmentType, probationEndDate])

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
    if (!branchId || !departmentId || !positionId) {
      toast.error("Branch, Department and Position are required.")
      return
    }
    if (!workflowId) {
      toast.error("Please select an onboarding workflow.")
      return
    }

    const payload: any = {
      employee_no: "",
      primary_branch_id: branchId,
      primary_department_id: departmentId,
      primary_position_id: positionId,
      primary_designation_id: positionId, // fallback same as position if no designation separate
      position_id: positionId,
      employment_status: "onboarding",
      employment_type: employmentType,
      reports_to: reportsToId ?? undefined,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      hire_date: hireDate || undefined,
      probation_end_date: employmentType === "probation" ? probationEndDate || undefined : undefined,
      departments: [{ is_primary: true, department_id: departmentId }],
      contacts: [],
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
          branch_access_ids: [],
          attendance_mode: "shift",
          shift_assignment: null,
          timetable_assignment: null,
          device_assignment: null,
        },
      },
      metadata: { source: "invite" },
    }

    setSubmitting(true)
    try {
      const res = await createEmployeeProfile(token, payload)
      showSuccessAlert("Employee invite created successfully. Onboarding started.")
      // reset form
      setFirstName("")
      setLastName("")
      setBranchId(null)
      setDepartmentId(null)
      setPositionId(null)
      setReportsToId(null)
      setEmploymentType("full_time")
      setHireDate("")
      setProbationEndDate("")
      setWorkflowId(null)
    } catch (err: any) {
      const msg = err?.message || "Failed to create employee invite."
      showErrorAlert(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? (
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  Loading reference data…
                </p>
              </div>
            ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required />
                </div>

                <div>
                  <Label>Branch *</Label>
                  <Select value={branchId ? String(branchId) : ""} onValueChange={(v) => setBranchId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch">
                        {getSelectedLabel(branchOptions, branchId, "Select branch")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No branches found</div>}
                      {branchOptions.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Department *</Label>
                  <Select value={departmentId ? String(departmentId) : ""} onValueChange={(v) => setDepartmentId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department">
                        {getSelectedLabel(departmentOptions, departmentId, "Select department")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No departments found</div>}
                      {departmentOptions.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Position *</Label>
                  <Select value={positionId ? String(positionId) : ""} onValueChange={(v) => setPositionId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position">
                        {getSelectedLabel(positionOptions, positionId, "Select position")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No positions found</div>}
                      {positionOptions.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reports To</Label>
                  <Select value={reportsToId ? String(reportsToId) : ""} onValueChange={(v) => setReportsToId(v ? Number(v) : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager (optional)">
                        {getSelectedLabel(employeeOptions, reportsToId, "Select manager (optional)")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {employeeOptions.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Employment Type *</Label>
                  <Select value={employmentType} onValueChange={(v) => setEmploymentType(v || "full_time")}>
                    <SelectTrigger>
                      <SelectValue>
                        {EMPLOYMENT_TYPES.find((type) => type.value === employmentType)?.label ?? "Employment Type"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Onboarding Workflow *</Label>
                  <Select value={workflowId ? String(workflowId) : ""} onValueChange={(v) => setWorkflowId(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select workflow">
                        {getSelectedLabel(workflowOptions, workflowId, "Select workflow")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {workflowOptions.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No workflows found</div>}
                      {workflowOptions.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Hire Date</Label>
                  <DatePickerPresets
                    value={hireDate}
                    onChange={setHireDate}
                    placeholder="Select hire date"
                  />
                </div>

                {employmentType === "probation" ? (
                  <div>
                    <Label>Probation End Date</Label>
                    <DatePickerPresets
                      value={probationEndDate}
                      onChange={setProbationEndDate}
                      placeholder="Select probation end date"
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || loading}>
                  {submitting ? "Creating Invite..." : "Create Employee & Start Onboarding"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFirstName(""); setLastName(""); setBranchId(null); setDepartmentId(null); setPositionId(null);
                    setReportsToId(null); setEmploymentType("full_time"); setHireDate(""); setProbationEndDate(""); setWorkflowId(null);
                  }}
                  disabled={submitting}
                >
                  Clear
                </Button>
              </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
