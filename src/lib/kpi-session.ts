import { AUTH_STORAGE_KEYS } from "@/utils/constants"
export function readKpiToken() {
  if (typeof window === "undefined") return ""
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
    const tokens = raw ? JSON.parse(raw) as { accessToken?: string; access_token?: string } : null
    return tokens?.accessToken ?? tokens?.access_token ?? window.localStorage.getItem("hrms.admin.accessToken") ?? ""
  } catch { return window.localStorage.getItem("hrms.admin.accessToken") ?? "" }
}
// KPI is part of the main HRMS; record access remains enforced by the API.
export const kpiEnabled = true
export const scorecardsEnabled = true
export const achievementsEnabled = true
export const evaluationsEnabled = true
export const analyticsEnabled = true
export const reportsEnabled = true
