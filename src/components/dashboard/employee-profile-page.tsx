"use client"
import { EmployeeLeaveBalanceCard } from "@/components/leave/leave-accrual-summary"
import { EmployeeCoverCard } from "@/components/leave/employee-cover-card"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  EyeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { SearchSparkle20Regular as SearchIcon } from "@fluentui/react-icons"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmployeeMovement,
  createEmployeePosition,
  cancelEmployeeMovement,
  deleteEmployeePosition,
  downloadEmploymentLetter,
  downloadEmployeeLetterPreview,
  getEmployeeById,
  listBranches,
  listCostCenters,
  listDepartmentPositions,
  listDepartments,
  listEmployeeGrades,
  listEmployeeMovementOperations,
  listEmployeeMovements,
  listEmployeePositions,
  listAllEmployees,
  listEmployees,
  generateEmployeeTemplateLetter,
  listEmployeeLetterHistory,
  listPositions,
  patchEmployeeAssignment,
  patchEmployeePosition,
  submitEmployeeMovement,
  type AdminRecord,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { pageBleedClass } from "@/components/dashboard/talent-visuals"
import { EmployeeStatusDialog } from "@/components/dashboard/employee-status-dialog"
import { EmployeeStatusHistorySection } from "@/components/dashboard/employee-status-history"
import { EmploymentContractsView } from "@/components/dashboard/employment-contracts-view"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { filterEmployeesByDirectorySearch, getEmployeeDirectoryContactSummary } from "@/lib/employee-directory-search"
import { AnimatePresence, motion } from "framer-motion"
import { useDashboardMotion } from "@/lib/dashboard-motion"
import {
  EMPLOYMENT_TYPE_OPTIONS,
  EMPLOYEE_STATUS_REFRESH_KEY,
  EMPLOYEE_STATUS_REFRESH_EVENT,
  normalizeEmployeeStatus,
  readStoredToken,
  readString,
  asRecord,
  asRecordArray,
  firstRecordArray,
  readNestedString,
  mergeEmployeeProfileRecord,
  formatProfileDate,
  getProfileSectionItems,
  employeeDisplayName,
  employeeDisplayNameFromLinkedUser,
  formatDateTime,
  formatLabelValue,
  statusTone,
  assignmentTypeTone,
  readNumber,
  readRelatedId,
  isPrimaryEmployeePosition,
  relatedDepartmentIds,
  relatedDepartmentNames,
  relatedBranchId,
  normalizeDepartmentScopedPositionOptions,
  fallbackDepartmentScopedPositionOptions,
  recordOptionLabel,
  emptyPositionAssignmentForm,
  positionAssignmentPreview,
  readPositionAssignmentForm,
  emptyDepartmentAssignmentForm,
  resolveDepartmentAssignmentDepartmentId,
  isPrimaryDepartmentAssignment,
  departmentAssignmentPreview,
  readDepartmentAssignmentForm,
  EmployeeMovementFormState,
  EMPLOYEE_MOVEMENT_TYPE_OPTIONS,
  emptyEmployeeMovementForm,
  movementBelongsToEmployee,
  movementSupportsSubmit,
  movementSupportsCancel,
  movementChangeValueSummary,
  buildEmployeeAssignmentPayload,
  sectionTitleToRouteKey,
  routeKeyToSectionTitle,
  PositionAssignmentFormState,
  POSITION_ASSIGNMENT_TYPE_OPTIONS,
  POSITION_ASSIGNMENT_STATUS_OPTIONS,
  DepartmentAssignmentFormState,
} from "@/components/dashboard/employee-profile/profile-shared"
import { Section } from "@/components/dashboard/employee-profile/profile-record-section"
import { EmployeeIdentitySheet } from "@/components/dashboard/employee-profile/employee-identity-sheet"
import { EmployeeProfileHero } from "@/components/dashboard/employee-profile/employee-profile-hero"

const PROFILE_SECTION_DEFS: Array<{
  title: string
  /** Compact tab label (matches Employees top-tab density). Full title used in content. */
  tabLabel: string
  keys: string[]
  special?: "company_user"
}> = [
  { title: "Contacts", tabLabel: "Contacts", keys: ["contacts", "contact_details", "contactDetails"] },
  { title: "Documents", tabLabel: "Documents", keys: ["documents", "employee_documents", "employeeDocuments"] },
  { title: "Letters", tabLabel: "Letters", keys: [] },
  { title: "Contracts", tabLabel: "Contracts", keys: [] },
  { title: "Addresses", tabLabel: "Addresses", keys: ["addresses", "address_details", "addressDetails"] },
  { title: "Relatives", tabLabel: "Relatives", keys: ["relatives", "next_of_kin", "nextOfKin"] },
  { title: "Identifications", tabLabel: "IDs", keys: ["identifications", "identification_documents", "identificationDocuments"] },
  { title: "Bank Accounts", tabLabel: "Banks", keys: ["bank_accounts", "bankAccounts"] },
  { title: "Departments", tabLabel: "Depts", keys: ["departments", "department_assignments", "departmentAssignments"] },
  { title: "Positions", tabLabel: "Positions", keys: ["position_assignments", "positionAssignments"] },
  { title: "Movements", tabLabel: "Movements", keys: ["employee_movements", "employeeMovements"] },
  { title: "Status History", tabLabel: "History", keys: [] },
  { title: "Academic Qualifications", tabLabel: "Academic", keys: ["academic_qualifications", "academicQualifications"] },
  { title: "Professional Qualifications", tabLabel: "Professional", keys: ["professional_qualifications", "professionalQualifications"] },
  { title: "Experience Details", tabLabel: "Experience", keys: ["experience_details", "experienceDetails"] },
  { title: "Company User", tabLabel: "User", keys: [], special: "company_user" },
]

function resolveProfileSectionItems(employee: AdminRecord, def: (typeof PROFILE_SECTION_DEFS)[number]) {
  if (def.special === "company_user") {
    return firstRecordArray(
      employee.company_user ? [asRecord(employee.company_user) ?? {}] : [],
      employee.companyUser ? [asRecord(employee.companyUser) ?? {}] : []
    ).map((companyUser) => ({
      ...companyUser,
      __linked_account: true,
      __can_manage_linked_account: true,
    }))
  }
  const items = getProfileSectionItems(employee, def.keys)
  if (def.title !== "Contacts" || items.length > 0) {
    return items
  }

  const accountContact = getEmployeeDirectoryContactSummary(employee)
  const companyUserId = readNumber(
    employee.company_user_id ?? employee.companyUserId,
  )
  return accountContact && companyUserId !== null
    ? [
        {
          contact_type: "Linked account",
          ...accountContact,
          source: "Employee or company-user account",
          __linked_account: true,
          __can_manage_linked_account: true,
        },
      ]
    : []
}

function ProfileSectionsTabs({
  employee,
  employeeId,
  onMutated,
  requestedRouteKey,
  header,
}: {
  employee: AdminRecord
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
  header?: React.ReactNode
}) {
  const sections = React.useMemo(
    () =>
      PROFILE_SECTION_DEFS.map((def) => {
        const items = resolveProfileSectionItems(employee, def)
        return {
          title: def.title,
          tabLabel: def.tabLabel,
          routeKey: sectionTitleToRouteKey(def.title),
          items,
          count: items.length,
        }
      }),
    [employee]
  )

  const actor = useDashboardActor()
  const canManageContracts = canPerformPermission(actor.permissionLabels, "employment_contracts:manage")
  const fullName = `${String(employee.first_name ?? "")} ${String(employee.last_name ?? "")}`.trim()

  const requestedTitle = routeKeyToSectionTitle(requestedRouteKey)
  const [activeTitle, setActiveTitle] = React.useState(
    () => requestedTitle ?? sections[0]?.title ?? "Contacts"
  )

  React.useEffect(() => {
    if (requestedTitle) {
      setActiveTitle(requestedTitle)
    }
  }, [requestedTitle])

  const active = sections.find((section) => section.title === activeTitle) ?? sections[0]
  const activeIndex = Math.max(0, sections.findIndex((section) => section.title === active?.title))
  const [slideDirection, setSlideDirection] = React.useState(1)
  const motionPreset = useDashboardMotion()

  const selectSection = React.useCallback((title: string) => {
    const nextIndex = sections.findIndex((section) => section.title === title)
    if (nextIndex < 0 || title === activeTitle) return
    setSlideDirection(nextIndex > activeIndex ? 1 : -1)
    setActiveTitle(title)
  }, [activeIndex, activeTitle, sections])

  return (
    <div className="border-x border-b border-border bg-card">
      {header}
      <div
        className="sticky top-12 z-20 flex items-center gap-1 overflow-x-auto border-t border-border bg-card/95 px-3 backdrop-blur [scrollbar-width:none]"
        role="tablist"
        aria-label="Employee profile sections"
      >
        {sections.map((section) => {
          const isActive = section.title === active?.title
          const needsAttention = requestedRouteKey === section.routeKey
          return (
            <button
              key={section.routeKey}
              type="button"
              role="tab"
              title={`${section.title} (${section.count})`}
              aria-label={`${section.title}, ${section.count} items`}
              aria-selected={isActive}
              onClick={() => selectSection(section.title)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                needsAttention && !isActive ? "text-primary" : null
              )}
            >
              {section.tabLabel}
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {section.count}
              </span>
            </button>
          )
        })}
      </div>

        <div className="relative overflow-hidden border-t border-border p-4 sm:p-5">
          <AnimatePresence mode="wait" custom={slideDirection} initial={false}>
            {active ? (
              <motion.div
                key={active.routeKey}
                custom={slideDirection}
                initial={
                  motionPreset.reduce
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: slideDirection * 48 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  motionPreset.reduce
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: slideDirection * -48 }
                }
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {active.title === "Departments" ? (
                  <DepartmentAssignmentsSection
                    items={active.items}
                    employee={employee}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                ) : active.title === "Positions" ? (
                  <PositionAssignmentsSection
                    items={active.items}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                ) : active.title === "Movements" ? (
                  <EmployeeMovementsSection
                    items={active.items}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                ) : active.title === "Status History" ? (
                  <EmployeeStatusHistorySection employeeId={employeeId} token={readStoredToken()} />
                ) : active.title === "Contracts" ? (
                  <EmploymentContractsView employee={{ id: employeeId, full_name: fullName }} canManage={canManageContracts} />
                ) : active.title === "Letters" ? (
                  <EmployeeLettersSection employeeId={employeeId} />
                ) : (
                  <Section
                    title={active.title}
                    items={active.items}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
    </div>
  )
}

function EmployeeLettersSection({ employeeId }: { employeeId: number | null }) {
  const [history, setHistory] = React.useState<AdminRecord[]>([])
  const [letterType, setLetterType] = React.useState<"JOINING_FORM" | "OTHER">("JOINING_FORM")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token || employeeId === null) return
    try {
      setError(null)
      setHistory(await listEmployeeLetterHistory(token, employeeId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load generated letters.")
    }
  }, [employeeId])

  React.useEffect(() => { void refresh() }, [refresh])

  async function preview() {
    const token = readStoredToken()
    if (!token || employeeId === null) return
    setBusy(true)
    try {
      const blob = await downloadEmployeeLetterPreview(token, employeeId, letterType)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the letter.")
    } finally { setBusy(false) }
  }

  async function generate() {
    const token = readStoredToken()
    if (!token || employeeId === null) return
    setBusy(true)
    try {
      await generateEmployeeTemplateLetter(token, employeeId, letterType)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the letter.")
    } finally { setBusy(false) }
  }

  async function download(id: number) {
    const token = readStoredToken()
    if (!token) return
    try {
      const blob = await downloadEmploymentLetter(token, id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "employee-letter.pdf"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the letter.")
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">Template type
          <select className="h-9 rounded-md border border-border bg-background px-2" value={letterType} onChange={(event) => setLetterType(event.target.value as typeof letterType)}>
            <option value="JOINING_FORM">Joining form</option><option value="OTHER">Other letter</option>
          </select>
        </label>
        <button type="button" disabled={busy || employeeId === null} onClick={() => void preview()} className="rounded-md border border-border px-3 py-2 text-sm">Preview</button>
        <button type="button" disabled={busy || employeeId === null} onClick={() => void generate()} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Generate and save</button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="divide-y divide-border rounded-md border border-border">
        {history.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No generated letters yet.</p> : history.map((row) => (
          <div key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div><p className="text-sm font-medium">{String(row.title ?? "Generated letter")}</p><p className="text-xs text-muted-foreground">{String(row.document_type ?? "")} · {String(row.created_at ?? "")}</p></div>
            <button type="button" onClick={() => void download(Number(row.id))} className="rounded-md border border-border px-3 py-1.5 text-sm">Download PDF</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function DepartmentAssignmentsSection({
  items,
  employee,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  items: AdminRecord[]
  employee: AdminRecord
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const token = readStoredToken()
  const routeKey = sectionTitleToRouteKey("Departments")
  const isHighlighted = requestedRouteKey === routeKey
  const [departmentOptions, setDepartmentOptions] = React.useState<AdminRecord[]>([])
  const [departmentsLoading, setDepartmentsLoading] = React.useState(false)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<AdminRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<AdminRecord | null>(null)
  const [form, setForm] = React.useState<DepartmentAssignmentFormState>(() =>
    emptyDepartmentAssignmentForm()
  )
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  React.useEffect(() => {
    if (!addingRecord && !editingRecord) {
      setForm(emptyDepartmentAssignmentForm())
      return
    }
    if (editingRecord) {
      setForm(readDepartmentAssignmentForm(editingRecord))
      return
    }
    setForm(emptyDepartmentAssignmentForm())
  }, [addingRecord, editingRecord])

  React.useEffect(() => {
    if (!token || (!addingRecord && !editingRecord)) {
      return
    }

    let cancelled = false
    setDepartmentsLoading(true)

    void listDepartments(token, {
      page: 1,
      limit: 200,
      sortBy: "name",
      sortOrder: "ASC",
    })
      .then((result) => {
        if (!cancelled) {
          setDepartmentOptions(result.rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDepartmentOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDepartmentsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, editingRecord, token])

  const closeDialogs = React.useCallback(() => {
    setAddingRecord(false)
    setEditingRecord(null)
    setDeletingRecord(null)
    setMutationError(null)
    setSubmitting(false)
  }, [])

  const currentAssignments = React.useMemo(
    () =>
      items
        .map((item) => {
          const departmentId = resolveDepartmentAssignmentDepartmentId(item)
          if (departmentId === null) {
            return null
          }
          return {
            id: readNumber(item.id),
            department_id: departmentId,
            is_primary: isPrimaryDepartmentAssignment(item),
          }
        })
        .filter(
          (
            assignment
          ): assignment is { id: number | null; department_id: number; is_primary: boolean } =>
            assignment !== null
        ),
    [items]
  )

  const renderAssignmentField = (label: string, value: string) => {
    if (!value || value === "-") {
      return null
    }
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-foreground">{value}</p>
      </div>
    )
  }

  const submitMutation = React.useCallback(async () => {
    if (!employeeId || !token) {
      setMutationError("Authentication required. Please log in again.")
      return
    }

    const departmentId = Number(form.department_id)
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      setMutationError("Select a department.")
      return
    }
    if (!form.effective_date.trim()) {
      setMutationError("Effective date is required.")
      return
    }

    const editingAssignmentId = editingRecord ? readNumber(editingRecord.id) : null
    const duplicate = currentAssignments.find(
      (assignment) =>
        assignment.department_id === departmentId &&
        assignment.id !== editingAssignmentId
    )
    if (duplicate) {
      setMutationError("This department is already assigned to the employee.")
      return
    }

    let nextAssignments = currentAssignments
      .filter((assignment) => assignment.id !== editingAssignmentId)
      .map((assignment) => ({
        department_id: assignment.department_id,
        is_primary: assignment.is_primary,
      }))

    nextAssignments.push({
      department_id: departmentId,
      is_primary: form.is_primary === "true",
    })

    if (form.is_primary === "true") {
      nextAssignments = nextAssignments.map((assignment) => ({
        ...assignment,
        is_primary: assignment.department_id === departmentId,
      }))
    } else if (!nextAssignments.some((assignment) => assignment.is_primary) && nextAssignments.length > 0) {
      nextAssignments = nextAssignments.map((assignment, index) => ({
        ...assignment,
        is_primary: index === 0,
      }))
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await patchEmployeeAssignment(
        token,
        employeeId,
        buildEmployeeAssignmentPayload(
          employee,
          nextAssignments,
          form.effective_date,
          form.reason
        )
      )
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update department assignments."
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    closeDialogs,
    currentAssignments,
    editingRecord,
    employee,
    employeeId,
    form,
    onMutated,
    token,
  ])

  const deleteMutation = React.useCallback(async () => {
    if (!deletingRecord || !employeeId || !token) {
      return
    }

    const deletingAssignmentId = readNumber(deletingRecord.id)
    if (deletingAssignmentId === null) {
      setMutationError("Missing assignment id; cannot delete this department.")
      return
    }

    let nextAssignments = currentAssignments
      .filter((assignment) => assignment.id !== deletingAssignmentId)
      .map((assignment) => ({
        department_id: assignment.department_id,
        is_primary: assignment.is_primary,
      }))

    if (!nextAssignments.some((assignment) => assignment.is_primary) && nextAssignments.length > 0) {
      nextAssignments = nextAssignments.map((assignment, index) => ({
        ...assignment,
        is_primary: index === 0,
      }))
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await patchEmployeeAssignment(
        token,
        employeeId,
        buildEmployeeAssignmentPayload(
          employee,
          nextAssignments,
          new Date().toISOString().slice(0, 10),
          ""
        )
      )
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete department assignment."
      )
    } finally {
      setSubmitting(false)
    }
  }, [closeDialogs, currentAssignments, deletingRecord, employee, employeeId, onMutated, token])

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Departments section"
        className={cn(
          "scroll-mt-24 px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted &&
            "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Departments</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
            {items.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
                Not provided
              </span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {employeeId ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No department assignments available.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const departmentName = departmentAssignmentPreview(item)
              const assignedAt = formatDateTime(item.created_at)
              const branchName = readNestedString(item.department, ["branch_name", "branchName"])
              return (
                <div
                  key={`departments-${index}`}
                  className="border-b border-border pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {departmentName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {isPrimaryDepartmentAssignment(item) ? (
                          <span className="text-xs text-muted-foreground">Primary</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit department assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord(item)}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete department assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord(item)}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {renderAssignmentField("Assigned At", assignedAt)}
                    {renderAssignmentField("Branch", branchName)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={addingRecord || Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingRecord ? "Edit Department Assignment" : "Add Department Assignment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingRecord
                ? "Update the selected employee department assignment."
                : "Create a new department assignment for this employee."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Department
              </span>
              <FluentSelect
                ariaLabel="Department"
                className="w-full"
                value={form.department_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, department_id: value }))
                }
                disabled={departmentsLoading}
                placeholder={departmentsLoading ? "Loading departments..." : "Select department"}
                options={[
                  {
                    value: "",
                    label: departmentsLoading ? "Loading departments..." : "Select department",
                  },
                  ...departmentOptions.flatMap((option) => {
                    const optionId = readNumber(option.id)
                    if (optionId === null) {
                      return []
                    }
                    return [{ value: String(optionId), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Primary Assignment
              </span>
              <FluentSelect
                ariaLabel="Primary Assignment"
                className="w-full"
                value={form.is_primary}
                onChange={(value) =>
                  setForm((current) => ({ ...current, is_primary: value }))
                }
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ]}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Effective Date
              </span>
              <DatePickerPresets
                value={form.effective_date}
                onChange={(value) =>
                  setForm((current) => ({ ...current, effective_date: value }))
                }
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </span>
              <Textarea
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reason: event.target.value }))
                }
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitMutation()}
            >
              {submitting ? "Saving..." : editingRecord ? "Save" : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this employee department assignment and keep the remaining assignment history aligned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => void deleteMutation()}
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PositionAssignmentsSection({
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const token = readStoredToken()
  const routeKey = sectionTitleToRouteKey("Positions")
  const isHighlighted = requestedRouteKey === routeKey
  const [positionOptions, setPositionOptions] = React.useState<AdminRecord[]>([])
  const [positionsLoading, setPositionsLoading] = React.useState(false)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<AdminRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<AdminRecord | null>(null)
  const [form, setForm] = React.useState<PositionAssignmentFormState>(() => emptyPositionAssignmentForm())
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  React.useEffect(() => {
    if (!addingRecord && !editingRecord) {
      setForm(emptyPositionAssignmentForm())
      return
    }
    if (editingRecord) {
      setForm(readPositionAssignmentForm(editingRecord))
      return
    }
    setForm(emptyPositionAssignmentForm())
  }, [addingRecord, editingRecord])

  React.useEffect(() => {
    if (!token || (!addingRecord && !editingRecord)) {
      return
    }

    let cancelled = false
    setPositionsLoading(true)

    void listPositions(token, {
      page: 1,
      limit: 200,
      sortBy: "name",
      sortOrder: "ASC",
    })
      .then((result) => {
        if (!cancelled) {
          setPositionOptions(result.rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPositionOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPositionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, editingRecord, token])

  const closeDialogs = React.useCallback(() => {
    setAddingRecord(false)
    setEditingRecord(null)
    setDeletingRecord(null)
    setMutationError(null)
    setSubmitting(false)
  }, [])

  const submitMutation = React.useCallback(async () => {
    if (!employeeId || !token) {
      setMutationError("Authentication required. Please log in again.")
      return
    }

    const positionId = Number(form.position_id)
    if (!Number.isFinite(positionId) || positionId <= 0) {
      setMutationError("Select a position.")
      return
    }
    if (!form.start_date.trim()) {
      setMutationError("Start date is required.")
      return
    }

    const payload: AdminRecord = {
      employee_id: employeeId,
      position_id: positionId,
      assignment_type: form.assignment_type,
      status: form.status,
      is_primary: form.is_primary === "true",
      start_date: form.start_date,
      end_date: form.end_date.trim() || null,
      notes: form.notes.trim() || null,
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      if (editingRecord) {
        const assignmentId = readNumber(editingRecord.id)
        if (assignmentId === null) {
          setMutationError("Missing assignment id; cannot update this position.")
          return
        }
        await patchEmployeePosition(token, assignmentId, payload)
      } else {
        await createEmployeePosition(token, payload)
      }
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to save position assignment.")
    } finally {
      setSubmitting(false)
    }
  }, [closeDialogs, editingRecord, employeeId, form, onMutated, token])

  const deleteMutation = React.useCallback(async () => {
    if (!deletingRecord || !token) {
      return
    }

    const assignmentId = readNumber(deletingRecord.id)
    if (assignmentId === null) {
      setMutationError("Missing assignment id; cannot delete this position.")
      return
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await deleteEmployeePosition(token, assignmentId)
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to delete position assignment.")
    } finally {
      setSubmitting(false)
    }
  }, [closeDialogs, deletingRecord, onMutated, token])

  const renderAssignmentField = (label: string, value: string, className?: string) => {
    if (!value || value === "-") {
      return null
    }
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("break-words text-foreground", className)}>{value}</p>
      </div>
    )
  }

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Positions section"
        className={cn(
          "scroll-mt-24 px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Positions</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
            {items.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {employeeId ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No position assignments available.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const status = readString(item, ["status"])
              const assignmentType = readString(item, ["assignment_type", "assignmentType"])
              const positionName = positionAssignmentPreview(item)
              const departmentName = readNestedString(
                item.department ?? item.departmentDetail ?? item.primary_department,
                ["name", "department_name", "departmentName"]
              )
              const startDate = formatProfileDate(
                readString(item, ["start_date", "startDate", "effective_from", "effectiveFrom"])
              )
              const endDate = formatProfileDate(
                readString(item, ["end_date", "endDate", "effective_to", "effectiveTo"])
              )
              const notes = readString(item, ["notes"])

              return (
                <div key={`positions-${index}`} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">{positionName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {assignmentType !== "-" ? (
                          <span className={cn("font-medium", assignmentTypeTone(assignmentType))}>
                            {formatLabelValue(assignmentType)}
                          </span>
                        ) : null}
                        {status !== "-" ? (
                          <span className={cn("font-medium", statusTone(status))}>
                            {formatLabelValue(status)}
                          </span>
                        ) : null}
                        {isPrimaryEmployeePosition(item) &&
                        assignmentType.trim().toLowerCase() !== "primary" ? (
                          <span className="font-medium text-primary">Primary</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit position assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord(item)}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete position assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord(item)}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {renderAssignmentField("Department", departmentName)}
                    {renderAssignmentField("Start Date", startDate)}
                    {renderAssignmentField("End Date", endDate)}
                    {renderAssignmentField("Notes", notes)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={addingRecord || Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingRecord ? "Edit Position Assignment" : "Add Position Assignment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingRecord
                ? "Update the selected employee position assignment."
                : "Create a new position assignment for this employee."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Position
              </span>
              <FluentSelect
                ariaLabel="Position"
                className="w-full"
                value={form.position_id}
                onChange={(value) => setForm((current) => ({ ...current, position_id: value }))}
                disabled={positionsLoading}
                placeholder={positionsLoading ? "Loading positions..." : "Select position"}
                options={[
                  {
                    value: "",
                    label: positionsLoading ? "Loading positions..." : "Select position",
                  },
                  ...positionOptions.flatMap((option) => {
                    const optionId = readNumber(option.id)
                    if (optionId === null) {
                      return []
                    }
                    return [{ value: String(optionId), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assignment Type
              </span>
              <FluentSelect
                ariaLabel="Assignment Type"
                className="w-full"
                value={form.assignment_type}
                onChange={(value) =>
                  setForm((current) => ({ ...current, assignment_type: value }))
                }
                options={POSITION_ASSIGNMENT_TYPE_OPTIONS.map((option) => ({
                  value: option,
                  label: formatLabelValue(option),
                }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </span>
              <FluentSelect
                ariaLabel="Status"
                className="w-full"
                value={form.status}
                onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                options={POSITION_ASSIGNMENT_STATUS_OPTIONS.map((option) => ({
                  value: option,
                  label: formatLabelValue(option),
                }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start Date
              </span>
              <DatePickerPresets
                value={form.start_date}
                onChange={(value) => setForm((current) => ({ ...current, start_date: value }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                End Date
              </span>
              <DatePickerPresets
                value={form.end_date}
                onChange={(value) => setForm((current) => ({ ...current, end_date: value }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Primary Assignment
              </span>
              <FluentSelect
                ariaLabel="Primary Assignment"
                className="w-full"
                value={form.is_primary}
                onChange={(value) =>
                  setForm((current) => ({ ...current, is_primary: value }))
                }
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ]}
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </span>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitMutation()}
            >
              {submitting ? "Saving..." : editingRecord ? "Save" : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this employee position assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => void deleteMutation()}
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EmployeeMovementsSection({
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const token = readStoredToken()
  const routeKey = sectionTitleToRouteKey("Movements")
  const isHighlighted = requestedRouteKey === routeKey
  const [branchOptions, setBranchOptions] = React.useState<AdminRecord[]>([])
  const [departmentOptions, setDepartmentOptions] = React.useState<AdminRecord[]>([])
  const [positionOptions, setPositionOptions] = React.useState<AdminRecord[]>([])
  const [managerOptions, setManagerOptions] = React.useState<AdminRecord[]>([])
  const [gradeOptions, setGradeOptions] = React.useState<AdminRecord[]>([])
  const [costCenterOptions, setCostCenterOptions] = React.useState<AdminRecord[]>([])
  const [scopedPositionOptions, setScopedPositionOptions] = React.useState<AdminRecord[]>([])
  const [scopedPositionOptionsLoading, setScopedPositionOptionsLoading] = React.useState(false)
  const [scopedPositionOptionsLoaded, setScopedPositionOptionsLoaded] = React.useState(false)
  const [scopedManagerOptions, setScopedManagerOptions] = React.useState<AdminRecord[]>([])
  const [scopedManagerOptionsLoading, setScopedManagerOptionsLoading] = React.useState(false)
  const [scopedManagerOptionsLoaded, setScopedManagerOptionsLoaded] = React.useState(false)
  const [optionsLoading, setOptionsLoading] = React.useState(false)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [viewingRecord, setViewingRecord] = React.useState<AdminRecord | null>(null)
  const [movementOperations, setMovementOperations] = React.useState<AdminRecord[]>([])
  const [operationsLoading, setOperationsLoading] = React.useState(false)
  const [form, setForm] = React.useState<EmployeeMovementFormState>(() => emptyEmployeeMovementForm())
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [actioningId, setActioningId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  React.useEffect(() => {
    if (!addingRecord) {
      setForm(emptyEmployeeMovementForm())
      setMutationError(null)
      return
    }

    if (!token) {
      return
    }

    let cancelled = false
    setOptionsLoading(true)

    void Promise.allSettled([
      listBranches(token, { page: 1, limit: 200 }),
      listDepartments(token, { page: 1, limit: 200 }),
      listPositions(token, { page: 1, limit: 200 }),
      listEmployeeGrades(token),
      listCostCenters(token),
    ])
      .then(([branches, departments, positions, grades, costCenters]) => {
        if (cancelled) {
          return
        }
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
          setPositionOptions(positions.value.rows)
        } else {
          failedOptions.push("positions")
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
        setManagerOptions([])
        if (failedOptions.length > 0) {
          setMutationError(`Some movement options could not be loaded: ${failedOptions.join(", ")}.`)
        }
      })
      .catch((errorObject) => {
        if (!cancelled) {
          setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to load movement options.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, token])

  React.useEffect(() => {
    if (!viewingRecord || !token) {
      setMovementOperations([])
      setDetailError(null)
      return
    }

    const movementId = readNumber(viewingRecord.id)
    if (movementId === null) {
      setMovementOperations([])
      setDetailError("Missing movement id; unable to load operations.")
      return
    }

    let cancelled = false
    setOperationsLoading(true)
    setDetailError(null)

    void listEmployeeMovementOperations(token, movementId)
      .then((rows) => {
        if (!cancelled) {
          setMovementOperations(rows)
        }
      })
      .catch((errorObject) => {
        if (!cancelled) {
          setMovementOperations([])
          setDetailError(errorObject instanceof Error ? errorObject.message : "Failed to load movement operations.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOperationsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, viewingRecord])

  React.useEffect(() => {
    if (!addingRecord || !token || !form.new_department_id) {
      setScopedPositionOptions([])
      setScopedPositionOptionsLoaded(false)
      setScopedPositionOptionsLoading(false)
      setScopedManagerOptions([])
      setScopedManagerOptionsLoaded(false)
      setScopedManagerOptionsLoading(false)
      return
    }

    const selectedDepartmentId = Number(form.new_department_id)
    if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
      setScopedPositionOptions([])
      setScopedPositionOptionsLoaded(false)
      setScopedPositionOptionsLoading(false)
      setScopedManagerOptions([])
      setScopedManagerOptionsLoaded(false)
      setScopedManagerOptionsLoading(false)
      return
    }

    let cancelled = false
    setScopedPositionOptionsLoading(true)
    setScopedPositionOptionsLoaded(false)
    setScopedManagerOptionsLoading(true)
    setScopedManagerOptionsLoaded(false)

    void Promise.allSettled([
      listDepartmentPositions(token, selectedDepartmentId),
      listEmployees(token, {
        page: 1,
        limit: 200,
        sortBy: "created_at",
        sortOrder: "DESC",
        department_id: selectedDepartmentId,
      }),
    ])
      .then(([positions, managers]) => {
        if (cancelled) {
          return
        }
        if (positions.status === "fulfilled") {
          setScopedPositionOptions(
            normalizeDepartmentScopedPositionOptions(positions.value, selectedDepartmentId)
          )
          setScopedPositionOptionsLoaded(true)
        } else {
          setScopedPositionOptions([])
          setScopedPositionOptionsLoaded(false)
        }
        if (managers.status === "fulfilled") {
          setScopedManagerOptions(
            managers.value.rows.filter((row) => readNumber(row.id) !== employeeId)
          )
          setScopedManagerOptionsLoaded(true)
        } else {
          setScopedManagerOptions([])
          setScopedManagerOptionsLoaded(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScopedPositionOptionsLoading(false)
          setScopedManagerOptionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, employeeId, form.new_department_id, token])

  const selectedBranchId = React.useMemo(() => {
    const parsed = Number(form.new_branch_id)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [form.new_branch_id])

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
    const selected = filteredDepartmentOptions.find(
      (row) => String(readNumber(row.id) ?? "") === form.new_department_id
    )
    const label = selected ? recordOptionLabel(selected) : ""
    return label === "-" ? "" : label.trim().toLowerCase()
  }, [filteredDepartmentOptions, form.new_department_id])

  const availablePositionOptions = React.useMemo(() => {
    if (!form.new_department_id) {
      return positionOptions
    }

    const selectedDepartmentId = Number(form.new_department_id)
    if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
      return positionOptions
    }

    if (scopedPositionOptionsLoaded) {
      return scopedPositionOptions
    }

    return fallbackDepartmentScopedPositionOptions(
      positionOptions,
      selectedDepartmentId,
      selectedBranchId
    )
  }, [
    form.new_department_id,
    positionOptions,
    scopedPositionOptions,
    scopedPositionOptionsLoaded,
    selectedBranchId,
  ])

  const filteredCostCenterOptions = React.useMemo(() => {
    const selectedDepartmentId = form.new_department_id ? Number(form.new_department_id) : null
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
  }, [costCenterOptions, form.new_department_id])

  const availableManagerOptions = React.useMemo(() => {
    const eligible = managerOptions.filter((row) => readNumber(row.id) !== employeeId)
    if (!form.new_department_id) {
      return eligible
    }

    if (scopedManagerOptionsLoaded) {
      return scopedManagerOptions
    }

    return eligible.filter((row) => {
      const selectedDepartmentId = Number(form.new_department_id)
      if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
        return true
      }
      return (
        relatedDepartmentIds(row).has(selectedDepartmentId) ||
        (selectedDepartmentName !== "" && relatedDepartmentNames(row).has(selectedDepartmentName))
      )
    })
  }, [
    employeeId,
    form.new_department_id,
    managerOptions,
    scopedManagerOptions,
    scopedManagerOptionsLoaded,
    selectedDepartmentName,
  ])

  React.useEffect(() => {
    if (!addingRecord || !form.new_department_id) {
      return
    }

    const stillVisible = filteredDepartmentOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_department_id
    )
    if (!stillVisible) {
      setForm((current) => ({
        ...current,
        new_department_id: "",
        new_position_id: "",
        new_cost_center_id: "",
        new_manager_employee_id: "",
      }))
    }
  }, [addingRecord, filteredDepartmentOptions, form.new_department_id])

  React.useEffect(() => {
    if (!addingRecord || !form.new_position_id) {
      return
    }

    const stillVisible = availablePositionOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_position_id
    )
    if (!stillVisible) {
      setForm((current) => ({ ...current, new_position_id: "" }))
    }
  }, [addingRecord, availablePositionOptions, form.new_position_id])

  React.useEffect(() => {
    if (!addingRecord || !form.new_manager_employee_id) {
      return
    }

    const stillVisible = availableManagerOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_manager_employee_id
    )
    if (!stillVisible) {
      setForm((current) => ({ ...current, new_manager_employee_id: "" }))
    }
  }, [addingRecord, availableManagerOptions, form.new_manager_employee_id])

  React.useEffect(() => {
    if (!addingRecord || !form.new_cost_center_id) {
      return
    }

    const stillVisible = filteredCostCenterOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_cost_center_id
    )
    if (!stillVisible) {
      setForm((current) => ({ ...current, new_cost_center_id: "" }))
    }
  }, [addingRecord, filteredCostCenterOptions, form.new_cost_center_id])

  const sortedItems = React.useMemo(
    () =>
      [...items].sort((first, second) => {
        const firstCreatedAt = new Date(readString(first, ["createdAt", "created_at"])).getTime()
        const secondCreatedAt = new Date(readString(second, ["createdAt", "created_at"])).getTime()
        return (Number.isFinite(secondCreatedAt) ? secondCreatedAt : 0) - (Number.isFinite(firstCreatedAt) ? firstCreatedAt : 0)
      }),
    [items]
  )

  const showBranchField = form.movement_type === "BRANCH_TRANSFER" || form.movement_type === "COMPOSITE"
  const showDepartmentField = form.movement_type === "DEPARTMENT_TRANSFER" || form.movement_type === "COMPOSITE"
  const showPositionField = ["POSITION_CHANGE", "PROMOTION", "DEMOTION", "COMPOSITE"].includes(form.movement_type)
  const showManagerField = form.movement_type === "REPORTING_MANAGER_CHANGE" || form.movement_type === "COMPOSITE"
  const showGradeField = form.movement_type === "GRADE_CHANGE" || form.movement_type === "COMPOSITE"
  const showCostCenterField = form.movement_type === "COST_CENTER_CHANGE" || form.movement_type === "COMPOSITE"
  const showEmploymentTypeField =
    form.movement_type === "EMPLOYMENT_TYPE_CHANGE" || form.movement_type === "COMPOSITE"

  const closeAddDialog = React.useCallback(() => {
    setAddingRecord(false)
    setMutationError(null)
    setSubmitting(false)
  }, [])

  const submitCreate = React.useCallback(async () => {
    if (!token || employeeId === null) {
      setMutationError("Authentication required. Please log in again.")
      return
    }

    if (!form.title.trim()) {
      setMutationError("Title is required.")
      return
    }
    if (!form.reason.trim()) {
      setMutationError("Reason is required.")
      return
    }
    if (!form.effective_date.trim()) {
      setMutationError("Effective date is required.")
      return
    }

    const selectedTargets = [
      form.new_branch_id,
      form.new_department_id,
      form.new_position_id,
      form.new_grade_id,
      form.new_cost_center_id,
      form.new_manager_employee_id,
      form.new_employment_type,
    ].filter((value) => value.trim() !== "")

    if (showBranchField && !form.new_branch_id) {
      setMutationError("Choose the target branch for this movement.")
      return
    }
    if (showDepartmentField && !form.new_department_id) {
      setMutationError("Choose the target department for this movement.")
      return
    }
    if (showPositionField && !form.new_position_id) {
      setMutationError("Choose the target position for this movement.")
      return
    }
    if (showManagerField && !form.new_manager_employee_id) {
      setMutationError("Choose the target reporting manager for this movement.")
      return
    }
    if (showGradeField && !form.new_grade_id) {
      setMutationError("Choose the target grade for this movement.")
      return
    }
    if (showCostCenterField && !form.new_cost_center_id) {
      setMutationError("Choose the target cost center for this movement.")
      return
    }
    if (showEmploymentTypeField && !form.new_employment_type) {
      setMutationError("Choose the target employment type for this movement.")
      return
    }
    if (form.movement_type === "COMPOSITE" && selectedTargets.length === 0) {
      setMutationError("Choose at least one target change for a composite movement.")
      return
    }

    const payload: AdminRecord = {
      employee_id: employeeId,
      movement_type: form.movement_type,
      title: form.title.trim(),
      reason: form.reason.trim(),
      effective_date: form.effective_date,
    }

    if (form.new_branch_id) {
      payload.new_branch_id = Number(form.new_branch_id)
    }
    if (form.new_department_id) {
      payload.new_department_id = Number(form.new_department_id)
    }
    if (form.new_position_id) {
      payload.new_position_id = Number(form.new_position_id)
    }
    if (form.new_grade_id) {
      payload.new_grade_id = Number(form.new_grade_id)
    }
    if (form.new_cost_center_id) {
      payload.new_cost_center_id = Number(form.new_cost_center_id)
    }
    if (form.new_manager_employee_id) {
      payload.new_manager_employee_id = Number(form.new_manager_employee_id)
    }
    if (form.new_employment_type) {
      payload.new_employment_type = form.new_employment_type
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await createEmployeeMovement(token, payload)
      closeAddDialog()
      await onMutated()
    } catch (errorObject) {
      setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to create movement.")
    } finally {
      setSubmitting(false)
    }
  }, [
    closeAddDialog,
    employeeId,
    form,
    onMutated,
    showBranchField,
    showCostCenterField,
    showDepartmentField,
    showEmploymentTypeField,
    showGradeField,
    showManagerField,
    showPositionField,
    token,
  ])

  const triggerMovementAction = React.useCallback(
    async (movement: AdminRecord, action: "submit" | "cancel") => {
      if (!token) {
        setMutationError("Authentication required. Please log in again.")
        return
      }

      const movementId = readNumber(movement.id)
      if (movementId === null) {
        setMutationError("Missing movement id; cannot continue.")
        return
      }

      setActioningId(movementId)
      setMutationError(null)
      try {
        if (action === "submit") {
          await submitEmployeeMovement(token, movementId)
        } else {
          await cancelEmployeeMovement(token, movementId)
        }
        await onMutated()
      } catch (errorObject) {
        setMutationError(errorObject instanceof Error ? errorObject.message : `Failed to ${action} movement.`)
      } finally {
        setActioningId(null)
      }
    },
    [onMutated, token]
  )

  const renderMovementField = (label: string, value: string, className?: string) => {
    if (!value || value === "-") {
      return null
    }
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("break-words text-foreground", className)}>{value}</p>
      </div>
    )
  }

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Movements section"
        className={cn(
          "scroll-mt-24 px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Movements</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {sortedItems.length}
            </span>
            {sortedItems.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {employeeId !== null ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>

        {mutationError ? <p className="mb-2 text-sm text-rose-600">{mutationError}</p> : null}

        {sortedItems.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No employee movements available.</p>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item, index) => {
              const movementId = readNumber(item.id)
              const movementNo = readString(item, ["movementNo", "movement_no"])
              const movementType = readString(item, ["movementType", "movement_type"])
              const status = readString(item, ["status"])
              const effectiveDate = formatProfileDate(readString(item, ["effectiveDate", "effective_date"]))
              const createdAt = formatDateTime(readString(item, ["createdAt", "created_at"]))
              const applicationError = readString(item, ["applicationError", "application_error"])
              const changes = asRecordArray(item.changes)

              return (
                <div key={`movements-${movementId ?? index}`} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {readString(item, ["title"])}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {movementNo !== "-" ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {movementNo}
                          </span>
                        ) : null}
                        {movementType !== "-" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            {formatLabelValue(movementType)}
                          </span>
                        ) : null}
                        {status !== "-" ? (
                          <span className={cn("font-medium", statusTone(status))}>
                            {formatLabelValue(status)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`View movement ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setViewingRecord(item)}
                      >
                        <EyeIcon className="size-4" />
                      </button>
                      {status !== "-" && movementSupportsSubmit(status) ? (
                        <button
                          type="button"
                          disabled={actioningId === movementId}
                          className="rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                          onClick={() => {
                            void triggerMovementAction(item, "submit")
                          }}
                        >
                          {actioningId === movementId ? "Submitting..." : "Submit"}
                        </button>
                      ) : null}
                      {status !== "-" && movementSupportsCancel(status) ? (
                        <button
                          type="button"
                          disabled={actioningId === movementId}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => {
                            void triggerMovementAction(item, "cancel")
                          }}
                        >
                          {actioningId === movementId ? "Working..." : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {renderMovementField("Effective Date", effectiveDate)}
                    {renderMovementField("Created", createdAt)}
                    {renderMovementField("Reason", readString(item, ["reason"]))}
                    {renderMovementField(
                      "Application Error",
                      applicationError,
                      "text-rose-600 dark:text-rose-400"
                    )}
                  </div>
                  {changes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {changes.map((change, changeIndex) => (
                        <span
                          key={`movement-change-${movementId ?? index}-${changeIndex}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {formatLabelValue(readString(change, ["field"]))}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open) {
            closeAddDialog()
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Add Employee Movement</AlertDialogTitle>
            <AlertDialogDescription>
              Create a movement draft for this employee, then submit it from the movements list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Movement Type
              </span>
              <FluentSelect
                ariaLabel="Movement Type"
                className="w-full"
                value={form.movement_type}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    movement_type: value,
                    new_branch_id: "",
                    new_department_id: "",
                    new_position_id: "",
                    new_grade_id: "",
                    new_cost_center_id: "",
                    new_manager_employee_id: "",
                    new_employment_type: "",
                  }))
                }
                disabled={optionsLoading}
                options={EMPLOYEE_MOVEMENT_TYPE_OPTIONS.map((option) => ({
                  value: option,
                  label: formatLabelValue(option),
                }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Effective Date
              </span>
              <DatePickerPresets
                value={form.effective_date}
                onChange={(value) => setForm((current) => ({ ...current, effective_date: value }))}
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
              </span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Movement title"
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </span>
              <Textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Why this movement is needed"
              />
            </label>

            {showBranchField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Branch
                </span>
                <FluentSelect
                  ariaLabel="Target Branch"
                  className="w-full"
                  value={form.new_branch_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      new_branch_id: value,
                      new_department_id: "",
                      new_position_id: "",
                      new_cost_center_id: "",
                      new_manager_employee_id: "",
                    }))
                  }
                  disabled={optionsLoading}
                  placeholder={optionsLoading ? "Loading branches..." : "Select branch"}
                  options={[
                    { value: "", label: optionsLoading ? "Loading branches..." : "Select branch" },
                    ...branchOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showDepartmentField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Department
                </span>
                <FluentSelect
                  ariaLabel="Target Department"
                  className="w-full"
                  value={form.new_department_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      new_department_id: value,
                      new_position_id: "",
                      new_cost_center_id: "",
                      new_manager_employee_id: "",
                    }))
                  }
                  disabled={optionsLoading}
                  placeholder={optionsLoading ? "Loading departments..." : "Select department"}
                  options={[
                    {
                      value: "",
                      label: optionsLoading ? "Loading departments..." : "Select department",
                    },
                    ...filteredDepartmentOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showPositionField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Position
                </span>
                <FluentSelect
                  ariaLabel="Target Position"
                  className="w-full"
                  value={form.new_position_id}
                  onChange={(value) => setForm((current) => ({ ...current, new_position_id: value }))}
                  disabled={optionsLoading || (Boolean(form.new_department_id) && scopedPositionOptionsLoading)}
                  placeholder={
                    optionsLoading || (form.new_department_id && scopedPositionOptionsLoading)
                      ? "Loading positions..."
                      : form.new_department_id && availablePositionOptions.length > 0
                        ? "Select department position"
                        : "Select position"
                  }
                  options={[
                    {
                      value: "",
                      label:
                        optionsLoading || (form.new_department_id && scopedPositionOptionsLoading)
                          ? "Loading positions..."
                          : form.new_department_id && availablePositionOptions.length > 0
                            ? "Select department position"
                            : "Select position",
                    },
                    ...availablePositionOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showManagerField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Manager
                </span>
                <FluentSelect
                  ariaLabel="Target Manager"
                  className="w-full"
                  value={form.new_manager_employee_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, new_manager_employee_id: value }))
                  }
                  disabled={optionsLoading || (Boolean(form.new_department_id) && scopedManagerOptionsLoading)}
                  placeholder={
                    optionsLoading || (form.new_department_id && scopedManagerOptionsLoading)
                      ? "Loading managers..."
                      : form.new_department_id && availableManagerOptions.length > 0
                        ? "Select department manager"
                        : "Select manager"
                  }
                  options={[
                    {
                      value: "",
                      label:
                        optionsLoading || (form.new_department_id && scopedManagerOptionsLoading)
                          ? "Loading managers..."
                          : form.new_department_id && availableManagerOptions.length > 0
                            ? "Select department manager"
                            : "Select manager",
                    },
                    ...availableManagerOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: employeeDisplayName(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showGradeField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Grade
                </span>
                <FluentSelect
                  ariaLabel="Target Grade"
                  className="w-full"
                  value={form.new_grade_id}
                  onChange={(value) => setForm((current) => ({ ...current, new_grade_id: value }))}
                  disabled={optionsLoading}
                  placeholder={optionsLoading ? "Loading grades..." : "Select grade"}
                  options={[
                    { value: "", label: optionsLoading ? "Loading grades..." : "Select grade" },
                    ...gradeOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showCostCenterField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Cost Center
                </span>
                <FluentSelect
                  ariaLabel="Target Cost Center"
                  className="w-full"
                  value={form.new_cost_center_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, new_cost_center_id: value }))
                  }
                  disabled={optionsLoading}
                  placeholder={
                    optionsLoading
                      ? "Loading cost centers..."
                      : form.new_department_id && filteredCostCenterOptions.length > 0
                        ? "Select department cost center"
                        : "Select cost center"
                  }
                  options={[
                    {
                      value: "",
                      label: optionsLoading
                        ? "Loading cost centers..."
                        : form.new_department_id && filteredCostCenterOptions.length > 0
                          ? "Select department cost center"
                          : "Select cost center",
                    },
                    ...(form.new_department_id ? filteredCostCenterOptions : costCenterOptions).flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showEmploymentTypeField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Employment Type
                </span>
                <FluentSelect
                  ariaLabel="Target Employment Type"
                  className="w-full"
                  value={form.new_employment_type}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, new_employment_type: value }))
                  }
                  placeholder="Select employment type"
                  options={[
                    { value: "", label: "Select employment type" },
                    ...EMPLOYMENT_TYPE_OPTIONS.map((option) => ({
                      value: option,
                      label: formatLabelValue(option),
                    })),
                  ]}
                />
              </label>
            ) : null}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || optionsLoading}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => {
                void submitCreate()
              }}
            >
              {submitting ? "Adding..." : "Add Draft"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(viewingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRecord(null)
            setMovementOperations([])
            setDetailError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Movement Details</AlertDialogTitle>
            <AlertDialogDescription>
              Review movement changes, lifecycle status, and downstream operations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {viewingRecord ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {renderMovementField("Movement No", readString(viewingRecord, ["movementNo", "movement_no"]))}
                {renderMovementField("Type", formatLabelValue(readString(viewingRecord, ["movementType", "movement_type"])))}
                {renderMovementField("Status", formatLabelValue(readString(viewingRecord, ["status"])), statusTone(readString(viewingRecord, ["status"])))}
                {renderMovementField("Effective Date", formatProfileDate(readString(viewingRecord, ["effectiveDate", "effective_date"])))}
                {renderMovementField("Created", formatDateTime(readString(viewingRecord, ["createdAt", "created_at"])))}
                {renderMovementField("Updated", formatDateTime(readString(viewingRecord, ["updatedAt", "updated_at"])))}
                {renderMovementField("Submitted", formatDateTime(readString(viewingRecord, ["submittedAt", "submitted_at"])))}
                {renderMovementField("Approved", formatDateTime(readString(viewingRecord, ["approvedAt", "approved_at"])))}
              </div>

              <div className="grid gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Title
                </p>
                <p className="text-sm text-foreground">{readString(viewingRecord, ["title"])}</p>
              </div>

              <div className="grid gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Reason
                </p>
                <p className="text-sm text-foreground">{readString(viewingRecord, ["reason"])}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Changes
                </p>
                {asRecordArray(viewingRecord.changes).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No change breakdown was returned for this movement.</p>
                ) : (
                  <div className="space-y-2">
                    {asRecordArray(viewingRecord.changes).map((change, index) => (
                      <div key={`movement-detail-change-${index}`} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-foreground">
                          {formatLabelValue(readString(change, ["field"]))}
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {renderMovementField("From", movementChangeValueSummary(change.oldValue))}
                          {renderMovementField("To", movementChangeValueSummary(change.newValue))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Operations
                </p>
                {operationsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading movement operations...</p>
                ) : detailError ? (
                  <p className="text-sm text-rose-600">{detailError}</p>
                ) : movementOperations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No downstream operations were returned.</p>
                ) : (
                  <div className="space-y-2">
                    {movementOperations.map((operation, index) => (
                      <div key={`movement-operation-${readNumber(operation.id) ?? index}`} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {formatLabelValue(readString(operation, ["operationType", "operation_type"]))}
                          </span>
                          <span className={cn("text-xs font-medium", statusTone(readString(operation, ["status"])))}>{formatLabelValue(readString(operation, ["status"]))}</span>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {renderMovementField("Resource Key", readString(operation, ["resourceKey", "resource_key"]))}
                          {renderMovementField("Updated", formatDateTime(readString(operation, ["updatedAt", "updated_at"])))}
                          {renderMovementField("Error", readString(operation, ["errorMessage", "error_message"]), "text-rose-600 dark:text-rose-400")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function EmployeeProfilePage({
  employeeNo,
  requestedMissingItem,
}: {
  employeeNo: string
  requestedMissingItem?: string | null
}) {
  const router = useRouter()
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [identityDialogOpen, setIdentityDialogOpen] = React.useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false)
  const [profileSearchOpen, setProfileSearchOpen] = React.useState(false)
  const [profileSearch, setProfileSearch] = React.useState("")
  const [profileSearchResults, setProfileSearchResults] = React.useState<AdminRecord[]>([])
  const [profileSearchLoading, setProfileSearchLoading] = React.useState(false)
  const [profileSearchError, setProfileSearchError] = React.useState<string | null>(null)
  const currentEmployeeStatus = employee
    ? normalizeEmployeeStatus(employee.employment_status ?? employee.status)
    : "active"
  const requestedSectionTitle = React.useMemo(
    () => routeKeyToSectionTitle(requestedMissingItem),
    [requestedMissingItem]
  )
  const requestedRouteKey = React.useMemo(
    () => (requestedSectionTitle ? sectionTitleToRouteKey(requestedSectionTitle) : null),
    [requestedSectionTitle]
  )
  const fetchEmployee = React.useCallback(async () => {
      const token = readStoredToken()
      if (!token) {
        setError("Authentication required. Please log in again.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const decodedNo = decodeURIComponent(employeeNo)
        const result = await listEmployees(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: decodedNo,
        })

        const matched = result.rows.find(
          (row) =>
            readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"]) === decodedNo
        )
        if (!matched) {
          setError("Employee not found.")
          setEmployee(null)
        } else {
          const employeeId = readNumber(matched.id)
          if (employeeId === null) {
            setEmployee(mergeEmployeeProfileRecord(matched))
          } else {
            const [detailedEmployee, assignmentResult, movementResult] = await Promise.all([
              getEmployeeById(employeeId, token).catch(() => null),
              listEmployeePositions(token, {
                employee_id: employeeId,
                page: 1,
                limit: 100,
              }).catch(() => null),
              listEmployeeMovements(token).catch(() => null),
            ])
            const mergedEmployee = mergeEmployeeProfileRecord(detailedEmployee ?? matched)
            const movementRows =
              movementResult?.filter((row) => movementBelongsToEmployee(row, employeeId)) ??
              firstRecordArray(mergedEmployee?.employee_movements, mergedEmployee?.employeeMovements)
            setEmployee(
              mergedEmployee
                ? {
                    ...mergedEmployee,
                    position_assignments: assignmentResult?.rows ?? firstRecordArray(mergedEmployee.position_assignments),
                    employee_movements: movementRows,
                    employeeMovements: movementRows,
                  }
                : mergedEmployee
            )
          }
        }
      } catch (errorObject) {
        setError(errorObject instanceof Error ? errorObject.message : "Failed to load employee profile.")
      } finally {
        setLoading(false)
      }
    }, [employeeNo])

  React.useEffect(() => {
    void fetchEmployee()
  }, [fetchEmployee])

  React.useEffect(() => {
    if (!profileSearchOpen) {
      setProfileSearch("")
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      setProfileSearchError(null)
      return
    }

    const trimmedSearch = profileSearch.trim()
    if (trimmedSearch.length < 2) {
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      setProfileSearchError(null)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setProfileSearchError("Authentication required. Please log in again.")
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      return
    }

    let cancelled = false
    setProfileSearchLoading(true)
    setProfileSearchError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await listEmployees(token, {
          page: 1,
          limit: 8,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: trimmedSearch,
        })
        if (cancelled) {
          return
        }
        let rows = result.rows
        const looksLikeEmailOrPhone =
          trimmedSearch.includes("@") || trimmedSearch.replace(/\D+/g, "").length >= 6
        if (rows.length === 0 && looksLikeEmailOrPhone) {
          const directoryRows = await listAllEmployees(token, {}, { pageSize: 100, maxPages: 20 })
          if (cancelled) {
            return
          }
          rows = filterEmployeesByDirectorySearch(directoryRows, trimmedSearch)
        }
        setProfileSearchResults(rows.slice(0, 8))
      } catch (errorObject) {
        if (cancelled) {
          return
        }
        setProfileSearchResults([])
        setProfileSearchError(errorObject instanceof Error ? errorObject.message : "Failed to search employees.")
      } finally {
        if (!cancelled) {
          setProfileSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [profileSearch, profileSearchOpen])

  function openEmployeeProfile(row: AdminRecord) {
    const nextEmployeeNo = readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"])
    if (nextEmployeeNo === "-") {
      return
    }
    setProfileSearchOpen(false)
    router.push(`/dashboard/employees/profile/${encodeURIComponent(nextEmployeeNo)}`)
  }

  if (loading) {
    return (
      <div className={cn("animate-pulse border border-border bg-background", pageBleedClass)} aria-busy="true" aria-label="Loading employee profile">
        <div className="h-12 border-b border-border" />
        <div className="flex items-center gap-4 px-5 py-5">
          <div className="size-16 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-56 rounded bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-3 w-72 rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-10 rounded bg-muted" />)}
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-sm text-rose-600">{error ?? "Employee not found."}</p>
        <button
          type="button"
          className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
          onClick={() => router.push("/dashboard/employees/all")}
        >
          Back to All Employees
        </button>
      </div>
    )
  }

  return (
    <div className={cn("pb-4", pageBleedClass)}>
      <EmployeeProfileHero
        employee={employee}
        onUpdateProfile={() => setIdentityDialogOpen(true)}
        onUpdateStatus={() => setStatusDialogOpen(true)}
        searchSlot={
            <Popover open={profileSearchOpen} onOpenChange={setProfileSearchOpen}>
              <PopoverTrigger
                type="button"
                aria-label="Search employee profiles"
                title="Search employee profiles"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                <SearchIcon className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[340px] p-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Find Another Employee</p>
                    <p className="text-xs text-muted-foreground">Search by name, employee number, email, or phone.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                    <SearchIcon className="size-4 shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Search employee profile"
                      className="h-10 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {profileSearchError ? <p className="text-xs text-rose-600">{profileSearchError}</p> : null}
                  {profileSearchLoading ? <p className="text-xs text-muted-foreground">Searching employees...</p> : null}
                  {!profileSearchLoading && !profileSearchError && profileSearch.trim().length > 0 && profileSearch.trim().length < 2 ? (
                    <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
                  ) : null}
                  {!profileSearchLoading && !profileSearchError && profileSearch.trim().length >= 2 && profileSearchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No employees matched your search.</p>
                  ) : null}
                  {profileSearchResults.length > 0 ? (
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {profileSearchResults.map((row, index) => {
                        const nextEmployeeNo = readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"])
                        return (
                          <button
                            key={`${nextEmployeeNo}-${index}`}
                            type="button"
                            className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => openEmployeeProfile(row)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">{employeeDisplayNameFromLinkedUser(row)}</span>
                              <span className="block truncate text-xs text-muted-foreground">{readString(row, ["email", "work_email", "personal_email"])}</span>
                            </span>
                            <span className="shrink-0 pl-3 text-xs text-muted-foreground">{nextEmployeeNo}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
        }
      />

      {(() => {
          return (
            <ProfileSectionsTabs
              employee={employee}
              employeeId={readNumber(employee.id)}
              onMutated={fetchEmployee}
              requestedRouteKey={requestedRouteKey}
              header={
                <>
                <EmployeeCoverCard token={readStoredToken()} employeeId={readNumber(employee.id)} />
                <EmployeeLeaveBalanceCard
                  token={readStoredToken()}
                  employeeId={readNumber(employee.id)}
                  employeeName={employeeDisplayNameFromLinkedUser(employee)}
                />
                </>
              }
            />
          )
        })()}

      <EmployeeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        token={readStoredToken()}
        employeeId={readNumber(employee.id) ?? 0}
        employeeName={employeeDisplayNameFromLinkedUser(employee)}
        currentStatus={currentEmployeeStatus}
        currentNotes={readString(employee, ["notes"]) === "-" ? "" : readString(employee, ["notes"])}
        onSaved={async () => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(EMPLOYEE_STATUS_REFRESH_KEY, String(Date.now()))
            window.dispatchEvent(new CustomEvent(EMPLOYEE_STATUS_REFRESH_EVENT))
          }
          await fetchEmployee()
        }}
      />

      <EmployeeIdentitySheet
        open={identityDialogOpen}
        onOpenChange={setIdentityDialogOpen}
        employee={employee}
        onSaved={fetchEmployee}
      />
    </div>
  )
}
