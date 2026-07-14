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
import { getUnreadNotificationsCount, type AdminResourceKey } from "@/lib/admin-api"
import { ChevronDownIcon } from "lucide-react"
import { Bell } from "@/components/animate-ui/icons/bell"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"
import { NotificationCenter } from "@/components/notification-center"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

type NavMainNode = {
  title: string
  url?: string
  matchUrls?: string[]
  resource?: AdminResourceKey
  items?: NavMainNode[]
  disabled?: boolean
}

type NavMainItem = NavMainNode & {
  icon?: React.ReactNode
}

const LEGACY_ADMIN_TOKEN_KEY = "hrms.admin.accessToken"

function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
      const accessToken = (parsed.accessToken ?? parsed.access_token ?? "").trim()
      if (accessToken) {
        return accessToken
      }
    } catch {
      // Fall through to legacy key.
    }
  }

  return window.localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY)?.trim() ?? ""
}

function nodeContainsCurrentPath(node: NavMainNode, currentPath: string): boolean {
  if (
    (node.url && (currentPath === node.url || currentPath.startsWith(`${node.url}/`))) ||
    (node.matchUrls ?? []).some(
      (url) => currentPath === url || currentPath.startsWith(`${url}/`)
    )
  ) {
    return true
  }

  return (node.items ?? []).some((child) => nodeContainsCurrentPath(child, currentPath))
}

function collectOpenableNodes(nodes: NavMainNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.items?.length ? [node.title] : []),
    ...collectOpenableNodes(node.items ?? []),
  ])
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
        collectOpenableNodes(items).map((title) => [
          title,
          items.some((item) => {
            const matchNode = (node: NavMainNode): boolean => {
              if (node.title === title) {
                return nodeContainsCurrentPath(node, currentPath)
              }
              return (node.items ?? []).some((child) => matchNode(child))
            }
            return matchNode(item)
          }),
        ])
      ),
    [items, currentPath]
  )
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    return defaultOpenGroups
  })
  const [hoveredLink, setHoveredLink] = React.useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0)
  const groupedItems = React.useMemo(() => {
    const expandable = items.filter((item) => item.items?.length)
    const directLinks = items.filter((item) => !item.items?.length)
    return { expandable, directLinks }
  }, [items])

  const renderAnimatedIcon = React.useCallback((icon: React.ReactNode, key: string) => {
    if (!React.isValidElement(icon)) {
      return icon
    }
    return React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, {
      animate: hoveredLink === key ? "path-loop" : false,
      size: 32,
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
    let cancelled = false

    const loadUnreadCount = async () => {
      const token = readStoredToken()
      if (!token) {
        if (!cancelled) {
          setUnreadNotificationCount(0)
        }
        return
      }

      try {
        const count = await getUnreadNotificationsCount(token)
        if (!cancelled) {
          setUnreadNotificationCount(count)
        }
      } catch {
        if (!cancelled) {
          setUnreadNotificationCount(0)
        }
      }
    }

    void loadUnreadCount()
    const intervalId = window.setInterval(() => {
      void loadUnreadCount()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  React.useEffect(() => {
    setOpenGroups((previous) => {
      const next: Record<string, boolean> = { ...previous }
      for (const title of collectOpenableNodes(items)) {
        const matchesCurrentPath = items.some((item) => {
          const matchNode = (node: NavMainNode): boolean => {
            if (node.title === title) {
              return nodeContainsCurrentPath(node, currentPath)
            }
            return (node.items ?? []).some((child) => matchNode(child))
          }
          return matchNode(item)
        })
        if (matchesCurrentPath) {
          next[title] = true
        }
      }
      return next
    })
  }, [items, currentPath])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(openGroups))
  }, [openGroups])

  function renderNode(node: NavMainNode, depth: number): React.ReactNode {
    const hasChildren = Boolean(node.items?.length)
    const isActive = hasChildren ? nodeContainsCurrentPath(node, currentPath) : currentPath === node.url
    const key = `${depth}-${node.title}-${node.url ?? "group"}`

    if (hasChildren) {
      return (
        <SidebarMenuSubItem key={key}>
          <SidebarMenuSubButton
            className={`cursor-pointer rounded-lg text-foreground !no-underline hover:!no-underline hover:bg-muted data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] ${
              depth === 0 ? "py-3 text-[0.78rem] font-medium leading-snug" : "py-3 text-[0.82rem] font-medium leading-snug"
            }`}
            isActive={isActive}
            onClick={() =>
              setOpenGroups((previous) => ({
                ...previous,
                [node.title]: !previous[node.title],
              }))
            }
          >
            <span className="min-w-0 flex-1 truncate">{node.title}</span>
            <ChevronDownIcon
              className={
                openGroups[node.title]
                  ? "ml-auto transition-transform duration-300 rotate-180"
                  : "ml-auto transition-transform duration-300"
              }
            />
          </SidebarMenuSubButton>
          <div
            aria-hidden={!openGroups[node.title]}
            className={
              openGroups[node.title]
                ? "grid grid-rows-[1fr] opacity-100 transition-all duration-300 ease-in-out"
                : "grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-in-out pointer-events-none"
            }
          >
            <div className="overflow-hidden">
              <SidebarMenuSub
                className={
                  depth > 0
                    ? "ml-3 space-y-1 border-l border-slate-200 pl-2 pt-1"
                    : "mx-1.5 space-y-1.5 border-l-0 px-0 pt-1"
                }
              >
                {node.items?.map((child) => renderNode(child, depth + 1))}
              </SidebarMenuSub>
            </div>
          </div>
        </SidebarMenuSubItem>
      )
    }

    return (
      <SidebarMenuSubItem key={key}>
        <SidebarMenuSubButton
          className={`rounded-lg !no-underline data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] ${
            node.disabled
              ? "cursor-not-allowed py-3 text-[0.82rem] leading-snug text-slate-400"
              : depth === 0
                ? "cursor-pointer py-3 text-[0.78rem] leading-snug text-foreground hover:!no-underline hover:bg-muted"
                : "cursor-pointer py-3 text-[0.82rem] leading-snug text-foreground hover:!no-underline hover:bg-muted"
          }`}
          isActive={!node.disabled && Boolean(node.url) && currentPath === node.url}
          onClick={() => {
            if (!node.disabled && node.url) {
              router.push(node.url)
            }
          }}
        >
          <span className="min-w-0 flex-1 truncate">{node.title}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu className="space-y-0">
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Dashboard"
              className="min-h-[2.6rem] h-auto min-w-8 rounded-xl bg-transparent py-2 text-[0.9rem] font-medium leading-snug text-foreground duration-200 ease-linear hover:bg-muted hover:text-foreground data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] [&_svg]:!text-[var(--sidebar-icon-color)]"
              isActive={currentPath === "/dashboard"}
              onClick={() => {
                router.push("/dashboard")
              }}
              onMouseEnter={() => setHoveredLink("__dashboard")}
              onMouseLeave={() => setHoveredLink((value) => (value === "__dashboard" ? null : value))}
            >
              <LayoutDashboard size={40} animation="path-loop" animate={hoveredLink === "__dashboard" ? "path-loop" : false} />
              <span className="min-w-0 flex-1 text-left leading-[1.1rem] whitespace-normal">Dashboard</span>
            </SidebarMenuButton>
            <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DialogTrigger
                render={
                  <Button
                    size="icon"
                    className="relative size-7 group-data-[collapsible=icon]:opacity-0"
                    variant="outline"
                    aria-label="Notifications"
                    title="Notifications"
                  />
                }
              >
                <Bell size={40} animation="path-loop" animateOnHover="path-loop" />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-4 text-white">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
                <span className="sr-only">Notifications</span>
              </DialogTrigger>
              <DialogPopup from="right" showCloseButton className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Notifications</DialogTitle>
                </DialogHeader>

                <NotificationCenter
                  open={notificationsOpen}
                  onOpenChange={setNotificationsOpen}
                  onUnreadCountChange={setUnreadNotificationCount}
                />

                <DialogFooter>
                  <DialogClose render={<Button variant="outline">Close</Button>} />
                </DialogFooter>
              </DialogPopup>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="space-y-0.5">
          {groupedItems.expandable.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                className="min-h-[2.6rem] h-auto cursor-pointer rounded-xl py-2 text-[0.9rem] font-medium leading-snug text-foreground !no-underline hover:!no-underline hover:bg-muted data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] [&_svg]:!text-[var(--sidebar-icon-color)]"
                isActive={
                  item.items ? nodeContainsCurrentPath(item, currentPath) : currentPath === item.url
                }
                onClick={() => {
                  if (!item.items) {
                    if (item.url) {
                      router.push(item.url)
                    }
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
                <span className="min-w-0 flex-1 text-left leading-[1.1rem] whitespace-normal">
                  {item.title}
                </span>
                {item.items ? (
                  <ChevronDownIcon
                    className={
                      openGroups[item.title]
                        ? "ml-auto mt-0.5 shrink-0 self-start transition-transform duration-300 rotate-180"
                        : "ml-auto mt-0.5 shrink-0 self-start transition-transform duration-300"
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
                      {item.items.map((subItem) => renderNode(subItem, 0))}
                    </SidebarMenuSub>
                  </div>
                </div>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        {groupedItems.directLinks.length > 0 ? (
          <SidebarMenu className="space-y-0.5 pt-1.5">
            {groupedItems.directLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                className="min-h-[2.6rem] h-auto cursor-pointer rounded-xl py-2 text-[0.9rem] font-medium leading-snug text-foreground !no-underline hover:!no-underline hover:bg-muted data-active:!bg-transparent data-active:!text-[var(--sidebar-active-link-color)] [&_svg]:!text-[var(--sidebar-icon-color)]"
                isActive={
                  item.items ? nodeContainsCurrentPath(item, currentPath) : currentPath === item.url
                }
                onClick={() => {
                  if (!item.items) {
                    if (item.url) {
                      router.push(item.url)
                    }
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
                <span className="min-w-0 flex-1 text-left leading-[1.1rem] whitespace-normal">
                  {item.title}
                </span>
                {item.items ? (
                  <ChevronDownIcon
                    className={
                      openGroups[item.title]
                        ? "ml-auto mt-0.5 shrink-0 self-start transition-transform duration-300 rotate-180"
                        : "ml-auto mt-0.5 shrink-0 self-start transition-transform duration-300"
                    }
                  />
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : null}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
