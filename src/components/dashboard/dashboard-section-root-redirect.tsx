"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenPrefixes } from "@/hooks/use-forbidden-route-guard"
import { selfServiceHomeFor } from "@/lib/dashboard-nav"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import type { DashboardSectionTabGroup } from "@/lib/dashboard-sections"

type DashboardSectionRootRedirectProps = {
 groups: DashboardSectionTabGroup[]
 fallbackHref?: string
 employeeFallbackHref?: string
}

export function DashboardSectionRootRedirect({
 groups,
 fallbackHref = "/dashboard",
 employeeFallbackHref,
}: DashboardSectionRootRedirectProps) {
 const actor = useDashboardActor()
 const pathname = usePathname()
 const router = useRouter()
 const forbiddenVersion = useForbiddenPrefixes()

 const targetHref = React.useMemo(() => {
 if (!actor.ready) {
 return null
 }

 for (const group of groups) {
   const item = group.items.find((entry) =>
     canSeeDashboardPage(entry.url, actor.permissionLabels, actor.accessMode),
   )
   if (item) return item.url
 }
 if (actor.accessMode === "employee") {
   return employeeFallbackHref ?? selfServiceHomeFor(pathname ?? "") ?? fallbackHref
 }
 return fallbackHref
 }, [
   actor.accessMode,
   actor.permissionLabels,
   actor.ready,
   employeeFallbackHref,
   fallbackHref,
   forbiddenVersion,
   groups,
   pathname,
 ])

 React.useEffect(() => {
 if (!targetHref || pathname === targetHref) {
 return
 }

 router.replace(targetHref)
 }, [pathname, router, targetHref])

 return null
}
