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
    "inline-flex min-w-0 items-center gap-1 border-b-2 px-1.5 py-1.5 text-left text-xs font-medium outline-none transition-colors",
    active
      ? "border-[var(--primary)] text-[var(--primary)]"
      : "border-transparent text-muted-foreground hover:text-foreground"
  )

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

  const activeItem =
    flatItems.find((item) => isActivePath(currentPath, item.url)) ?? flatItems[0] ?? null

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="hidden flex-wrap items-end gap-x-1 gap-y-0.5 border-b border-border/80 md:flex">
        {groups.map((group) => {
          const activeGroupItem =
            group.items.find((item) => isActivePath(currentPath, item.url)) ?? group.items[0] ?? null
          const isActiveGroup = Boolean(
            activeGroupItem && isActivePath(currentPath, activeGroupItem.url)
          )

          if (!activeGroupItem) {
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
                <span className="truncate">{label}</span>
              </Link>
            )
          }

          return (
            <DropdownMenu key={group.title ?? activeGroupItem.url}>
              <DropdownMenuTrigger
                render={
                  <button type="button" className={tabTriggerClass(isActiveGroup)} />
                }
              >
                <span className="truncate">{group.title ?? activeGroupItem.title}</span>
                <span
                  className={cn(
                    "hidden max-w-36 truncate text-[11px] font-normal lg:inline",
                    isActiveGroup
                      ? "text-[color:rgb(var(--primary-rgb)/0.78)]"
                      : "text-muted-foreground/80"
                  )}
                >
                  · {activeGroupItem.title}
                </span>
                <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48">
                <DropdownMenuGroup>
                  {group.items.map((item) => {
                    const isActive = isActivePath(currentPath, item.url)

                    return (
                      <DropdownMenuItem
                        key={item.url}
                        className="justify-between gap-2 py-1.5 text-xs"
                        onClick={() => router.push(item.url)}
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

      <div className="relative md:hidden">
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <select
          className="h-8 w-full appearance-none rounded-md border border-border bg-background px-2.5 pr-8 text-xs text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          value={activeItem?.url ?? ""}
          onChange={(event) => {
            if (event.target.value) {
              router.push(event.target.value)
            }
          }}
        >
          {flatItems.map((item) => (
            <option key={item.url} value={item.url}>
              {item.isDirectLink || item.groupTitle === item.title
                ? item.title
                : `${item.groupTitle}: ${item.title}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
