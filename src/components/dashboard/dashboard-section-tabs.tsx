"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useDashboardIdentity } from "@/components/dashboard/dashboard-identity"
import { Tabs2 } from "@/components/ui/tabs-2"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { cn } from "@/lib/utils"
import type { DashboardSectionTabGroup } from "@/lib/dashboard-sections"

type DashboardSectionTabsProps = {
  groups: DashboardSectionTabGroup[]
  className?: string
  showGroupNavigation?: boolean
  hideOnPaths?: string[]
}

export function DashboardSectionTabs({
  groups,
  className,
  showGroupNavigation = false,
  hideOnPaths = [],
}: DashboardSectionTabsProps) {
  const pathname = usePathname()
  const currentPath = pathname ?? ""
  const actor = useDashboardActor()
  const identity = useDashboardIdentity()
  // Defer permission-filtered UI until after mount so SSR and the first client
  // paint both render the same placeholder (avoids hydration mismatch).
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Stick under the site header inside the main scroll pane (header is outside scroll).
  // min-w-0 keeps horizontal tab rails scrollable inside the overflow-x-hidden main pane.
  // Solid bg-card so content never shows through the sticky rail on mobile.
  // Negative margins match parent content padding (px-3 / sm:px-4 / md:px-4).
  const stickyClassName =
    "sticky top-0 z-40 -mx-3 min-w-0 border-b border-border/80 bg-card px-3 py-1 sm:-mx-4 sm:px-4 md:-mx-4 md:px-4"

  const filteredGroups = React.useMemo(() => {
    if (!mounted || !actor.ready) {
      return [] as DashboardSectionTabGroup[]
    }
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          canSeeDashboardPage(item.url, actor.permissionLabels, actor.accessMode, {
            roleNames: actor.roleNames,
            scope: actor.scope,
            homeDashboardKind: identity.homeDashboardKind,
          }),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [
    actor.accessMode,
    actor.permissionLabels,
    actor.ready,
    actor.roleNames,
    actor.scope,
    groups,
    identity.homeDashboardKind,
    mounted,
  ])

  const hasGroupedTabs =
    filteredGroups.length > 1 && filteredGroups.every((group) => Boolean(group.title))

  if (hideOnPaths.includes(currentPath.replace(/\/$/, ""))) {
    return null
  }

  // Stable shell height during SSR → client so layout does not jump hard.
  if (!mounted || !actor.ready) {
    return (
      <div
        className={cn("flex flex-col gap-1.5", stickyClassName, className)}
        aria-hidden
      >
        <div className="h-8 w-full animate-pulse rounded-md bg-muted/50" />
      </div>
    )
  }

  if (filteredGroups.length === 0) {
    return null
  }

  const tabGroups = hasGroupedTabs
    ? filteredGroups
    : [{ items: filteredGroups.flatMap((group) => group.items) }]

  return (
    <Tabs2
      groups={tabGroups}
      currentPath={currentPath}
      showGroupNavigation={showGroupNavigation}
      className={cn(stickyClassName, className)}
    />
  )
}
