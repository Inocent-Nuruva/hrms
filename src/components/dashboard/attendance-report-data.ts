import { listAttendanceDailySummariesPage, type AdminRecord } from "@/lib/admin-api"

/** Never present a truncated page as the period's complete attendance. */
export async function loadAttendanceReportRows(token: string, from_date?: string, to_date?: string) {
  const rows: AdminRecord[] = []
  for (let page = 1; ; page += 1) {
    const result = await listAttendanceDailySummariesPage(token, { page, limit: 100, from_date, to_date }, { cacheTtlMs: 0 })
    rows.push(...result.rows)
    if (result.total !== null && rows.length >= result.total) return rows
    if (result.totalPages !== null && page >= result.totalPages) {
      if (result.total !== null && rows.length < result.total) throw new Error("Incomplete attendance report")
      return rows
    }
    if (result.rows.length === 0) {
      if (result.total !== null && rows.length < result.total) throw new Error("Incomplete attendance report")
      return rows
    }
    if (result.total === null && result.totalPages === null && result.rows.length < 100) return rows
  }
}

export function attendanceReportRate(present: number, late: number, absent: number) {
  const total = present + late + absent
  return total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : null
}

export function attendanceReportCategory(row: AdminRecord): "present" | "late" | "absent" | null {
  const value = row.attendanceStatus ?? row.attendance_status ?? row.status ?? row.work_status ?? row.day_status
  const status = typeof value === "string" ? value.toLowerCase() : ""
  if (status.includes("absent") || status.includes("no_show") || status.includes("no show")) return "absent"
  const present = ["present", "late", "worked", "early_departure", "overtime", "half_day", "manual_correction", "on_time", "ontime", "full", "business_trip", "official_duty"].some((part) => status.includes(part)) || status === "ok"
  if (!present) return null
  const lateMinutes = Number(row.lateMinutes ?? row.late_minutes ?? 0)
  return status.includes("late") || lateMinutes > 0 ? "late" : "present"
}
