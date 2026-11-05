"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertBadge16Regular,
  ArrowSync16Regular,
  FullScreenMaximize16Regular,
  FullScreenMinimize16Regular,
  Settings16Regular,
} from "@fluentui/react-icons"

import { AccentColorPicker } from "@/components/accent-color-picker"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import {
  Dialog,
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
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { useNotifications } from "@/lib/notifications-store"
import { cn } from "@/lib/utils"
import type { AuthScope } from "@/types"

const headerActionButtonClass =
  "relative z-10 !size-10 !min-w-10 !p-0 rounded-md bg-transparent text-foreground shadow-none hover:bg-muted hover:text-primary dark:bg-transparent dark:hover:bg-muted [&_svg]:!size-5"
const notificationButtonClass =
  "relative z-10 !size-11 !min-w-11 !p-0 rounded-md bg-transparent text-foreground shadow-none hover:bg-muted hover:text-primary dark:bg-transparent dark:hover:bg-muted [&_svg]:!size-6"

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

function HeaderPageControls({
  onRefresh,
  loading,
}: Pick<SiteHeaderProps, "onRefresh" | "loading">) {
  return (
    <>
      <ThemeTogglerButton
        variant="ghost"
        size="icon-sm"
        direction="right"
        modes={["light", "dark"]}
        className={cn(headerActionButtonClass, "hidden sm:inline-flex")}
      />
      <AccentColorPicker className={cn(headerActionButtonClass, "hidden sm:inline-flex")} />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => void Promise.resolve(onRefresh())}
        disabled={loading}
        aria-label="Refresh page data"
        title="Refresh page data"
        className={cn(headerActionButtonClass, "hidden sm:inline-flex")}
      >
        <ArrowSync16Regular className={cn("size-4 text-blue-600 dark:text-blue-400", loading && "animate-spin")} />
      </Button>
      <Link
        href="/dashboard/settings"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          headerActionButtonClass,
        )}
        aria-label="Open settings"
        title="Settings"
      >
        <Settings16Regular className="size-4 text-violet-600 dark:text-violet-400" />
      </Link>
    </>
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
    loadNotifications,
    loadUnreadCount,
    unreadCount: unreadNotificationCount,
  } = useNotifications()

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
      className="site-header sticky top-0 z-50 flex h-auto shrink-0 flex-col border-b border-border bg-card transition-[width,height] ease-linear md:min-h-(--header-height) md:flex-row md:items-center group-has-data-[collapsible=icon]/sidebar-wrapper:md:min-h-(--header-height)"
    >
      <div
        className={cn(
          "flex min-h-(--header-height) w-full min-w-0 items-center gap-2 px-2.5 transition-[padding] sm:gap-3 sm:px-3 lg:px-4",
          !isMobile && sidebarState === "collapsed" && "pl-12 sm:pl-12 lg:pl-12",
        )}
      >
        <HeaderGlobalSearch items={searchItems} />

        <SidebarTrigger
          className={cn(headerActionButtonClass, "md:!hidden")}
          aria-label="Open navigation"
          title="Navigation"
        />

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
          {scope !== "platform" ? (
            <div className="hidden shrink-0 md:block">
              <DashboardAttendanceQuickActions />
            </div>
          ) : null}
          <div
            className="hidden h-11 shrink-0 items-center border-r border-border/70 px-3 text-foreground lg:inline-flex"
            aria-label={currentTime ? `Current time ${currentTime.toLocaleTimeString()}` : "Current local time"}
            title={currentTime ? currentTime.toLocaleDateString(undefined, { dateStyle: "full" }) : "Local time"}
          >
            <span className="grid gap-0.5 leading-none">
              <span className="flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                <time className="text-base font-semibold tracking-tight" dateTime={currentTime?.toISOString()}>
                  {clockPart("hour") ?? "--"}:{clockPart("minute") ?? "--"}:{clockPart("second") ?? "--"}
                </time>
                {clockPart("dayPeriod") ? (
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">{clockPart("dayPeriod")}</span>
                ) : null}
              </span>
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">{clockDate ?? "Local time"}</span>
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

          <HeaderPageControls onRefresh={onRefresh} loading={loading} />

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
                      className={notificationButtonClass}
                      aria-label={unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"}
                      title="Notifications"
                    />
                  }
                >
                  <AlertBadge16Regular className="size-5 text-amber-600 dark:text-amber-400" />
                  <span className="sr-only">Notifications</span>
                </DialogTrigger>
                {unreadNotificationCount > 0 ? (
                  <span className="pointer-events-none absolute -right-1 -top-1 z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold leading-none tabular-nums text-white ring-2 ring-background">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
              </div>
              <DialogPopup
                from="right"
                showCloseButton={false}
                bodyClassName="!h-full !max-h-none !gap-0 !overflow-hidden"
                className="notification-dialog flex h-dvh min-h-0 w-[min(34rem,calc(100vw-1rem))] max-w-[34rem] flex-col overflow-hidden p-4 sm:p-5"
              >
                <DialogHeader className="mb-0 shrink-0 space-y-0 pr-40 pb-1">
                  <div className="flex min-h-12 items-center border-b border-border/70 px-1 py-2">
                    <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                      Notifications
                    </DialogTitle>
                  </div>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <NotificationCenter open={notificationsOpen} onOpenChange={setNotificationsOpen} />
                </div>
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
      {scope !== "platform" ? (
        <div className="flex w-full items-center justify-center border-t border-border/60 px-2.5 py-2 md:hidden">
          <DashboardAttendanceQuickActions mobile />
        </div>
      ) : null}
    </header>
  )
}
