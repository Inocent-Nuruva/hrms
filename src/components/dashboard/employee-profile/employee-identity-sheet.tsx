"use client"

import * as React from "react"
import Link from "next/link"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import {
  Button as FluentButton,
  Field as FluentField,
  Input as FluentInput,
  Textarea as FluentTextarea,
} from "@fluentui/react-components"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import {
  listBranches,
  listCostCenters,
  listDepartmentPositions,
  listDepartments,
  listEmployeeGrades,
  listEmployees,
  patchEmployeeById,
  patchEmployeeAssignment,
  updateUserById,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  readStoredToken,
  readString,
  employeeDisplayNameFromLinkedUser,
  readNumber,
  readRelatedId,
  relatedDepartmentIds,
  relatedDepartmentNames,
  relatedBranchId,
  normalizeDepartmentScopedPositionOptions,
  fallbackDepartmentScopedPositionOptions,
  recordOptionLabel,
  resolveCompanyUserId,
  resolveCompanyUserRecord,
} from "@/components/dashboard/employee-profile/profile-shared"

export function EmployeeIdentitySheet({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: AdminRecord
  onSaved: () => Promise<void>
}) {
  const identityDialogOpen = open
  const [identitySubmitting, setIdentitySubmitting] = React.useState(false)
  const [identityError, setIdentityError] = React.useState<string | null>(null)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [profilePassword, setProfilePassword] = React.useState("")
  const [showProfilePassword, setShowProfilePassword] = React.useState(false)
  const [branchId, setBranchId] = React.useState("")
  const [departmentId, setDepartmentId] = React.useState("")
  const [positionId, setPositionId] = React.useState("")
  const [managerId, setManagerId] = React.useState("")
  const [gradeId, setGradeId] = React.useState("")
  const [costCenterId, setCostCenterId] = React.useState("")
  const [assignmentEffectiveDate, setAssignmentEffectiveDate] = React.useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [assignmentReason, setAssignmentReason] = React.useState("")
  const [branchOptions, setBranchOptions] = React.useState<AdminRecord[]>([])
  const [departmentOptions, setDepartmentOptions] = React.useState<AdminRecord[]>([])
  const [positionOptions, setPositionOptions] = React.useState<AdminRecord[]>([])
  const [managerOptions, setManagerOptions] = React.useState<AdminRecord[]>([])
  const [gradeOptions, setGradeOptions] = React.useState<AdminRecord[]>([])
  const [costCenterOptions, setCostCenterOptions] = React.useState<AdminRecord[]>([])
  const [organizationOptionsLoading, setOrganizationOptionsLoading] = React.useState(false)
  const selectedBranchId = React.useMemo(() => {
    const parsed = Number(branchId)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [branchId])
  const filteredDepartmentOptions = React.useMemo(() => {
    if (selectedBranchId === null) {
      return departmentOptions
    }
    const matching = departmentOptions.filter((row) => relatedBranchId(row) === selectedBranchId)
    if (matching.length > 0) {
      return matching
    }
    return departmentOptions.filter((row) => relatedBranchId(row) === null)
  }, [departmentOptions, selectedBranchId])
  const selectedDepartmentName = React.useMemo(() => {
    const selected = filteredDepartmentOptions.find((row) => String(readNumber(row.id) ?? "") === departmentId)
    const label = selected ? recordOptionLabel(selected) : ""
    return label === "-" ? "" : label.trim().toLowerCase()
  }, [departmentId, filteredDepartmentOptions])
  const departmentPositionOptions = React.useMemo(() => {
    if (!departmentId) {
      return []
    }

    const selectedDepartmentId = Number(departmentId)
    if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
      return []
    }

    const matching = fallbackDepartmentScopedPositionOptions(
      positionOptions,
      selectedDepartmentId,
      selectedBranchId
    )
    const currentEmployee = employee
    const selected = positionOptions.find((row) => String(readNumber(row.id) ?? "") === positionId)
      ?? (currentEmployee && positionId && readRelatedId(currentEmployee, ["primary_position", "primaryPosition", "position", "positionDetail"], ["primary_position_id", "primaryPositionId", "position_id", "positionId"]) === Number(positionId)
        ? (currentEmployee.primary_position ?? currentEmployee.primaryPosition ?? currentEmployee.position ?? currentEmployee.positionDetail) as AdminRecord
        : null)
    return selected && !matching.some((row) => readNumber(row.id) === readNumber(selected.id))
      ? [...matching, selected]
      : matching
  }, [departmentId, employee, positionId, positionOptions, selectedBranchId])
  const filteredCostCenterOptions = React.useMemo(() => {
    const selectedDepartmentId = departmentId ? Number(departmentId) : null
    return costCenterOptions.filter((row) => {
      const costCenterDepartmentId = readRelatedId(
        row,
        ["department", "departmentDetail", "primary_department", "primaryDepartment"],
        ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId"]
      )
      if (selectedDepartmentId === null) {
        return true
      }
      return costCenterDepartmentId === null || costCenterDepartmentId === selectedDepartmentId
    })
  }, [costCenterOptions, departmentId])
  const filteredManagerOptions = React.useMemo(
    () => {
      const eligible = managerOptions.filter((row) => readNumber(row.id) !== readNumber(employee.id))
      return eligible.filter((row) => {
        if (!departmentId) return false
        return (
          relatedDepartmentIds(row).has(Number(departmentId)) ||
          (selectedDepartmentName !== "" && relatedDepartmentNames(row).has(selectedDepartmentName))
        )
      })
    },
    [departmentId, employee.id, managerOptions, selectedDepartmentName]
  )

  React.useEffect(() => {
    if (!identityDialogOpen || !departmentId) {
      return
    }

      const hasSelectedDepartment = filteredDepartmentOptions.some(
      (row) => String(readNumber(row.id) ?? "") === departmentId
      ) || departmentOptions.some((row) => String(readNumber(row.id) ?? "") === departmentId)
    if (!hasSelectedDepartment) {
      const currentEmployee = employee
      const selectedDepartment = departmentOptions.find((row) => String(readNumber(row.id) ?? "") === departmentId)
        ?? (currentEmployee && readRelatedId(currentEmployee, ["primary_department", "primaryDepartment", "department", "departmentDetail"], ["primary_department_id", "primaryDepartmentId", "department_id", "departmentId"]) === Number(departmentId)
          ? (currentEmployee.primary_department ?? currentEmployee.primaryDepartment ?? currentEmployee.department ?? currentEmployee.departmentDetail) as AdminRecord
          : null)
      if (selectedDepartment) {
        setDepartmentOptions((current) => current.some((row) => readNumber(row.id) === readNumber(selectedDepartment.id))
          ? current
          : [...current, selectedDepartment])
      }
    }
  }, [departmentId, departmentOptions, employee, filteredDepartmentOptions, identityDialogOpen])

  React.useEffect(() => {
    if (!identityDialogOpen || !positionId) {
      return
    }

    const hasSelectedPosition = departmentPositionOptions.some(
      (row) => String(readNumber(row.id) ?? "") === positionId
    )
    if (!hasSelectedPosition) {
      setPositionId("")
    }
  }, [departmentPositionOptions, identityDialogOpen, positionId])

  React.useEffect(() => {
    if (!identityDialogOpen || !managerId) {
      return
    }

    const hasSelectedManager = filteredManagerOptions.some(
      (row) => String(readNumber(row.id) ?? "") === managerId
    )
    if (!hasSelectedManager) {
      setManagerId("")
    }
  }, [filteredManagerOptions, identityDialogOpen, managerId])

  React.useEffect(() => {
    if (!identityDialogOpen || !costCenterId) {
      return
    }

    const hasSelectedCostCenter = filteredCostCenterOptions.some(
      (row) => String(readNumber(row.id) ?? "") === costCenterId
    )
    if (!hasSelectedCostCenter) {
      setCostCenterId("")
    }
  }, [costCenterId, filteredCostCenterOptions, identityDialogOpen])

  const loadOrganizationOptions = React.useCallback(async (selectedBranchId = "", selectedDepartmentId = "") => {
    void selectedBranchId
    const token = readStoredToken()
    if (!token) return
    setOrganizationOptionsLoading(true)
    setIdentityError(null)
    try {
      const selectedDepartmentNumber = Number(selectedDepartmentId)
      const hasSelectedDepartment = Number.isFinite(selectedDepartmentNumber) && selectedDepartmentNumber > 0
      const [branches, departments, positions, managers, grades, costCenters] = await Promise.allSettled([
        listBranches(token, { page: 1, limit: 100 }),
        listDepartments(token, { page: 1, limit: 100 }),
        hasSelectedDepartment
          ? listDepartmentPositions(token, selectedDepartmentId).then((rows) =>
              normalizeDepartmentScopedPositionOptions(rows, selectedDepartmentNumber)
            )
          : Promise.resolve<AdminRecord[]>([]),
        hasSelectedDepartment
          ? listEmployees(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
              department_id: selectedDepartmentNumber,
            }).then((result) => result.rows)
          : Promise.resolve<AdminRecord[]>([]),
        listEmployeeGrades(token),
        listCostCenters(token),
      ])
      const failedOptions: string[] = []
      if (branches.status === "fulfilled") {
        setBranchOptions(branches.value.rows)
      } else {
        failedOptions.push("branches")
      }
      if (departments.status === "fulfilled") {
        setDepartmentOptions(departments.value.rows)
      } else {
        failedOptions.push("departments")
      }
      if (positions.status === "fulfilled") {
        setPositionOptions(positions.value)
      } else {
        setPositionOptions([])
        if (hasSelectedDepartment) {
          failedOptions.push("positions")
        }
      }
      if (managers.status === "fulfilled") {
        setManagerOptions(managers.value)
      } else {
        setManagerOptions([])
      }
      if (grades.status === "fulfilled") {
        setGradeOptions(grades.value)
      } else {
        failedOptions.push("grades")
      }
      if (costCenters.status === "fulfilled") {
        setCostCenterOptions(costCenters.value)
      } else {
        failedOptions.push("cost centers")
      }
      if (failedOptions.length > 0) {
        setIdentityError(`Some organization options could not be loaded: ${failedOptions.join(", ")}.`)
      }
    } catch (errorObject) {
      setIdentityError(errorObject instanceof Error ? errorObject.message : "Failed to load organization options.")
    } finally {
      setOrganizationOptionsLoading(false)
    }
  }, [])

  // Prefill from the employee each time the sheet opens (previously done in the trigger's onClick).
  React.useEffect(() => {
    if (!open) {
      return
    }
    const companyUser = resolveCompanyUserRecord(employee)
    const currentBranchId = String(
      readRelatedId(
        employee,
        ["primary_branch", "primaryBranch", "branch", "branchDetail"],
        ["primary_branch_id", "primaryBranchId", "branch_id", "branchId"]
      ) ?? ""
    )
    const currentDepartmentId = String(
      readRelatedId(
        employee,
        ["primary_department", "primaryDepartment", "department", "departmentDetail"],
        ["primary_department_id", "primaryDepartmentId", "department_id", "departmentId"]
      ) ?? ""
    )
    setFirstName(readString(companyUser ?? employee, ["first_name", "firstName"]) === "-" ? "" : readString(companyUser ?? employee, ["first_name", "firstName"]))
    setLastName(readString(companyUser ?? employee, ["last_name", "lastName"]) === "-" ? "" : readString(companyUser ?? employee, ["last_name", "lastName"]))
    setUsername(readString(companyUser ?? {}, ["username", "user_no"]) === "-" ? "" : readString(companyUser ?? {}, ["username", "user_no"]))
    setEmail(readString(companyUser ?? {}, ["email"]) === "-" ? "" : readString(companyUser ?? {}, ["email"]))
    setProfilePassword("")
    setShowProfilePassword(false)
    setBranchId(currentBranchId)
    setDepartmentId(currentDepartmentId)
    setPositionId(
      String(
        readRelatedId(
          employee,
          ["primary_position", "primaryPosition", "position", "positionDetail"],
          ["primary_position_id", "primaryPositionId", "position_id", "positionId"]
        ) ?? ""
      )
    )
    setManagerId(
      String(
        readRelatedId(
          employee,
          ["manager", "managerDetail", "reportsTo"],
          ["reports_to", "reportsToId", "manager_id", "managerId"]
        ) ?? ""
      )
    )
    setGradeId(
      String(
        readRelatedId(
          employee,
          ["grade", "gradeDetail"],
          ["grade_id", "gradeId"]
        ) ?? ""
      )
    )
    setCostCenterId(
      String(
        readRelatedId(
          employee,
          ["cost_center", "costCenter", "cost_center_detail", "costCenterDetail"],
          ["cost_center_id", "costCenterId"]
        ) ?? ""
      )
    )
    setAssignmentEffectiveDate(new Date().toISOString().slice(0, 10))
    setAssignmentReason("")
    setIdentityError(null)
                    void loadOrganizationOptions(currentBranchId, currentDepartmentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-dvh min-h-0 w-full min-w-0 max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0 data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:max-w-full data-[side=right]:border-l data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 gap-1 border-b border-border px-4 py-4 pr-14 sm:pl-6 sm:pr-14">
          <SheetTitle>Update Profile</SheetTitle>
          <SheetDescription>
            Update account details and keep branch, department, position, manager, grade, and cost center in sync.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-5 [scrollbar-gutter:stable] sm:px-6">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <FluentField label="First name" className="min-w-0">
            <FluentInput
              value={firstName}
              onChange={(_event, data) => setFirstName(data.value)}
              className="!w-full"
              placeholder="Enter first name"
            />
          </FluentField>
          <FluentField label="Last name" className="min-w-0">
            <FluentInput
              value={lastName}
              onChange={(_event, data) => setLastName(data.value)}
              className="!w-full"
              placeholder="Enter last name"
            />
          </FluentField>
          <FluentField label="Username" className="min-w-0">
            <FluentInput
              value={username}
              onChange={(_event, data) => setUsername(data.value)}
              className="!w-full"
              placeholder="Enter username"
            />
          </FluentField>
          <FluentField label="Email" className="min-w-0">
            <FluentInput
              type="email"
              value={email}
              onChange={(_event, data) => setEmail(data.value)}
              className="!w-full"
              placeholder="Enter email"
            />
          </FluentField>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 [&>*]:min-w-0">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-foreground">Branch</span>
              <FluentSelect
                ariaLabel="Branch"
                className="w-full min-w-0"
                value={branchId}
                disabled={organizationOptionsLoading}
                placeholder="No branch"
                onChange={(value) => {
                  const nextBranchId = value
                  setBranchId(nextBranchId)
                  setDepartmentId("")
                  setPositionId("")
                  setManagerId("")
                  setCostCenterId("")
                  void loadOrganizationOptions(nextBranchId, "")
                }}
                options={[
                  { value: "", label: "No branch" },
                  ...branchOptions.flatMap((option) => {
                    const id = readNumber(option.id)
                    return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-foreground">Department</span>
              <FluentSelect
                ariaLabel="Department"
                className="w-full min-w-0"
                value={departmentId}
                disabled={organizationOptionsLoading}
                placeholder="Select department"
                onChange={(value) => {
                  const nextDepartmentId = value
                  setDepartmentId(nextDepartmentId)
                  setPositionId("")
                  setManagerId("")
                  setCostCenterId("")
                  void loadOrganizationOptions(branchId, nextDepartmentId)
                }}
                options={[
                  { value: "", label: "Select department" },
                  ...filteredDepartmentOptions.flatMap((option) => {
                    const id = readNumber(option.id)
                    return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-foreground">Position</span>
              <FluentSelect
                ariaLabel="Position"
                className="w-full min-w-0"
                value={positionId}
                disabled={!departmentId || organizationOptionsLoading}
                placeholder={
                  departmentPositionOptions.length === 0
                    ? "No positions configured for this department"
                    : "Select position"
                }
                onChange={(value) => setPositionId(value)}
                options={[
                  {
                    value: "",
                    label:
                      departmentPositionOptions.length === 0
                        ? "No positions configured for this department"
                        : "Select position",
                  },
                  ...departmentPositionOptions.flatMap((option) => {
                    const id = readNumber(option.id)
                    return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
              {departmentPositionOptions.length === 0 ? (
                <span className="text-[11px] font-normal normal-case tracking-normal text-destructive">
                  Create positions for this exact department in {" "}
                  <Link href="/dashboard/positions" className="font-medium text-primary hover:underline">
                    Positions
                  </Link>
                  .
                </span>
              ) : null}
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-foreground">Manager</span>
            <FluentSelect
              ariaLabel="Manager"
              className="w-full min-w-0"
              value={managerId}
              disabled={!departmentId || organizationOptionsLoading}
              placeholder="No manager"
              onChange={(value) => setManagerId(value)}
              options={[
                { value: "", label: "No manager" },
                ...filteredManagerOptions.flatMap((option) => {
                  const id = readNumber(option.id)
                  return id === null
                    ? []
                    : [{ value: String(id), label: employeeDisplayNameFromLinkedUser(option) }]
                }),
              ]}
            />
            <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
              Shows all other employees in the selected department.
            </span>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-foreground">Grade</span>
            <FluentSelect
              ariaLabel="Grade"
              className="w-full min-w-0"
              value={gradeId}
              disabled={organizationOptionsLoading}
              placeholder="No grade"
              onChange={(value) => setGradeId(value)}
              options={[
                { value: "", label: "No grade" },
                ...gradeOptions.flatMap((option) => {
                  const id = readNumber(option.id)
                  return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                }),
              ]}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-foreground">Cost Center</span>
            <FluentSelect
              ariaLabel="Cost Center"
              className="w-full min-w-0"
              value={costCenterId}
              disabled={organizationOptionsLoading}
              placeholder="No cost center"
              onChange={(value) => setCostCenterId(value)}
              options={[
                { value: "", label: "No cost center" },
                ...filteredCostCenterOptions.flatMap((option) => {
                  const id = readNumber(option.id)
                  return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                }),
              ]}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-foreground">
              Assignment Effective Date
            </span>
            <DatePickerPresets
              value={assignmentEffectiveDate}
              onChange={setAssignmentEffectiveDate}
            />
          </label>
          <FluentField label="New password (optional)" className="min-w-0">
            <div className="relative">
              <FluentInput
                type={showProfilePassword ? "text" : "password"}
                value={profilePassword}
                onChange={(_event, data) => setProfilePassword(data.value)}
                minLength={6}
                className="password-reveal-managed !w-full pr-10"
                placeholder="Leave blank to keep current password"
              />
              <FluentButton
                type="button"
                appearance="subtle"
                aria-label={showProfilePassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowProfilePassword((prev) => !prev)}
              >
                {showProfilePassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </FluentButton>
            </div>
          </FluentField>
          <FluentField label="Assignment reason (optional)" className="min-w-0 sm:col-span-2">
            <FluentTextarea
              value={assignmentReason}
              onChange={(_event, data) => setAssignmentReason(data.value)}
              className="!w-full"
            />
          </FluentField>
          </div>
          {identityError ? <p role="alert" className="mt-3 text-sm text-rose-600">{identityError}</p> : null}
        </div>
        <SheetFooter className="mt-0 w-full shrink-0 flex-row justify-end gap-2 border-t border-border bg-background px-4 py-3 sm:px-6">
          <FluentButton
            type="button"
            disabled={identitySubmitting}
            appearance="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </FluentButton>
          <FluentButton
            type="button"
            disabled={identitySubmitting}
            appearance="primary"
            onClick={async () => {
              const token = readStoredToken()
              const userId = resolveCompanyUserId(employee)
              const employeeId = readNumber(employee.id)
              const trimmedFirstName = firstName.trim()
              const trimmedLastName = lastName.trim()
              const trimmedUsername = username.trim()
              const trimmedEmail = email.trim()
              const trimmedPassword = profilePassword.trim()

              if (!token) {
                setIdentityError("Authentication required. Please log in again.")
                return
              }
              if (employeeId === null) {
                setIdentityError("Unable to identify this employee record.")
                return
              }
              if (!trimmedFirstName) {
                setIdentityError("First name is required.")
                return
              }
              if (!trimmedLastName) {
                setIdentityError("Last name is required.")
                return
              }
              if (userId !== null && !trimmedUsername) {
                setIdentityError("Username is required.")
                return
              }
              if (userId !== null && !trimmedEmail) {
                setIdentityError("Email is required.")
                return
              }
              if (userId !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                setIdentityError("Please enter a valid email address.")
                return
              }
              if (trimmedPassword && trimmedPassword.length < 6) {
                setIdentityError("Password must be at least 6 characters.")
                return
              }
              if ((departmentId || positionId || branchId || managerId || gradeId || costCenterId) && !assignmentEffectiveDate.trim()) {
                setIdentityError("Assignment effective date is required.")
                return
              }

              setIdentitySubmitting(true)
              setIdentityError(null)
              try {
                const payload: AdminRecord = {
                  first_name: trimmedFirstName,
                  last_name: trimmedLastName,
                  user_no: trimmedUsername,
                  email: trimmedEmail,
                }
                if (trimmedPassword) {
                  payload.password = trimmedPassword
                }
                // Names/email sync between the user and its employee records
                // server-side in one transaction, so a linked user is updated
                // directly; unlinked employees are patched on their own.
                if (userId !== null) {
                  await updateUserById(userId, token, payload)
                } else {
                  await patchEmployeeById(employeeId, token, {
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                  })
                }
                if (departmentId || positionId || branchId || managerId || gradeId || costCenterId) {
                  await patchEmployeeAssignment(token, employeeId, {
                  effective_date: assignmentEffectiveDate.trim(),
                  branch_id: branchId ? Number(branchId) : null,
                  departments: departmentId ? [
                    {
                      department_id: Number(departmentId),
                      is_primary: true,
                    },
                  ] : [],
                  primary_position_id: positionId ? Number(positionId) : null,
                  reports_to: managerId ? Number(managerId) : null,
                  grade_id: gradeId ? Number(gradeId) : null,
                  cost_center_id: costCenterId ? Number(costCenterId) : null,
                  reason: assignmentReason.trim() || undefined,
                  })
                }
                onOpenChange(false)
                await onSaved()
              } catch (errorObject) {
                setIdentityError(errorObject instanceof Error ? errorObject.message : "Failed to update user details.")
              } finally {
                setIdentitySubmitting(false)
              }
            }}
          >
            {identitySubmitting ? "Updating..." : "Update Profile"}
          </FluentButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
