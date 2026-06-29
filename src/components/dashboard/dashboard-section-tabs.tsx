"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Tabs2 } from "@/components/ui/tabs-2"
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
  const hasGroupedTabs = groups.length > 1 && groups.every((group) => Boolean(group.title))
  const stickyClassName = "sticky top-(--header-height) z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"

  if (hasGroupedTabs) {
    return <Tabs2 groups={groups} currentPath={currentPath} className={cn(stickyClassName, className)} />
  }

  return (
    <div className={cn("flex flex-col gap-2", stickyClassName, className)}>
      {groups.map((group) => (
        <div key={group.title ?? group.items.map((item) => item.url).join("|")} className="flex flex-col gap-1.5">
          {group.title ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {group.title}
            </p>
          ) : null}
          <div className="glass-scrollbar overflow-x-auto">
            <div className="inline-flex min-w-full items-center gap-4 border-b border-border/80">
              {group.items.map((item) => {
                const isActive = isActivePath(currentPath, item.url)

                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    className={cn(
                      "border-b-2 px-1 py-2 text-[0.92rem] font-medium whitespace-nowrap transition-colors duration-200",
                      isActive
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-slate-600 hover:text-slate-900"
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
