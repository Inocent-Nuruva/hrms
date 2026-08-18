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
  const flatItems = React.useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          groupTitle: group.title ?? item.title,
          // Single-item groups (e.g. Correction Requests) are just a direct link.
          isDirectLink: group.items.length === 1,
        }))
      ),
    [groups]
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Desktop: compact titles on one row, wrap only when they no longer fit */}
      <div className="hidden flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border/80 md:flex">
        {groups.map((group) => {
          // Prefer the path-matched child; when this group is inactive fall back to first item
          // only for the secondary preview — never replace the group title itself.
          const matchedItem = group.items.find((item) => isActivePath(currentPath, item.url)) ?? null
          const previewItem = matchedItem ?? group.items[0] ?? null
          const isActiveGroup = Boolean(matchedItem)
          const groupLabel = group.title?.trim() || previewItem?.title || "Section"

          if (!previewItem) {
            return null
          }

          // One item → plain link (no dropdown chevron).
          if (group.items.length === 1) {
            const only = group.items[0]
            const label = group.title && group.title !== only.title ? group.title : only.title
            return (
              <Link
                key={only.url}
                href={only.url}
                className={tabTriggerClass(isActivePath(currentPath, only.url))}
              >
                <span className="truncate whitespace-nowrap text-[10px] font-bold leading-none">{label}</span>
                <TabUnderline active={isActivePath(currentPath, only.url)} />
              </Link>
            )
          }

          const showChildPreview =
            Boolean(group.title) &&
            Boolean(previewItem.title) &&
            group.title !== previewItem.title

          return (
            <DropdownMenu key={group.title ?? previewItem.url}>
              <DropdownMenuTrigger
                render={
                  <button type="button" className={cn(tabTriggerClass(isActiveGroup), "max-w-none")} />
                }
              >
                {/* Group title stays stable so layout does not jump when a child becomes active. */}
                <span className="truncate whitespace-nowrap text-[10px] font-bold leading-none">{groupLabel}</span>
                {showChildPreview ? (
                  <span
                    className={cn(
                      "hidden max-w-24 truncate text-[9px] font-medium leading-none whitespace-nowrap lg:inline",
                      isActiveGroup
                        ? "text-[var(--primary)]/80"
                        : "text-muted-foreground/80 dark:text-slate-300"
                    )}
                  >
                    · {previewItem.title}
                  </span>
                ) : null}
                <ChevronDownIcon className="size-3 shrink-0 opacity-70" />
                <TabUnderline active={isActiveGroup} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48">
                <DropdownMenuGroup>
                  {group.items.map((item) => {
                    const isActive = isActivePath(currentPath, item.url)

                    return (
                      <DropdownMenuItem
                        key={item.url}
                        className="justify-between gap-2 py-1.5 text-xs"
                        onClick={() => {
                          // Soft client navigation only — avoid full remounts of the tab rail.
                          if (currentPath !== item.url) {
                            router.push(item.url)
                          }
                        }}
                      >
                        <span>{item.title}</span>
                        {isActive ? (
                          <CheckIcon className="size-3.5 text-[var(--primary)]" />
                        ) : null}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}
      </div>

      {/* Mobile: swipeable flat tab rail — blue underline only, no scrollbar / no select */}
      <div className="tab-rail-scroll md:hidden" role="tablist" aria-label="Section tabs">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {flatItems.map((item) => {
            const isActive = isActivePath(currentPath, item.url)
            const label =
              item.isDirectLink || item.groupTitle === item.title
                ? item.title
                : `${item.groupTitle}: ${item.title}`

            return (
              <Link
                key={item.url}
                href={item.url}
                role="tab"
                aria-selected={isActive}
                className={tabTriggerClass(isActive)}
              >
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
