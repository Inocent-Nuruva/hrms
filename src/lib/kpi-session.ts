import { AUTH_STORAGE_KEYS } from "@/utils/constants"
export function readKpiToken() {
  if (typeof window === "undefined") return ""
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
    const tokens = raw ? JSON.parse(raw) as { accessToken?: string; access_token?: string } : null
    return tokens?.accessToken ?? tokens?.access_token ?? window.localStorage.getItem("hrms.admin.accessToken") ?? ""
  } catch { return window.localStorage.getItem("hrms.admin.accessToken") ?? "" }
}
// The public flag is frozen into the frontend build. The backend enforces its own
// KPI_ENABLED switch and remains the authority for access to every record.
export const kpiEnabled = process.env.NEXT_PUBLIC_KPI_ENABLED !== "false"
export const scorecardsEnabled = kpiEnabled
export const achievementsEnabled = kpiEnabled
export const evaluationsEnabled = kpiEnabled
export const analyticsEnabled = kpiEnabled
export const reportsEnabled = kpiEnabled
