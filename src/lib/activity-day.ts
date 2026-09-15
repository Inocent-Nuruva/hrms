type Row = Record<string, unknown>

function asRecord(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null
}

export function localIsoDate(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value !== "string" || !value.trim()) return ""
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ""
}

export function addIsoDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  if (Number.isNaN(value.getTime())) return date
  value.setDate(value.getDate() + days)
  return localIsoDate(value)
}

export function reportDateOf(row: Row | null | undefined) {
  if (!row) return ""
  return isoDate(row.activityDate) || isoDate(row.activity_date)
}

function readId(row: Row | null | undefined, keys: string[]) {
  if (!row) return ""
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

export function activityReferenceOf(row: Row | null | undefined) {
  if (!row) return ""
  const value = row.taskReference ?? row.task_reference ?? row.externalReferenceType ?? row.external_reference_type
  return typeof value === "string" ? value.toUpperCase() : ""
}

export function plannedDueDateOf(row: Row | null | undefined) {
  if (!row) return ""
  return isoDate(row.plannedEndTime) || isoDate(row.planned_end_time)
}

export function plannedStartDateOf(row: Row | null | undefined) {
  if (!row) return ""
  return (
    isoDate(row.plannedStartTime) ||
    isoDate(row.planned_start_time) ||
    reportDateOf(row)
  )
}

export function isTeamAssignedActivity(row: Row | null | undefined) {
  const reference = activityReferenceOf(row)
  return reference.includes("MANAGER") && !reference.includes("SELF")
}

export function isManagerAssignedActivity(
  row: Row | null | undefined,
  viewerEmployeeId?: string | number | null,
) {
  if (!row) return false
  const reference = activityReferenceOf(row)
  if (reference.includes("SELF")) return false
  const assignedById = readId(row, ["assignedByEmployeeId", "assigned_by_employee_id"])
  const employeeId = readId(row, ["employeeId", "employee_id"])
  const viewer = viewerEmployeeId == null || viewerEmployeeId === ""
    ? employeeId
    : String(viewerEmployeeId)
  if (assignedById && viewer && assignedById === viewer) return false
  if (assignedById && employeeId && assignedById === employeeId) return false
  if (reference.includes("MANAGER")) return true
  return Boolean(assignedById && viewer && assignedById !== viewer)
}

export function reportStatusOf(row: Row | null | undefined) {
  if (!row) return ""
  const value = row.report_status ?? row.reportStatus ?? row.status
  return typeof value === "string" ? value.toUpperCase() : ""
}

export function isDraftReportStatus(status: string) {
  const value = status.toUpperCase()
  return value === "DRAFT" || value === "RETURNED_FOR_CORRECTION"
}

export function isClosedReportStatus(status: string) {
  const value = status.toUpperCase()
  return (
    value === "SUBMITTED" ||
    value === "APPROVED" ||
    value === "REJECTED" ||
    value === "MANAGER_REVIEW_PENDING"
  )
}

export function canCloseReport(row: Row | null | undefined) {
  return isDraftReportStatus(reportStatusOf(row))
}

export function reportForDate(reports: Row[], day: string) {
  return reports.find((report) => reportDateOf(report) === day) ?? null
}

export function partitionActivityTasks(tasks: Row[], day: string) {
  const today: Row[] = []
  const upcoming: Row[] = []
  for (const task of tasks) {
    const dated = reportDateOf(task)
    if (dated && dated > day) upcoming.push(task)
    else if (!dated || dated === day) today.push(task)
  }
  return { today, upcoming }
}

export function pastActivityReports(reports: Row[], day: string) {
  return reports
    .filter((report) => {
      const dated = reportDateOf(report)
      return Boolean(dated && dated < day)
    })
    .sort((left, right) => reportDateOf(right).localeCompare(reportDateOf(left)))
}

export function policyLimits(row: Row | null | undefined) {
  const snapshot = asRecord(row?.policySnapshot) ?? asRecord(row?.policy_snapshot) ?? {}
  const minItems = Number(snapshot.minimum_activity_count ?? snapshot.minimumActivityCount ?? 1)
  const minCompleted = Number(
    snapshot.minimum_completed_activity_count ?? snapshot.minimumCompletedActivityCount ?? 1,
  )
  const cutoff =
    typeof snapshot.submission_cutoff_time === "string"
      ? snapshot.submission_cutoff_time
      : typeof snapshot.submissionCutoffTime === "string"
        ? snapshot.submissionCutoffTime
        : "20:00"
  return {
    minItems: Number.isFinite(minItems) && minItems > 0 ? minItems : 1,
    minCompleted: Number.isFinite(minCompleted) && minCompleted > 0 ? minCompleted : 1,
    cutoff,
  }
}

export function isCloseableActivityStatus(status: string) {
  return status.toUpperCase() === "COMPLETED"
}

export function defaultCloseEntryIds(entries: Row[]) {
  return entries
    .filter((entry) => isCloseableActivityStatus(String(entry.status ?? "")))
    .map((entry) => String(entry.id ?? ""))
    .filter(Boolean)
}

export function closeReportIssues(params: {
  report: Row | null | undefined
  day: string
  entryCount: number
  completedCount: number
  summary: string
}) {
  const issues: string[] = []
  if (!params.report) {
    issues.push("There is no report for this date yet. Add work first.")
    return issues
  }
  if (reportDateOf(params.report) !== params.day) {
    issues.push("This close-out is for a different date than the report.")
  }
  if (!canCloseReport(params.report)) {
    issues.push("This day is already closed.")
  }
  const limits = policyLimits(params.report)
  if (params.entryCount < limits.minItems) {
    issues.push(`Add at least ${limits.minItems} work item${limits.minItems === 1 ? "" : "s"} before closing this day.`)
  }
  if (params.completedCount < limits.minCompleted) {
    issues.push(
      `Mark at least ${limits.minCompleted} item${limits.minCompleted === 1 ? "" : "s"} complete before closing this day.`,
    )
  }
  if (!params.summary.trim()) {
    issues.push("Write a short summary of the day for your manager.")
  }
  return issues
}
