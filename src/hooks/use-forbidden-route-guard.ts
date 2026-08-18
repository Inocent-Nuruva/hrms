"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { isPermissionError } from "@/components/dashboard/talent-visuals"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { probePlatformCompaniesList } from "@/lib/admin-api"
import {
  COMPANY_MANAGEMENT_ROUTE_PERMISSION,
  hasPermission,
  type DashboardAccessMode,
} from "@/lib/dashboard-permissions"
import {
  canSeeDashboardPage,
  confirmPlatformRoute,
  firstVisibleSiblingOrHome,
  FORBIDDEN_ROUTES_EVENT,
  isConfirmedPlatformRoute,
  isRememberedForbiddenRoute,
  rememberForbiddenRoute,
} from "@/lib/forbidden-routes"
import { readStoredSessionTokens } from "@/lib/session-client"

export function useForbiddenPrefixes() {
  const [version, setVersion] = React.useState(0)
  React.useEffect(() => {
    const onChange = () => setVersion((current) => current + 1)
    window.addEventListener(FORBIDDEN_ROUTES_EVENT, onChange)
    return () => window.removeEventListener(FORBIDDEN_ROUTES_EVENT, onChange)
  }, [])
  return version
}

export function useCanSeePage(url: string) {
  const actor = useDashboardActor()
  useForbiddenPrefixes()
  // Hide until identity is known. Showing every page first and then
  // removing the forbidden ones feels like the nav is collapsing.
  if (!actor.ready) return false
  return canSeeDashboardPage(url, actor.permissionLabels, actor.accessMode)
}

export function useForbiddenRouteGuard(allowed: boolean) {
  const router = useRouter()
  const pathname = usePathname()
  const actor = useDashboardActor()

  React.useEffect(() => {
    if (!actor.ready || allowed) return
    if (pathname) rememberForbiddenRoute(pathname)
    router.replace(
      firstVisibleSiblingOrHome(pathname ?? "", actor.permissionLabels, actor.accessMode),
    )
  }, [actor.accessMode, actor.permissionLabels, actor.ready, allowed, pathname, router])
}

export function useLeaveIfForbidden() {
  const router = useRouter()
  const pathname = usePathname()
  const actor = useDashboardActor()

  return React.useCallback(
    (error: unknown) => {
      if (!isPermissionError(error)) return false
      if (pathname) rememberForbiddenRoute(pathname)
      router.replace(
        firstVisibleSiblingOrHome(pathname ?? "", actor.permissionLabels, actor.accessMode),
      )
      return true
    },
    [actor.accessMode, actor.permissionLabels, pathname, router],
  )
}

export function useHideRememberedForbiddenPath() {
  const router = useRouter()
  const pathname = usePathname()
  const actor = useDashboardActor()
  const routeAccessVersion = useForbiddenPrefixes()

  React.useEffect(() => {
    if (!pathname || pathname === "/dashboard") return
    if (!isRememberedForbiddenRoute(pathname)) return
    router.replace(
      firstVisibleSiblingOrHome(pathname, actor.permissionLabels, actor.accessMode),
    )
  }, [actor.accessMode, actor.permissionLabels, pathname, routeAccessVersion, router])
}

export function useProbePlatformCompaniesAccess(
  permissionLabels: string[],
  accessMode: DashboardAccessMode,
  identityReady: boolean,
) {
  const permissionKey = permissionLabels.join("|")

  React.useEffect(() => {
    if (!identityReady || accessMode !== "admin") return
    const labels = permissionKey ? permissionKey.split("|") : []
    if (!hasPermission(labels, COMPANY_MANAGEMENT_ROUTE_PERMISSION)) return
    if (isRememberedForbiddenRoute("/dashboard/companies")) return
    if (isConfirmedPlatformRoute("/dashboard/companies")) return

    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return

    let cancelled = false
    void probePlatformCompaniesList(token)
      .then(() => {
        if (cancelled) return
        confirmPlatformRoute("/dashboard/companies")
      })
      .catch((errorObject) => {
        if (cancelled || !isPermissionError(errorObject)) return
        rememberForbiddenRoute("/dashboard/companies")
      })

    return () => {
      cancelled = true
    }
  }, [accessMode, identityReady, permissionKey])
}
