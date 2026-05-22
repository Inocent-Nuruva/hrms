"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter } from "next/navigation"
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/animate-ui/components/base/dialog"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import type { AdminResourceKey } from "@/lib/admin-api"
import { ChevronDownIcon } from "lucide-react"
import { Bell } from "@/components/animate-ui/icons/bell"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"

type NavMainSubItem = {
  title: string
  url: string
  resource?: AdminResourceKey
}

type NavMainItem =
  | {
      title: string
      icon?: React.ReactNode
      items: NavMainSubItem[]
      url?: never
      resource?: never
    }
  | {
      title: string
      icon?: React.ReactNode
      url: string
      resource?: AdminResourceKey
      items?: never
    }

export function NavMain({
  items,
}: {
  items: NavMainItem[]
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}) {
  const OPEN_GROUPS_STORAGE_KEY = "hrms.sidebar.open-groups.v1"
  const router = useRouter()
  const pathname = usePathname()
  const currentPath = pathname ?? ""
  const defaultOpenGroups = React.useMemo(
    () =>
      Object.fromEntries(
        items
          .filter((item): item is Extract<NavMainItem, { items: NavMainSubItem[] }> => Boolean(item.items))
          .map((item) => [
            item.title,
            item.items.some((subItem) => currentPath.startsWith(subItem.url)),
          ])
      ),
    [items, currentPath]
  )
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    return defaultOpenGroups
  })
  const [hoveredLink, setHoveredLink] = React.useState<string | null>(null)

  const renderAnimatedIcon = React.useCallback((icon: React.ReactNode, key: string) => {
    if (!React.isValidElement(icon)) {
      return icon
    }
    return React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, {
      animate: hoveredLink === key ? "path-loop" : false,
      size: 42,
    })
  }, [hoveredLink])

  React.useEffect(() => {
    setOpenGroups((previous) => ({ ...defaultOpenGroups, ...previous }))
  }, [defaultOpenGroups])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as Record<string, boolean>
      setOpenGroups((previous) => ({ ...previous, ...stored }))
    } catch {
      // ignore invalid cache
    }
  }, [])

  React.useEffect(() => {
    setOpenGroups((previous) => {
      const next: Record<string, boolean> = { ...previous }
      for (const item of items) {
        if (!item.items) {
          continue
        }
        const matchesCurrentPath = item.items.some((subItem) =>
          currentPath.startsWith(subItem.url)
        )
        if (matchesCurrentPath) {
          next[item.title] = true
        }
      }
      return next
    })
  }, [currentPath, items])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(openGroups))
  }, [openGroups])

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Dashboard"
              className="min-w-8 rounded-xl bg-transparent text-foreground duration-200 ease-linear hover:bg-muted hover:text-foreground data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] [&_svg]:!text-[var(--sidebar-icon-color)]"
              isActive={currentPath === "/dashboard"}
              onClick={() => {
                router.push("/dashboard")
              }}
              onMouseEnter={() => setHoveredLink("__dashboard")}
              onMouseLeave={() => setHoveredLink((value) => (value === "__dashboard" ? null : value))}
            >
              <LayoutDashboard size={48} animation="path-loop" animate={hoveredLink === "__dashboard" ? "path-loop" : false} />
              <span>Dashboard</span>
            </SidebarMenuButton>
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    size="icon"
                    className="size-8 group-data-[collapsible=icon]:opacity-0"
                    variant="outline"
                    aria-label="Notifications"
                    title="Notifications"
                  />
                }
              >
                <Bell size={40} animation="path-loop" animateOnHover="path-loop" />
                <span className="sr-only">Notifications</span>
              </DialogTrigger>
              <DialogPopup from="right" showCloseButton className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Notifications</DialogTitle>
                </DialogHeader>

                <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/25 p-6 text-center">
                  <div className="rounded-full bg-muted p-3">
                    <Bell size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-normal text-muted-foreground">No notifications yet</p>
                </div>

                <DialogFooter>
                  <DialogClose render={<Button variant="outline">Close</Button>} />
                </DialogFooter>
              </DialogPopup>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                className="cursor-pointer rounded-xl py-5 text-[1rem] font-medium text-foreground !no-underline hover:!no-underline hover:bg-muted data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] [&_svg]:!text-[var(--sidebar-icon-color)]"
                isActive={
                  item.items
                    ? item.items.some((subItem) => currentPath.startsWith(subItem.url))
                    : currentPath === item.url
                }
                onClick={() => {
                  if (!item.items) {
                    router.push(item.url)
                    return
                  }
                  setOpenGroups((previous) => ({
                    ...previous,
                    [item.title]: !previous[item.title],
                  }))
                }}
                onMouseEnter={() => setHoveredLink(item.title)}
                onMouseLeave={() => setHoveredLink((value) => (value === item.title ? null : value))}
              >
                {renderAnimatedIcon(item.icon, item.title)}
                <span>{item.title}</span>
                {item.items ? (
                  <ChevronDownIcon
                    className={
                      openGroups[item.title]
                        ? "ml-auto transition-transform duration-300 rotate-180"
                        : "ml-auto transition-transform duration-300"
                    }
                  />
                ) : null}
              </SidebarMenuButton>
              {item.items ? (
                <div
                  aria-hidden={!openGroups[item.title]}
                  className={
                    openGroups[item.title]
                      ? "grid grid-rows-[1fr] opacity-100 transition-all duration-300 ease-in-out"
                      : "grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-in-out pointer-events-none"
                  }
                >
                  <div className="overflow-hidden">
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.url}>
                          <SidebarMenuSubButton
                            className="cursor-pointer rounded-lg py-4 text-[0.9rem] text-foreground !no-underline hover:!no-underline hover:bg-muted data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] [&_svg]:!text-[var(--sidebar-icon-color)]"
                            isActive={currentPath === subItem.url}
                            onClick={() => {
                              router.push(subItem.url)
                            }}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </div>
                </div>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
