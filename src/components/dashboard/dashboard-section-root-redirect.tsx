"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
 findFirstAccessibleSectionUrl,
 type DashboardSectionTabGroup,
} from "@/lib/dashboard-sections"

type DashboardSectionRootRedirectProps = {
 groups: DashboardSectionTabGroup[]
 fallbackHref?: string
}

export function DashboardSectionRootRedirect({
 groups,
 fallbackHref = "/dashboard",
}: DashboardSectionRootRedirectProps) {
 const actor = useDashboardActor()
 const pathname = usePathname()
 const router = useRouter()

 const targetHref = React.useMemo(() => {
 if (!actor.ready) {
 return null
 }

 return findFirstAccessibleSectionUrl(groups, actor.permissionLabels) ?? fallbackHref
 }, [actor.permissionLabels, actor.ready, fallbackHref, groups])

 React.useEffect(() => {
 if (!targetHref || pathname === targetHref) {
 return
 }

 router.replace(targetHref)
 }, [pathname, router, targetHref])

 return null
}
