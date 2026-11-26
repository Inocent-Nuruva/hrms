import { beforeEach, expect, it, vi } from "vitest"
import { attendanceReportCategory, attendanceReportRate, loadAttendanceReportRows } from "./attendance-report-data"
const { page } = vi.hoisted(() => ({ page: vi.fn() }))
vi.mock("@/lib/admin-api", () => ({ listAttendanceDailySummariesPage: page }))
beforeEach(() => page.mockReset())
it("loads every page even when the API caps page size below the request", async () => {
  page.mockResolvedValueOnce({ rows: [{ id: 1 }], total: 2, totalPages: 2 })
    .mockResolvedValueOnce({ rows: [{ id: 2 }], total: 2, totalPages: 2 })
  expect(await loadAttendanceReportRows("token", "2026-10-01", "2026-10-31")).toEqual([{ id: 1 }, { id: 2 }])
  expect(page).toHaveBeenLastCalledWith("token", { page: 2, limit: 100, from_date: "2026-10-01", to_date: "2026-10-31" }, { cacheTtlMs: 0 })
})
it("rejects incomplete totals instead of displaying partial data", async () => {
  page.mockResolvedValue({ rows: [], total: 200, totalPages: 2 })
  await expect(loadAttendanceReportRows("token")).rejects.toThrow("Incomplete attendance report")
})
it("propagates a later-page failure", async () => {
  page.mockResolvedValueOnce({ rows: [{ id: 1 }], total: 2, totalPages: 2 }).mockRejectedValueOnce(new Error("offline"))
  await expect(loadAttendanceReportRows("token")).rejects.toThrow("offline")
})
it("distinguishes no records from measured zero attendance and includes late arrivals", () => {
  expect(attendanceReportRate(0, 0, 0)).toBeNull()
  expect(attendanceReportRate(0, 0, 10)).toBe(0)
  expect(attendanceReportRate(6, 2, 2)).toBe(80)
})
it("classifies actual daily-summary fields and keeps late arrivals separate", () => {
  expect(attendanceReportCategory({ attendanceStatus: "PRESENT", lateMinutes: 0 })).toBe("present")
  expect(attendanceReportCategory({ attendanceStatus: "EARLY_DEPARTURE", lateMinutes: 10 })).toBe("late")
  expect(attendanceReportCategory({ attendanceStatus: "LATE_AND_EARLY_DEPARTURE", lateMinutes: 0 })).toBe("late")
  expect(attendanceReportCategory({ attendanceStatus: "ABSENT" })).toBe("absent")
  expect(attendanceReportCategory({ attendance_status: "LEAVE" })).toBeNull()
})

it("uses the independent status dimensions when present", () => {
  expect(attendanceReportCategory({ primaryStatus: "PRESENT", arrivalStatus: "LATE", attendanceStatus: "PRESENT" })).toBe("late")
  expect(attendanceReportCategory({ primaryStatus: "PRESENT", arrivalStatus: "ON_TIME", attendanceStatus: "OVERTIME" })).toBe("present")
  expect(attendanceReportCategory({ primaryStatus: "ABSENT", attendanceStatus: "ABSENT" })).toBe("absent")
  expect(attendanceReportCategory({ primaryStatus: "LEAVE", attendanceStatus: "ANNUAL_LEAVE" })).toBe(null)
  expect(attendanceReportCategory({ primaryStatus: "NOT_YET_CHECKED_IN", attendanceStatus: "ABSENT" })).toBe(null)
})
