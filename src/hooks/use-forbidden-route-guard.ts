"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { isPermissionError } from "@/components/dashboard/talent-visuals"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  canSeeDashboardPage,
  firstVisibleSiblingOrHome,
  FORBIDDEN_ROUTES_EVENT,
  isRememberedForbiddenRoute,
  rememberForbiddenRoute,
} from "@/lib/forbidden-routes"

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
  if (!actor.ready) return true
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

  React.useEffect(() => {
    if (!pathname || pathname === "/dashboard") return
    if (!isRememberedForbiddenRoute(pathname)) return
    router.replace(
      firstVisibleSiblingOrHome(pathname, actor.permissionLabels, actor.accessMode),
    )
  }, [actor.accessMode, actor.permissionLabels, pathname, router])
}
