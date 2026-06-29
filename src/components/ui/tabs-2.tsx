"use client"

import * as React from "react"
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

export function Tabs2({ groups, currentPath, className }: Tabs2Props) {
  const router = useRouter()
  const flatItems = React.useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          groupTitle: group.title ?? item.title,
        }))
      ),
    [groups]
  )

  const activeItem =
    flatItems.find((item) => isActivePath(currentPath, item.url)) ?? flatItems[0] ?? null

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="hidden flex-wrap items-end gap-x-5 gap-y-2 border-b border-border/80 pb-1 md:flex">
        {groups.map((group) => {
          const activeGroupItem =
            group.items.find((item) => isActivePath(currentPath, item.url)) ?? group.items[0] ?? null
          const isActiveGroup = Boolean(activeGroupItem && isActivePath(currentPath, activeGroupItem.url))

          if (!activeGroupItem) {
            return null
          }

          return (
            <DropdownMenu key={group.title ?? activeGroupItem.url}>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-w-0 items-center gap-2 border-b-2 px-1 py-2 text-left text-sm font-medium outline-none transition-colors",
                      isActiveGroup
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  />
                }
              >
                <span className="truncate">{group.title ?? activeGroupItem.title}</span>
                <span
                  className={cn(
                    "hidden max-w-44 truncate text-xs lg:inline",
                    isActiveGroup ? "text-[color:rgb(var(--primary-rgb)/0.78)]" : "text-muted-foreground/80"
                  )}
                >
                  {activeGroupItem.title}
                </span>
                <ChevronDownIcon className="size-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                <DropdownMenuGroup>
                  {group.items.map((item) => {
                    const isActive = isActivePath(currentPath, item.url)

                    return (
                      <DropdownMenuItem
                        key={item.url}
                        className="justify-between gap-3"
                        onClick={() => router.push(item.url)}
                      >
                        <span>{item.title}</span>
                        {isActive ? <CheckIcon className="size-4 text-[var(--primary)]" /> : null}
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
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={activeItem?.url ?? ""}
          onChange={(event) => {
            if (event.target.value) {
              router.push(event.target.value)
            }
          }}
        >
          {flatItems.map((item) => (
            <option key={item.url} value={item.url}>
              {item.groupTitle}: {item.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
