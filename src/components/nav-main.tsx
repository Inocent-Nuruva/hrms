"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
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
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"

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

function pathMatches(url: string | undefined, currentPath: string): boolean {
  if (!url) return false
  return currentPath === url || currentPath.startsWith(`${url}/`)
}

function nodeContainsCurrentPath(node: NavMainNode, currentPath: string): boolean {
  if (pathMatches(node.url, currentPath)) {
    return true
  }
  if ((node.matchUrls ?? []).some((url) => pathMatches(url, currentPath))) {
    return true
  }
  return (node.items ?? []).some((child) => nodeContainsCurrentPath(child, currentPath))
}

/** Compact row styles — denser than default shadcn sidebar. */
const SIDEBAR_ITEM_BASE =
  "h-8 min-h-8 cursor-pointer rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium leading-none text-foreground !no-underline hover:!no-underline hover:bg-muted duration-200 ease-linear"
const SIDEBAR_ITEM_ACTIVE =
  "data-active:!bg-primary/10 dark:data-active:!bg-[#262626] data-active:!text-[var(--sidebar-active-link-color)] data-active:[&_svg]:!text-[var(--sidebar-active-link-color)]"
const SIDEBAR_ITEM_ICON = "[&_svg]:!size-[1.125rem] [&_svg]:!text-[var(--sidebar-icon-color)]"

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
      size: 20,
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
          className={`rounded-lg !no-underline ${
            node.disabled
              ? "cursor-not-allowed py-2.5 text-[0.82rem] leading-snug text-slate-400"
              : "cursor-pointer py-2.5 text-[0.8rem] leading-snug text-foreground hover:!no-underline hover:bg-muted data-active:!bg-primary/10 dark:data-active:!bg-[#262626] data-active:!font-semibold data-active:!text-[var(--sidebar-active-link-color)]"
          }`}
          isActive={!node.disabled && nodeContainsCurrentPath(node, currentPath)}
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
    <SidebarGroup className="p-0">
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem className="flex items-center gap-1.5">
            <SidebarMenuButton
              tooltip="Dashboard"
              className={`${SIDEBAR_ITEM_BASE} min-w-0 flex-1 bg-transparent ${SIDEBAR_ITEM_ACTIVE} ${SIDEBAR_ITEM_ICON}`}
              isActive={currentPath === "/dashboard"}
              onClick={() => {
                router.push("/dashboard")
              }}
              onMouseEnter={() => setHoveredLink("__dashboard")}
              onMouseLeave={() => setHoveredLink((value) => (value === "__dashboard" ? null : value))}
            >
              <LayoutDashboard size={20} animation="path-loop" animate={hoveredLink === "__dashboard" ? "path-loop" : false} />
              <span className="min-w-0 flex-1 truncate text-left">Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="gap-0.5">
          {groupedItems.expandable.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                className={`${SIDEBAR_ITEM_BASE} ${SIDEBAR_ITEM_ACTIVE} ${SIDEBAR_ITEM_ICON}`}
                isActive={nodeContainsCurrentPath(item, currentPath)}
                onClick={() => {
                  if (item.items?.length) {
                    const isOpen = Boolean(openGroups[item.title])
                    // Toggle expand/collapse; first open also goes to default section URL.
                    setOpenGroups((previous) => ({
                      ...previous,
                      [item.title]: !isOpen,
                    }))
                    if (!isOpen && item.url && !nodeContainsCurrentPath(item, currentPath)) {
                      router.push(item.url)
                    }
                    return
                  }
                  if (item.url) {
                    router.push(item.url)
                  }
                }}
                onMouseEnter={() => setHoveredLink(item.title)}
                onMouseLeave={() => setHoveredLink((value) => (value === item.title ? null : value))}
              >
                {renderAnimatedIcon(item.icon, item.title)}
                <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
                {item.items ? (
                  <ChevronDownIcon
                    className={
                      openGroups[item.title]
                        ? "ml-auto size-3.5 shrink-0 transition-transform duration-300 rotate-180"
                        : "ml-auto size-3.5 shrink-0 transition-transform duration-300"
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
                    <SidebarMenuSub className="mx-1.5 space-y-1 border-l border-border/70 pl-2 pt-1">
                      {item.items.map((subItem) => renderNode(subItem, 0))}
                    </SidebarMenuSub>
                  </div>
                </div>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        {groupedItems.directLinks.length > 0 ? (
          <SidebarMenu className="gap-0.5 pt-1">
            {groupedItems.directLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                className={`${SIDEBAR_ITEM_BASE} ${SIDEBAR_ITEM_ACTIVE} ${SIDEBAR_ITEM_ICON}`}
                isActive={nodeContainsCurrentPath(item, currentPath)}
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
                <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
                {item.items ? (
                  <ChevronDownIcon
                    className={
                      openGroups[item.title]
                        ? "ml-auto size-3.5 shrink-0 transition-transform duration-300 rotate-180"
                        : "ml-auto size-3.5 shrink-0 transition-transform duration-300"
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
