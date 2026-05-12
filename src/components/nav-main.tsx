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
import { BellIcon, ChevronDownIcon, LayoutDashboardIcon } from "lucide-react"

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
  const router = useRouter()
  const pathname = usePathname()
  const currentPath = pathname ?? ""
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      items
        .filter((item): item is Extract<NavMainItem, { items: NavMainSubItem[] }> => Boolean(item.items))
        .map((item) => [
          item.title,
          item.items.some((subItem) => currentPath.startsWith(subItem.url)),
        ])
    )
  )

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

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Dashboard"
              className="min-w-8 bg-[#303194] text-white duration-200 ease-linear hover:bg-[#252882] hover:text-white active:bg-[#252882] active:text-white dark:bg-[#7f8ce3] dark:text-[#101433] dark:hover:bg-[#a3afff] dark:active:bg-[#a3afff]"
              onClick={() => {
                router.push("/dashboard")
              }}
            >
              <LayoutDashboardIcon />
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
                <BellIcon />
                <span className="sr-only">Notifications</span>
              </DialogTrigger>
              <DialogPopup from="right" showCloseButton className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Notifications</DialogTitle>
                </DialogHeader>

                <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/25 p-6 text-center">
                  <div className="rounded-full bg-muted p-3">
                    <BellIcon className="size-5 text-muted-foreground" />
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
                className="cursor-pointer"
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
              >
                {item.icon}
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
                            className="cursor-pointer"
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
