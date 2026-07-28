"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { Tabs2 } from "@/components/ui/tabs-2"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { cn } from "@/lib/utils"
import type { DashboardSectionTabGroup } from "@/lib/dashboard-sections"

type DashboardSectionTabsProps = {
  groups: DashboardSectionTabGroup[]
  className?: string
}

function isActivePath(currentPath: string, url: string) {
  return currentPath === url || currentPath.startsWith(`${url}/`)
}

export function DashboardSectionTabs({
  groups,
  className,
}: DashboardSectionTabsProps) {
  const pathname = usePathname()
  const currentPath = pathname ?? ""
  const actor = useDashboardActor()
  // Stick under the site header inside the main scroll pane (header is outside scroll).
  const stickyClassName =
    "sticky top-0 z-40 -mx-3 border-b border-border/80 bg-background px-3 py-1.5 md:-mx-4 md:px-4"

  const filteredGroups = React.useMemo(() => {
    if (!actor.ready) {
      return []
    }

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          canAccessDashboardRoute(item.url, actor.permissionLabels, actor.accessMode)
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [actor.accessMode, actor.permissionLabels, actor.ready, groups])

  const hasGroupedTabs =
    filteredGroups.length > 1 && filteredGroups.every((group) => Boolean(group.title))

  if (!actor.ready || filteredGroups.length === 0) {
    return null
  }

  if (hasGroupedTabs) {
    return <Tabs2 groups={filteredGroups} currentPath={currentPath} className={cn(stickyClassName, className)} />
  }

  return (
    <div className={cn("flex flex-col gap-1.5", stickyClassName, className)}>
      {filteredGroups.map((group) => (
        <div key={group.title ?? group.items.map((item) => item.url).join("|")} className="flex flex-col gap-1">
          {group.title ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
          ) : null}
          <div className="glass-scrollbar overflow-x-auto">
            <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
              {group.items.map((item) => {
                const isActive = isActivePath(currentPath, item.url)

                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    className={cn(
                      "border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                      isActive
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
                    )}
                  >
                    {item.title}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
