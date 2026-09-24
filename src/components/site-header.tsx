"use client"

import * as React from "react"
import Link from "next/link"
import {
  BellIcon,
  CheckCheckIcon,
  ExpandIcon,
  MinimizeIcon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react"

import { AccentColorPicker } from "@/components/accent-color-picker"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
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
  DashboardAttendanceQuickActions,
  NetworkCheckButton,
} from "@/components/dashboard/dashboard-attendance-actions"
import { HeaderGlobalSearch, type HeaderSearchItem } from "@/components/header-global-search"
import { HeaderUserMenu } from "@/components/nav-user"
import { NotificationCenter } from "@/components/notification-center"
import { Button, buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useNotifications } from "@/lib/notifications-store"
import { cn } from "@/lib/utils"
import type { AuthScope } from "@/types"

const headerActionButtonClass =
  "relative z-10 rounded-lg bg-transparent text-foreground shadow-none hover:bg-muted hover:text-primary dark:bg-transparent dark:hover:bg-muted"

interface SiteHeaderProps {
  onRefresh: () => void | Promise<void>
  loading: boolean
  adminName: string | null
  adminEmail?: string | null
  adminAvatar?: string | null
  companyName: string | null
  scope?: AuthScope | null
  searchItems?: HeaderSearchItem[]
}

function QuickSettingsMenu({
  onRefresh,
  loading,
}: Pick<SiteHeaderProps, "onRefresh" | "loading">) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "relative rounded-lg border-border bg-muted/45 text-foreground shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
        )}
        aria-label="Open quick settings"
        title="Quick settings"
      >
        <Settings2Icon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Quick settings</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Appearance and page controls</p>
          </div>
          <Link href="/dashboard/settings" className="text-[10px] font-semibold text-primary hover:underline">
            All settings
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-1 rounded-lg border border-border bg-muted/25 p-1">
          <ThemeTogglerButton
            variant="ghost"
            size="icon-sm"
            direction="right"
            modes={["light", "dark"]}
            className={headerActionButtonClass}
          />
          <AccentColorPicker className={headerActionButtonClass} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              void Promise.resolve(onRefresh()).finally(() => window.location.reload())
            }}
            disabled={loading}
            aria-label="Refresh page data"
            title="Refresh page data"
            className={headerActionButtonClass}
          >
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SiteHeader({
  onRefresh,
  loading,
  adminName,
  adminEmail = null,
  adminAvatar = null,
  companyName,
  scope = null,
  searchItems = [],
}: SiteHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  const {
    connectSocket,
    connected,
    loadNotifications,
    loadUnreadCount,
    socketConfigured,
    unreadCount: unreadNotificationCount,
  } = useNotifications()

  const liveDotClassName = connected
    ? "bg-emerald-500"
    : socketConfigured
      ? "bg-amber-500 animate-pulse"
      : "bg-slate-400"
  const liveStatusLabel = connected ? "Live" : socketConfigured ? "Connecting" : "REST only"

  React.useEffect(() => {
    if (scope === "platform") return
    void loadNotifications()
    void loadUnreadCount()
    connectSocket()
  }, [connectSocket, loadNotifications, loadUnreadCount, scope])

  React.useEffect(() => {
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement))
    updateFullscreen()
    document.addEventListener("fullscreenchange", updateFullscreen)
    return () => document.removeEventListener("fullscreenchange", updateFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
  }

  return (
    <header
      data-slot="site-header"
      className="site-header sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center border-b border-border bg-card transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
    >
      <div className="flex w-full min-w-0 items-center gap-1.5 px-2.5 sm:px-3 lg:px-4">
        <HeaderGlobalSearch items={searchItems} />

        <SidebarTrigger
          className={headerActionButtonClass}
          aria-label="Open navigation"
          title="Navigation"
        />

        {scope !== "platform" ? (
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
            <DashboardAttendanceQuickActions />
          </div>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(headerActionButtonClass, "hidden sm:inline-flex")}
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <MinimizeIcon className="size-4" /> : <ExpandIcon className="size-4" />}
          </Button>

          <QuickSettingsMenu onRefresh={onRefresh} loading={loading} />

          {scope !== "platform" ? <NetworkCheckButton iconOnly className={headerActionButtonClass} /> : null}

          {scope !== "platform" ? (
            <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <div className="relative">
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className={headerActionButtonClass}
                      aria-label={unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"}
                      title="Notifications"
                    />
                  }
                >
                  <BellIcon className="size-4" />
                  <span className="sr-only">Notifications</span>
                </DialogTrigger>
                {unreadNotificationCount > 0 ? (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 z-10 size-2 rounded-full bg-destructive ring-2 ring-background" />
                ) : null}
              </div>
              <DialogPopup
                from="right"
                showCloseButton
                className="flex h-[min(92vh,880px)] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden p-4 sm:w-[min(48rem,calc(100%-2rem))] sm:p-5 lg:w-[min(52rem,calc(100%-2rem))]"
              >
                <DialogHeader className="mb-0 shrink-0 space-y-0 pr-10 pb-1">
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="flex items-center gap-2 text-lg">
                        <span
                          className={cn("size-2 shrink-0 rounded-full", liveDotClassName)}
                          title={liveStatusLabel}
                          aria-label={liveStatusLabel}
                        />
                        Notifications
                      </DialogTitle>
                      {unreadNotificationCount > 0 ? (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums !text-white">
                          {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount} unread
                        </span>
                      ) : null}
                    </div>
                    {unreadNotificationCount === 0 ? (
                      <span className="inline-flex items-center gap-1 pl-4 text-xs font-medium tracking-wide text-emerald-600 dark:text-emerald-400">
                        <CheckCheckIcon className="size-3.5 shrink-0" aria-hidden />
                        All caught up
                      </span>
                    ) : null}
                  </div>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <NotificationCenter open={notificationsOpen} onOpenChange={setNotificationsOpen} />
                </div>
                <DialogFooter className="shrink-0 border-t border-border pt-3">
                  <DialogClose render={<Button variant="outline" size="sm">Close</Button>} />
                </DialogFooter>
              </DialogPopup>
            </Dialog>
          ) : null}

          <HeaderUserMenu
            accountHref={scope === "platform" ? "/dashboard/settings" : "/dashboard/me/profile"}
            user={{
              name: adminName || "User",
              email: adminEmail || companyName || "",
              avatar: adminAvatar || "",
            }}
          />
        </div>
      </div>
    </header>
  )
}
