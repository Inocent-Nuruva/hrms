import { env } from "@/lib/env";

/** Normalize API base (strip trailing /api if someone set full API root). */
export function resolveApiBaseUrl() {
  return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api$/i, "")
}

export const API_BASE_URL = resolveApiBaseUrl()

export const AUTH_STORAGE_KEYS = {
  tokens: "ess.auth.tokens",
  user: "ess.auth.user",
  rememberMe: "ess.auth.rememberMe",
  rememberedEmail: "ess.auth.rememberedEmail",
} as const;

export const ROUTES = {
  login: "/login",
  verifyEmail: "/verify-email",
  changePassword: "/change-password",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  dashboardSettings: "/dashboard/settings",
  onboarding: "/dashboard/me/onboarding",
} as const;

export const SETTINGS_SECURITY_TABS = {
  resetPassword: "reset-password",
} as const;

export function buildDashboardResetPasswordHref(options?: { required?: boolean }) {
  const params = new URLSearchParams()
  params.set("tab", SETTINGS_SECURITY_TABS.resetPassword)
  if (options?.required) {
    params.set("required", "1")
  }
  return `${ROUTES.dashboardSettings}?${params.toString()}`
}

export function isDashboardResetPasswordLocation(
  pathname: string | null | undefined,
  search?: string | URLSearchParams | null,
) {
  if ((pathname ?? "").trim() !== ROUTES.dashboardSettings) {
    return false
  }

  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : new URLSearchParams()
  const tab = (params.get("tab") ?? "").trim().toLowerCase()
  return tab === "password" || tab === SETTINGS_SECURITY_TABS.resetPassword
}

