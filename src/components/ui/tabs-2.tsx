"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { DashboardSectionTabGroup } from "@/lib/dashboard-sections"
import { motion } from "framer-motion"
import { useDashboardMotion } from "@/lib/dashboard-motion"

type Tabs2Props = {
  groups: DashboardSectionTabGroup[]
  currentPath: string
  className?: string
}

function isActivePath(currentPath: string, url: string) {
  return currentPath === url || currentPath.startsWith(`${url}/`)
}

const tabTriggerClass = (active: boolean) =>
  cn(
    "relative inline-flex min-w-0 shrink-0 items-center gap-0.5 px-1 py-1 text-left text-[10px] leading-none font-bold outline-none transition-colors [font-size:10px]",
    active
      ? "text-[var(--primary)]"
      : "text-muted-foreground hover:text-foreground dark:text-slate-100 dark:hover:text-white"
  )

function TabUnderline({ active }: { active: boolean }) {
  const motionPreset = useDashboardMotion()
  if (!active) return null
  if (motionPreset.reduce) {
    return <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[var(--primary)]" />
  }
  return (
    <motion.span
      layoutId="dashboard-grouped-tab"
      className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[var(--primary)]"
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    />
  )
}

export function Tabs2({ groups, currentPath, className }: Tabs2Props) {
  const router = useRouter()
  const activeGroup =
    groups.find((group) => group.items.some((item) => isActivePath(currentPath, item.url))) ??
    groups[0] ??
    null
  const activeGroupLabel = activeGroup?.title?.trim() || activeGroup?.items[0]?.title || "Section"
  const subTabs = activeGroup?.items ?? []

  return (
    <div className={cn("flex min-w-0 items-center gap-2 border-b border-border/80", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                tabTriggerClass(true),
                "shrink-0 gap-1.5 px-2 py-2 text-base leading-none [font-size:18px]",
              )}
              aria-label="Switch section"
            />
          }
        >
          <span className="truncate whitespace-nowrap text-lg font-bold leading-none">
            {activeGroupLabel}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuGroup>
            {groups.map((group) => {
              const firstItem = group.items[0]
              if (!firstItem) return null
              const label = group.title?.trim() || firstItem.title
              const isActive = group === activeGroup
              return (
                <DropdownMenuItem
                  key={group.title ?? firstItem.url}
                  className="justify-between gap-2 py-2.5 text-base"
                  onClick={() => {
                    if (isActive) return
                    router.push(firstItem.url)
                  }}
                >
                  <span className="font-semibold">{label}</span>
                  {isActive ? <CheckIcon className="size-3.5 text-[var(--primary)]" /> : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="tab-rail-scroll min-w-0 flex-1" role="tablist" aria-label="Section pages">
        <div className="inline-flex min-w-full items-center gap-1">
          {subTabs.map((item) => {
            const isActive = isActivePath(currentPath, item.url)
            return (
              <Link
                key={item.url}
                href={item.url}
                role="tab"
                aria-selected={isActive}
                className={tabTriggerClass(isActive)}
              >
                <span className="whitespace-nowrap text-[10px] font-bold leading-none">{item.title}</span>
                <TabUnderline active={isActive} />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
