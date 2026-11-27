"use client"
import { EmployeeLeaveBalanceCard } from "@/components/leave/leave-accrual-summary"
import { EmployeeCoverCard } from "@/components/leave/employee-cover-card"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  RefreshCwIcon,
  TriangleAlertIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import {
  Briefcase20Regular,
  CalendarLtr20Regular,
  CheckmarkCircle16Regular,
  ChevronRight16Regular,
  DocumentText20Regular,
  Grid20Regular,
  HatGraduation20Regular,
  LockClosed20Regular,
  Person20Regular,
  SearchSparkle20Regular as SearchIcon,
  Warning16Regular,
} from "@fluentui/react-icons"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmployeeMovement,
  createEmployeePosition,
  cancelEmployeeMovement,
  deleteEmployeePosition,
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
  listPositions,
  patchEmployeeAssignment,
  patchEmployeePosition,
  submitEmployeeMovement,
  type AdminRecord,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
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
import { PAGE_SHELL_WIDTH, PageShell } from "@/components/dashboard/page-shell"
import { ProfileSidePanel } from "@/components/dashboard/employee-profile/profile-side-panel"
import { EmployeeLettersSection } from "@/components/dashboard/letters/employee-letters-section"
import {
  ProfileAddButton,
  ProfileRecordCollection,
  ProfileRecordEmpty,
  ProfileSectionHeader,
  RecordActionButton,
  RecordFieldGrid,
  SectionGlyph,
  RecordBadges,
  RecordTag,
  useProfileRecordView,
} from "@/components/dashboard/employee-profile/profile-record-views"
import { EmployeeIdentitySheet } from "@/components/dashboard/employee-profile/employee-identity-sheet"
import { EmployeeProfileHero } from "@/components/dashboard/employee-profile/employee-profile-hero"
import { FormField } from "@/components/ui/form-field"

const PROFILE_SECTION_DEFS: Array<{
  title: string
  /** Compact tab label (matches Employees top-tab density). Full title used in content. */
  tabLabel: string
  keys: string[]
  special?: "company_user"
  hideCount?: boolean
}> = [
  { title: "Contacts", tabLabel: "Contacts", keys: ["contacts", "contact_details", "contactDetails"] },
  { title: "Documents", tabLabel: "Documents", keys: ["documents", "employee_documents", "employeeDocuments"] },
  { title: "Letters", tabLabel: "Letters", keys: [] },
  { title: "Contracts", tabLabel: "Contracts", keys: [] },
  { title: "Leave", tabLabel: "Leave", keys: [], hideCount: true },
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

type ProfileGroupKey = "overview" | "personal" | "employment" | "leave" | "documents" | "skills" | "account"

const PROFILE_GROUPS: Array<{
  key: Exclude<ProfileGroupKey, "overview">
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  sections: string[]
}> = [
  {
    key: "personal",
    label: "Personal",
    description: "Contacts, addresses, family and bank details",
    icon: Person20Regular,
    sections: ["Contacts", "Addresses", "Relatives", "Identifications", "Bank Accounts"],
  },
  {
    key: "employment",
    label: "Employment",
    description: "Placement, contracts and career history",
    icon: Briefcase20Regular,
    sections: ["Departments", "Positions", "Contracts", "Movements", "Status History"],
  },
  {
    key: "leave",
    label: "Leave",
    description: "Balances and cover arrangements",
    icon: CalendarLtr20Regular,
    sections: ["Leave"],
  },
  {
    key: "documents",
    label: "Documents",
    description: "Uploaded files and generated letters",
    icon: DocumentText20Regular,
    sections: ["Documents", "Letters"],
  },
  {
    key: "skills",
    label: "Skills",
    description: "Education, certifications and experience",
    icon: HatGraduation20Regular,
    sections: ["Academic Qualifications", "Professional Qualifications", "Experience Details"],
  },
  {
    key: "account",
    label: "Account",
    description: "System login linked to this employee",
    icon: LockClosed20Regular,
    sections: ["Company User"],
  },
]

/** Sections an HR file is expected to have at least one record in. */
const EXPECTED_PROFILE_SECTIONS = new Set([
  "Contacts",
  "Addresses",
  "Relatives",
  "Identifications",
  "Bank Accounts",
  "Departments",
  "Positions",
  "Documents",
  "Company User",
])

function groupForSection(title: string | null | undefined): ProfileGroupKey | null {
  if (!title) return null
  return PROFILE_GROUPS.find((group) => group.sections.includes(title))?.key ?? null
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
          hideCount: Boolean(def.hideCount) || (def.keys.length === 0 && !def.special),
        }
      }),
    [employee]
  )
  const sectionByTitle = React.useMemo(
    () => new Map(sections.map((section) => [section.title, section])),
    [sections]
  )

  const actor = useDashboardActor()
  const canManageContracts = canPerformPermission(actor.permissionLabels, "employment_contracts:manage")
  const fullName = `${String(employee.first_name ?? "")} ${String(employee.last_name ?? "")}`.trim()

  const requestedTitle = routeKeyToSectionTitle(requestedRouteKey)
  const [activeGroup, setActiveGroup] = React.useState<ProfileGroupKey>(
    () => groupForSection(requestedTitle) ?? "overview"
  )
  const [activeTitles, setActiveTitles] = React.useState<Partial<Record<ProfileGroupKey, string>>>(() => {
    const group = groupForSection(requestedTitle)
    return group && requestedTitle ? { [group]: requestedTitle } : {}
  })

  React.useEffect(() => {
    const group = groupForSection(requestedTitle)
    if (group && requestedTitle) {
      setActiveGroup(group)
      setActiveTitles((current) => ({ ...current, [group]: requestedTitle }))
    }
  }, [requestedTitle])

  const motionPreset = useDashboardMotion()
  const groupOrder: ProfileGroupKey[] = ["overview", ...PROFILE_GROUPS.map((group) => group.key)]
  const [slideDirection, setSlideDirection] = React.useState(1)

  const selectGroup = React.useCallback(
    (key: ProfileGroupKey, sectionTitle?: string) => {
      setSlideDirection(groupOrder.indexOf(key) >= groupOrder.indexOf(activeGroup) ? 1 : -1)
      setActiveGroup(key)
      if (sectionTitle) setActiveTitles((current) => ({ ...current, [key]: sectionTitle }))
    },
    // groupOrder is derived from a constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeGroup]
  )

  const groupSummaries = React.useMemo(
    () =>
      PROFILE_GROUPS.map((group) => {
        const groupSections = group.sections
          .map((title) => sectionByTitle.get(title))
          .filter((section): section is NonNullable<typeof section> => Boolean(section))
        const missing = groupSections.filter(
          (section) => EXPECTED_PROFILE_SECTIONS.has(section.title) && section.count === 0
        )
        const records = groupSections.reduce((total, section) => total + (section.hideCount ? 0 : section.count), 0)
        return { group, sections: groupSections, missing, records }
      }),
    [sectionByTitle]
  )
  const totalExpected = groupSummaries.reduce(
    (total, summary) => total + summary.sections.filter((section) => EXPECTED_PROFILE_SECTIONS.has(section.title)).length,
    0
  )
  const totalMissing = groupSummaries.reduce((total, summary) => total + summary.missing.length, 0)
  const completeness = totalExpected ? Math.round(((totalExpected - totalMissing) / totalExpected) * 100) : 100

  const currentGroup = PROFILE_GROUPS.find((group) => group.key === activeGroup) ?? null
  const currentSections = currentGroup
    ? currentGroup.sections
        .map((title) => sectionByTitle.get(title))
        .filter((section): section is NonNullable<typeof section> => Boolean(section))
    : []
  const active = currentGroup
    ? currentSections.find((section) => section.title === activeTitles[activeGroup]) ?? currentSections[0]
    : null

  const renderSection = (section: NonNullable<typeof active>) => {
    switch (section.title) {
      case "Departments":
        return (
          <DepartmentAssignmentsSection
            items={section.items}
            employee={employee}
            employeeId={employeeId}
            onMutated={onMutated}
            requestedRouteKey={requestedRouteKey}
          />
        )
      case "Positions":
        return (
          <PositionAssignmentsSection
            items={section.items}
            employeeId={employeeId}
            onMutated={onMutated}
            requestedRouteKey={requestedRouteKey}
          />
        )
      case "Movements":
        return (
          <EmployeeMovementsSection
            items={section.items}
            employeeId={employeeId}
            onMutated={onMutated}
            requestedRouteKey={requestedRouteKey}
          />
        )
      case "Status History":
        return <EmployeeStatusHistorySection employeeId={employeeId} token={readStoredToken()} />
      case "Contracts":
        return <EmploymentContractsView employee={{ id: employeeId, full_name: fullName }} canManage={canManageContracts} />
      case "Leave":
        return (
          <div className="flex flex-col gap-6">
            <EmployeeLeaveBalanceCard
              token={readStoredToken()}
              employeeId={employeeId}
              employeeName={employeeDisplayNameFromLinkedUser(employee)}
            />
            <EmployeeCoverCard token={readStoredToken()} employeeId={employeeId} />
          </div>
        )
      case "Letters":
        return (
          <EmployeeLettersSection
            employeeId={employeeId}
            employeeName={fullName}
            employeeNo={employee.employee_no ? String(employee.employee_no) : null}
          />
        )
      default:
        return (
          <Section
            title={section.title}
            items={section.items}
            employeeId={employeeId}
            onMutated={onMutated}
            requestedRouteKey={requestedRouteKey}
            expected={EXPECTED_PROFILE_SECTIONS.has(section.title)}
          />
        )
    }
  }

  const overview = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Profile completeness</p>
          <p className="text-xs text-muted-foreground">
            {totalMissing === 0
              ? "Every expected record is on file."
              : `${totalMissing} expected record type${totalMissing === 1 ? " is" : "s are"} still empty.`}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
            <div
              className={cn("h-full rounded-full", completeness === 100 ? "bg-emerald-500" : completeness >= 70 ? "bg-primary" : "bg-amber-500")}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">{completeness}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groupSummaries.map(({ group, missing, records, sections: groupSections }) => {
          const Icon = group.icon
          const hasMissing = missing.length > 0
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => selectGroup(group.key, missing[0]?.title)}
              className={cn(
                "group flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-primary",
                hasMissing ? "border-amber-300 dark:border-amber-800/70" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-md",
                      hasMissing ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <ChevronRight16Regular className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groupSections.map((section) => {
                  const isMissing = missing.includes(section)
                  return (
                    <span
                      key={section.routeKey}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                        isMissing
                          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                          : "border-border bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {section.tabLabel}
                      {section.hideCount ? null : <span className="font-semibold tabular-nums">{section.count}</span>}
                    </span>
                  )
                })}
              </div>
              <p className={cn("flex items-center gap-1 text-xs", hasMissing ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                {hasMissing ? <Warning16Regular className="size-3.5" /> : <CheckmarkCircle16Regular className="size-3.5 text-emerald-600" />}
                {hasMissing
                  ? `Missing ${missing.map((section) => section.tabLabel.toLowerCase()).join(", ")}`
                  : records > 0
                    ? `${records} record${records === 1 ? "" : "s"} on file`
                    : "Open section"}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-w-0">
      {header}
      <div className="sticky top-12 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="px-4 py-3 sm:hidden">
          <FluentSelect
            id="employee-profile-group"
            ariaLabel="Profile section"
            className="w-full"
            value={activeGroup}
            onChange={(value) => selectGroup(value as ProfileGroupKey)}
            options={[
              { value: "overview", label: "Overview" },
              ...groupSummaries.map(({ group, missing }) => ({
                value: group.key,
                label: `${group.label}${missing.length ? ` (${missing.length} missing)` : ""}`,
              })),
            ]}
          />
        </div>
        <div
          className="hidden items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:flex sm:px-6"
          role="tablist"
          aria-label="Employee profile sections"
        >
          {[{ key: "overview" as const, label: "Overview", missing: 0, icon: Grid20Regular as React.ComponentType<{ className?: string }> }, ...groupSummaries.map(({ group, missing }) => ({ key: group.key, label: group.label, missing: missing.length, icon: group.icon }))].map((tab) => {
            const isActive = tab.key === activeGroup
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectGroup(tab.key)}
                className={cn(
                  "-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <tab.icon className="size-4" aria-hidden="true" />
                {tab.label}
                {tab.missing ? (
                  <span className="size-1.5 rounded-full bg-amber-500" aria-label={`${tab.missing} missing`} />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {currentSections.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-3 [scrollbar-width:none] sm:px-6" role="tablist" aria-label={`${currentGroup?.label} records`}>
          {currentSections.map((section) => {
            const isActive = section.title === active?.title
            const isMissing = EXPECTED_PROFILE_SECTIONS.has(section.title) && section.count === 0
            return (
              <button
                key={section.routeKey}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTitles((current) => ({ ...current, [activeGroup]: section.title }))}
                title={isMissing ? "Needs attention: no records yet" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isMissing
                      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {isMissing ? (
                  <Warning16Regular
                    className={cn("size-3.5 shrink-0", isActive ? "text-primary-foreground" : "text-amber-600 dark:text-amber-300")}
                    aria-hidden="true"
                  />
                ) : null}
                {section.title}
                {isMissing ? <span className="sr-only"> (needs attention)</span> : null}
                {section.hideCount ? null : (
                  <span className={cn("tabular-nums", isActive ? "text-primary-foreground/80" : "opacity-80")}>{section.count}</span>
                )}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="relative overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <AnimatePresence mode="wait" custom={slideDirection} initial={false}>
          <motion.div
            key={active ? `${activeGroup}:${active.routeKey}` : activeGroup}
            custom={slideDirection}
            initial={motionPreset.reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: slideDirection * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={motionPreset.reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: slideDirection * -32 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeGroup === "overview" || !active ? overview : renderSection(active)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
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
  const [recordView, setRecordView] = useProfileRecordView()
  const assignmentActor = useDashboardActor()
  // Assignment changes need employees:update on the server.
  const canManage = assignmentActor.ready && canPerformPermission(assignmentActor.permissionLabels, "employees:update")
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
        <ProfileSectionHeader
          title="Departments"
          count={items.length}
          view={recordView}
          onViewChange={setRecordView}
          highlighted={isHighlighted || items.length === 0}
          actions={canManage && employeeId ? <ProfileAddButton onClick={() => setAddingRecord(true)} /> : null}
        />

        {items.length === 0 ? (
          <ProfileRecordEmpty
            title="Departments"
            message={canManage && employeeId ? "Assign this employee to a department." : undefined}
            actionLabel={canManage && employeeId ? "Add department" : undefined}
            onAction={canManage && employeeId ? () => setAddingRecord(true) : undefined}
          />
        ) : (
          <ProfileRecordCollection
            title="Departments"
            view={recordView}
            records={items.map((item, index) => {
              const branchName = readNestedString(item.department, ["branch_name", "branchName"])
              const assignedAt = formatDateTime(item.created_at)
              return {
                key: `departments-${index}`,
                heading: departmentAssignmentPreview(item),
                badges: <RecordBadges isPrimary={isPrimaryDepartmentAssignment(item)} inline />,
                fields: [
                  { label: "Branch", value: branchName },
                  { label: "Assigned at", value: assignedAt },
                ].filter((entry) => entry.value && entry.value !== "-"),
                actions: canManage && (
                  <div className="flex flex-wrap items-center justify-end gap-0.5">
                    <RecordActionButton
                      label="Edit"
                      ariaLabel={`Edit department assignment ${index + 1}`}
                      icon={<PencilIcon className="size-4" />}
                      onClick={() => setEditingRecord(item)}
                    />
                    <RecordActionButton
                      label="Delete"
                      ariaLabel={`Delete department assignment ${index + 1}`}
                      icon={<Trash2Icon className="size-4" />}
                      tone="danger"
                      iconOnly
                      onClick={() => setDeletingRecord(item)}
                    />
                  </div>
                ),
              }
            })}
          />
        )}
      </div>

      <ProfileSidePanel
        open={addingRecord || Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
        title={<>{editingRecord ? "Edit Department Assignment" : "Add Department Assignment"}</>}
        description={<>{editingRecord
                ? "Update the selected employee department assignment."
                : "Create a new department assignment for this employee."}</>}
        footer={<>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => {
                closeDialogs()
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitMutation()}
            >
              {submitting ? "Saving..." : editingRecord ? "Save" : "Add"}
            </button>
          </>}
      >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Department" className="sm:col-span-2">
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
            </FormField>

            <FormField label="Primary assignment">
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
            </FormField>

            <FormField label="Effective date">
              <DatePickerPresets
                value={form.effective_date}
                onChange={(value) =>
                  setForm((current) => ({ ...current, effective_date: value }))
                }
              />
            </FormField>

            <FormField label="Reason" className="sm:col-span-2">
              <Textarea
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reason: event.target.value }))
                }
                className="min-h-24 w-full"
              />
            </FormField>
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
      </ProfileSidePanel>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="!w-[min(30rem,calc(100vw-2rem))]">
          <AlertDialogHeader className="flex-row items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              <TriangleAlertIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
            <AlertDialogTitle>Delete Department Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this employee department assignment and keep the remaining assignment history aligned.
            </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          {mutationError ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="!h-9 !min-w-0 !rounded-md !px-3 !text-sm !font-medium">Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-md bg-rose-600 px-3 text-sm font-medium !text-white hover:bg-rose-700 disabled:opacity-50"
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
  const [recordView, setRecordView] = useProfileRecordView()
  const assignmentActor = useDashboardActor()
  // Assignment changes need employees:update on the server.
  const canManage = assignmentActor.ready && canPerformPermission(assignmentActor.permissionLabels, "employees:update")
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
        <ProfileSectionHeader
          title="Positions"
          count={items.length}
          view={recordView}
          onViewChange={setRecordView}
          highlighted={isHighlighted || items.length === 0}
          actions={canManage && employeeId ? <ProfileAddButton onClick={() => setAddingRecord(true)} /> : null}
        />

        {items.length === 0 ? (
          <ProfileRecordEmpty
            title="Positions"
            message={canManage && employeeId ? "Assign this employee to a position." : undefined}
            actionLabel={canManage && employeeId ? "Add position" : undefined}
            onAction={canManage && employeeId ? () => setAddingRecord(true) : undefined}
          />
        ) : (
          <ProfileRecordCollection
            title="Positions"
            view={recordView}
            records={items.map((item, index) => {
              const status = readString(item, ["status"])
              const assignmentType = readString(item, ["assignment_type", "assignmentType"])
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
              const normalizedStatus = status.trim().toLowerCase()
              return {
                key: `positions-${index}`,
                heading: positionAssignmentPreview(item),
                badges: (
                  <RecordBadges
                    isPrimary={isPrimaryEmployeePosition(item) && assignmentType.trim().toLowerCase() !== "primary"}
                    inline
                  >
                    {assignmentType !== "-" ? (
                      <RecordTag tone={assignmentType.trim().toLowerCase() === "primary" ? "primary" : "neutral"}>
                        {formatLabelValue(assignmentType)}
                      </RecordTag>
                    ) : null}
                    {status !== "-" ? (
                      <RecordTag
                        tone={
                          normalizedStatus === "active"
                            ? "success"
                            : normalizedStatus === "ended" || normalizedStatus === "inactive"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {formatLabelValue(status)}
                      </RecordTag>
                    ) : null}
                  </RecordBadges>
                ),
                fields: [
                  { label: "Department", value: departmentName },
                  { label: "Start date", value: startDate },
                  { label: "End date", value: endDate },
                  { label: "Notes", value: notes },
                ].filter((entry) => entry.value && entry.value !== "-"),
                actions: canManage && (
                  <div className="flex flex-wrap items-center justify-end gap-0.5">
                    <RecordActionButton
                      label="Edit"
                      ariaLabel={`Edit position assignment ${index + 1}`}
                      icon={<PencilIcon className="size-4" />}
                      onClick={() => setEditingRecord(item)}
                    />
                    <RecordActionButton
                      label="Delete"
                      ariaLabel={`Delete position assignment ${index + 1}`}
                      icon={<Trash2Icon className="size-4" />}
                      tone="danger"
                      iconOnly
                      onClick={() => setDeletingRecord(item)}
                    />
                  </div>
                ),
              }
            })}
          />
        )}
      </div>

      <ProfileSidePanel
        open={addingRecord || Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
        title={<>{editingRecord ? "Edit Position Assignment" : "Add Position Assignment"}</>}
        description={<>{editingRecord
                ? "Update the selected employee position assignment."
                : "Create a new position assignment for this employee."}</>}
        footer={<>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => {
                closeDialogs()
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitMutation()}
            >
              {submitting ? "Saving..." : editingRecord ? "Save" : "Add"}
            </button>
          </>}
      >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Position" className="sm:col-span-2">
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
            </FormField>

            <FormField label="Assignment type">
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
            </FormField>

            <FormField label="Status">
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
            </FormField>

            <FormField label="Start date">
              <DatePickerPresets
                value={form.start_date}
                onChange={(value) => setForm((current) => ({ ...current, start_date: value }))}
              />
            </FormField>

            <FormField label="End date">
              <DatePickerPresets
                value={form.end_date}
                onChange={(value) => setForm((current) => ({ ...current, end_date: value }))}
              />
            </FormField>

            <FormField label="Primary assignment">
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
            </FormField>

            <FormField label="Notes" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-24 w-full"
              />
            </FormField>
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
      </ProfileSidePanel>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="!w-[min(30rem,calc(100vw-2rem))]">
          <AlertDialogHeader className="flex-row items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              <TriangleAlertIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
            <AlertDialogTitle>Delete Position Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this employee position assignment. This action cannot be undone.
            </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          {mutationError ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="!h-9 !min-w-0 !rounded-md !px-3 !text-sm !font-medium">Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-md bg-rose-600 px-3 text-sm font-medium !text-white hover:bg-rose-700 disabled:opacity-50"
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
  const [recordView, setRecordView] = useProfileRecordView()
  const movementActor = useDashboardActor()
  // Adding a movement needs employee_movements:create on the server.
  const canCreateMovement =
    movementActor.ready && canPerformPermission(movementActor.permissionLabels, "employee_movements:create")
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
        <ProfileSectionHeader
          title="Movements"
          count={sortedItems.length}
          view={recordView}
          onViewChange={setRecordView}
          highlighted={isHighlighted}
          actions={canCreateMovement && employeeId !== null ? <ProfileAddButton onClick={() => setAddingRecord(true)} /> : null}
        />

        {mutationError ? (
          <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {mutationError}
          </p>
        ) : null}

        {sortedItems.length === 0 ? (
          <ProfileRecordEmpty
            title="Movements"
            message={canCreateMovement && employeeId !== null ? "Transfers, promotions and other changes will appear here." : undefined}
            actionLabel={canCreateMovement && employeeId !== null ? "Add movement" : undefined}
            onAction={canCreateMovement && employeeId !== null ? () => setAddingRecord(true) : undefined}
          />
        ) : (
          <ProfileRecordCollection
            title="Movements"
            view={recordView}
            records={sortedItems.map((item, index) => {
              const movementId = readNumber(item.id)
              const movementNo = readString(item, ["movementNo", "movement_no"])
              const movementType = readString(item, ["movementType", "movement_type"])
              const status = readString(item, ["status"])
              const normalizedStatus = status.trim().toLowerCase()
              const effectiveDate = formatProfileDate(readString(item, ["effectiveDate", "effective_date"]))
              const createdAt = formatDateTime(readString(item, ["createdAt", "created_at"]))
              const applicationError = readString(item, ["applicationError", "application_error"])
              const changes = asRecordArray(item.changes)
              return {
                key: `movements-${movementId ?? index}`,
                heading: readString(item, ["title"]),
                badges: (
                  <RecordBadges inline>
                    {movementNo !== "-" ? <RecordTag>{movementNo}</RecordTag> : null}
                    {movementType !== "-" ? <RecordTag tone="primary">{formatLabelValue(movementType)}</RecordTag> : null}
                    {status !== "-" ? (
                      <RecordTag
                        tone={
                          ["applied", "approved", "completed"].includes(normalizedStatus)
                            ? "success"
                            : ["rejected", "failed", "cancelled"].includes(normalizedStatus)
                              ? "danger"
                              : "warning"
                        }
                      >
                        {formatLabelValue(status)}
                      </RecordTag>
                    ) : null}
                  </RecordBadges>
                ),
                fields: [
                  { label: "Effective date", value: effectiveDate },
                  { label: "Reason", value: readString(item, ["reason"]) },
                  { label: "Application error", value: applicationError },
                ].filter((entry) => entry.value && entry.value !== "-"),
                meta: createdAt && createdAt !== "-" ? `Created ${createdAt}` : null,
                extra:
                  changes.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {changes.map((change, changeIndex) => (
                        <RecordTag key={`movement-change-${movementId ?? index}-${changeIndex}`}>
                          {formatLabelValue(readString(change, ["field"]))}
                        </RecordTag>
                      ))}
                    </div>
                  ) : null,
                actions: (
                  <div className="flex flex-wrap items-center justify-end gap-0.5">
                    <RecordActionButton
                      label="View"
                      ariaLabel={`View movement ${index + 1}`}
                      icon={<EyeIcon className="size-4" />}
                      onClick={() => setViewingRecord(item)}
                    />
                    {status !== "-" && movementSupportsSubmit(status) ? (
                      <button
                        type="button"
                        disabled={actioningId === movementId}
                        className="h-8 rounded-md border border-primary/30 px-2 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
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
                        className="h-8 rounded-md border border-rose-200 px-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        onClick={() => {
                          void triggerMovementAction(item, "cancel")
                        }}
                      >
                        {actioningId === movementId ? "Working..." : "Cancel"}
                      </button>
                    ) : null}
                  </div>
                ),
              }
            })}
          />
        )}
      </div>

      <ProfileSidePanel
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open) {
            closeAddDialog()
          }
        }}
        title={<>Add Employee Movement</>}
        description={<>Create a movement draft for this employee, then submit it from the movements list.</>}
        footer={<>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => {
                closeAddDialog()
              }}
            >
              Cancel
            </button>
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
          </>}
      >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Movement type">
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
            </FormField>

            <FormField label="Effective date">
              <DatePickerPresets
                value={form.effective_date}
                onChange={(value) => setForm((current) => ({ ...current, effective_date: value }))}
              />
            </FormField>

            <FormField label="Title" className="sm:col-span-2">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full"
                placeholder="Movement title"
              />
            </FormField>

            <FormField label="Reason" className="sm:col-span-2">
              <Textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-24 w-full"
                placeholder="Why this movement is needed"
              />
            </FormField>

            {showBranchField ? (
              <FormField label="Target branch">
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
              </FormField>
            ) : null}

            {showDepartmentField ? (
              <FormField label="Target department">
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
              </FormField>
            ) : null}

            {showPositionField ? (
              <FormField label="Target position">
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
              </FormField>
            ) : null}

            {showManagerField ? (
              <FormField label="Target manager">
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
              </FormField>
            ) : null}

            {showGradeField ? (
              <FormField label="Target grade">
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
              </FormField>
            ) : null}

            {showCostCenterField ? (
              <FormField label="Target cost center">
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
              </FormField>
            ) : null}

            {showEmploymentTypeField ? (
              <FormField label="Target employment type">
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
              </FormField>
            ) : null}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
      </ProfileSidePanel>

      <ProfileSidePanel
        open={Boolean(viewingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRecord(null)
            setMovementOperations([])
            setDetailError(null)
          }
        }}
        title={<>Movement Details</>}
        description={<>Review movement changes, lifecycle status, and downstream operations.</>}
        footer={<>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => {
                setViewingRecord(null)
                setMovementOperations([])
                setDetailError(null)
              }}
            >
              Close
            </button>
          </>}
      >
          {viewingRecord ? (
            (() => {
              const status = readString(viewingRecord, ["status"])
              const normalizedStatus = status.trim().toLowerCase()
              const movementNo = readString(viewingRecord, ["movementNo", "movement_no"])
              const movementType = readString(viewingRecord, ["movementType", "movement_type"])
              const keep = (entry: { label: string; value: string }) => Boolean(entry.value) && entry.value !== "-"
              const details = [
                { label: "Effective date", value: formatProfileDate(readString(viewingRecord, ["effectiveDate", "effective_date"])) },
                { label: "Reason", value: readString(viewingRecord, ["reason"]) },
                { label: "Created", value: formatDateTime(readString(viewingRecord, ["createdAt", "created_at"])) },
                { label: "Updated", value: formatDateTime(readString(viewingRecord, ["updatedAt", "updated_at"])) },
                { label: "Submitted", value: formatDateTime(readString(viewingRecord, ["submittedAt", "submitted_at"])) },
                { label: "Approved", value: formatDateTime(readString(viewingRecord, ["approvedAt", "approved_at"])) },
              ].filter(keep)
              const changes = asRecordArray(viewingRecord.changes)
              const statusTagTone = (value: string) =>
                ["applied", "approved", "completed", "succeeded", "success"].includes(value)
                  ? "success"
                  : ["rejected", "failed", "cancelled", "error"].includes(value)
                    ? "danger"
                    : "warning"
              return (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <SectionGlyph title="Movements" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">{readString(viewingRecord, ["title"])}</p>
                      <RecordBadges>
                        {movementNo !== "-" ? <RecordTag>{movementNo}</RecordTag> : null}
                        {movementType !== "-" ? <RecordTag tone="primary">{formatLabelValue(movementType)}</RecordTag> : null}
                        {status !== "-" ? <RecordTag tone={statusTagTone(normalizedStatus)}>{formatLabelValue(status)}</RecordTag> : null}
                      </RecordBadges>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4">
                    {details.length ? <RecordFieldGrid fields={details} /> : <p className="text-sm text-muted-foreground">No details recorded.</p>}
                  </div>

                  <section className="flex flex-col gap-2">
                    <h4 className="text-xs font-medium text-muted-foreground">Changes</h4>
                    {changes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No change breakdown was returned for this movement.</p>
                    ) : (
                      changes.map((change, index) => (
                        <div key={`movement-detail-change-${index}`} className="rounded-lg border border-border bg-background p-4">
                          <p className="mb-3 text-sm font-semibold text-foreground">{formatLabelValue(readString(change, ["field"]))}</p>
                          <RecordFieldGrid
                            fields={[
                              { label: "From", value: movementChangeValueSummary(change.oldValue) },
                              { label: "To", value: movementChangeValueSummary(change.newValue) },
                            ].filter(keep)}
                          />
                        </div>
                      ))
                    )}
                  </section>

                  <section className="flex flex-col gap-2">
                    <h4 className="text-xs font-medium text-muted-foreground">Operations</h4>
                    {operationsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading movement operations...</p>
                    ) : detailError ? (
                      <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {detailError}
                      </p>
                    ) : movementOperations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No downstream operations were returned.</p>
                    ) : (
                      movementOperations.map((operation, index) => {
                        const operationStatus = readString(operation, ["status"])
                        return (
                          <div key={`movement-operation-${readNumber(operation.id) ?? index}`} className="rounded-lg border border-border bg-background p-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {formatLabelValue(readString(operation, ["operationType", "operation_type"]))}
                              </span>
                              {operationStatus !== "-" ? (
                                <RecordTag tone={statusTagTone(operationStatus.trim().toLowerCase())}>{formatLabelValue(operationStatus)}</RecordTag>
                              ) : null}
                            </div>
                            <RecordFieldGrid
                              fields={[
                                { label: "Resource key", value: readString(operation, ["resourceKey", "resource_key"]) },
                                { label: "Updated", value: formatDateTime(readString(operation, ["updatedAt", "updated_at"])) },
                                { label: "Error", value: readString(operation, ["errorMessage", "error_message"]) },
                              ].filter(keep)}
                            />
                          </div>
                        )
                      })
                    )}
                  </section>
                </div>
              )
            })()
          ) : null}
      </ProfileSidePanel>
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
  const pageActor = useDashboardActor()
  // Hide header actions the server would refuse for this viewer.
  const canUpdateProfile = pageActor.ready && canPerformPermission(pageActor.permissionLabels, "employees:update")
  const canChangeStatus = pageActor.ready && canPerformPermission(pageActor.permissionLabels, "employees:change-status")
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
      <div className={cn("mx-auto mt-4 w-full animate-pulse rounded-[var(--hrms-control-radius)] border border-border bg-card sm:mt-6", PAGE_SHELL_WIDTH)} aria-busy="true" aria-label="Loading employee profile">
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
    const isNotFound = error === "Employee not found." || !error
    return (
      <div className={cn("mx-auto mt-4 w-full rounded-[var(--hrms-control-radius)] border border-border bg-card px-4 py-12 sm:mt-6 sm:px-6", PAGE_SHELL_WIDTH)}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <TriangleAlertIcon className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {isNotFound ? "Employee not found" : "Could not load this profile"}
            </h2>
            <p role="alert" className="text-sm text-muted-foreground">
              {isNotFound
                ? "This employee number does not match any employee you can view."
                : error}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {!isNotFound ? (
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium !text-white hover:bg-primary/90"
                onClick={() => void fetchEmployee()}
              >
                <RefreshCwIcon className="size-4" aria-hidden="true" /> Retry
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
              onClick={() => router.push("/dashboard/employees/all")}
            >
              Back to all employees
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageShell>
      <EmployeeProfileHero
        employee={employee}
        onUpdateProfile={canUpdateProfile ? () => setIdentityDialogOpen(true) : undefined}
        onUpdateStatus={canChangeStatus ? () => setStatusDialogOpen(true) : undefined}
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
                  <Input
                    type="search"
                    value={profileSearch}
                    onChange={(_event, data) => setProfileSearch(data.value)}
                    placeholder="Search employee profile"
                    aria-label="Search employee profile"
                  />
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
    </PageShell>
  )
}
