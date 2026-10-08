"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertBadge16Regular,
  ArrowSync16Regular,
  CheckmarkCircle20Regular,
  FullScreenMaximize16Regular,
  FullScreenMinimize16Regular,
  Settings16Regular,
} from "@fluentui/react-icons"

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
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { useNotifications } from "@/lib/notifications-store"
import { cn } from "@/lib/utils"
import type { AuthScope } from "@/types"

const headerActionButtonClass =
  "relative z-10 !size-6 !min-w-6 !p-0 rounded-md bg-transparent text-foreground shadow-none hover:bg-muted hover:text-primary dark:bg-transparent dark:hover:bg-muted [&_svg]:!size-3.5"

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
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          headerActionButtonClass,
        )}
        aria-label="Open quick settings"
        title="Quick settings"
      >
        <Settings16Regular className="size-4 text-violet-600 dark:text-violet-400" />
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
            <ArrowSync16Regular className={cn("size-4 text-blue-600 dark:text-blue-400", loading && "animate-spin")} />
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
  const { isMobile, state: sidebarState } = useSidebar()
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null)
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
  const clockParts = currentTime
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).formatToParts(currentTime)
    : []
  const clockPart = (type: Intl.DateTimeFormatPartTypes) =>
    clockParts.find((part) => part.type === type)?.value
  const clockDate = currentTime?.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

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

  React.useEffect(() => {
    const updateClock = () => setCurrentTime(new Date())
    updateClock()
    const interval = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(interval)
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
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-2 px-2.5 transition-[padding] sm:gap-3 sm:px-3 lg:px-4",
          !isMobile && sidebarState === "collapsed" && "pl-12 sm:pl-12 lg:pl-12",
        )}
      >
        <HeaderGlobalSearch items={searchItems} />

        <SidebarTrigger
          className={cn(headerActionButtonClass, "md:!hidden")}
          aria-label="Open navigation"
          title="Navigation"
        />

        {scope !== "platform" ? (
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
            <DashboardAttendanceQuickActions />
          </div>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <div
            className="hidden h-9 shrink-0 items-center border-r border-border/70 px-2 text-foreground lg:inline-flex"
            aria-label={currentTime ? `Current time ${currentTime.toLocaleTimeString()}` : "Current local time"}
            title={currentTime ? currentTime.toLocaleDateString(undefined, { dateStyle: "full" }) : "Local time"}
          >
            <span className="grid gap-0.5 leading-none">
              <span className="flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                <time className="text-[13px] font-semibold tracking-tight" dateTime={currentTime?.toISOString()}>
                  {clockPart("hour") ?? "--"}:{clockPart("minute") ?? "--"}:{clockPart("second") ?? "--"}
                </time>
                {clockPart("dayPeriod") ? (
                  <span className="text-[9px] font-semibold uppercase text-muted-foreground">{clockPart("dayPeriod")}</span>
                ) : null}
              </span>
              <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">{clockDate ?? "Local time"}</span>
            </span>
          </div>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className={cn(headerActionButtonClass, "hidden sm:inline-flex")}
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <FullScreenMinimize16Regular className="size-4 text-sky-600 dark:text-sky-400" />
            ) : (
              <FullScreenMaximize16Regular className="size-4 text-sky-600 dark:text-sky-400" />
            )}
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
                  <AlertBadge16Regular className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="sr-only">Notifications</span>
                </DialogTrigger>
                {unreadNotificationCount > 0 ? (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 z-10 size-2 rounded-full bg-destructive ring-2 ring-background" />
                ) : null}
              </div>
              <DialogPopup
                from="right"
                showCloseButton
                className="notification-dialog flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5"
              >
                <DialogHeader className="mb-0 shrink-0 space-y-0 pr-10 pb-1">
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="flex items-center gap-2 text-base font-semibold">
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
                        <CheckmarkCircle20Regular className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        All caught up
                      </span>
                    ) : null}
                  </div>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <NotificationCenter open={notificationsOpen} onOpenChange={setNotificationsOpen} />
                </div>
                <DialogFooter className="shrink-0 border-t border-border pt-2">
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
