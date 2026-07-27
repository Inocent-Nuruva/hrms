"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AccentColorPicker } from "@/components/accent-color-picker"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CheckCheck, RefreshCwIcon } from "lucide-react"
import { Bell } from "@/components/animate-ui/icons/bell"
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/animate-ui/components/base/dialog"
import { NotificationCenter } from "@/components/notification-center"
import { useNotifications } from "@/lib/notifications-store"

interface SiteHeaderProps {
  onRefresh: () => void | Promise<void>
  loading: boolean
  adminName: string | null
  companyName: string | null
}

export function SiteHeader({
  onRefresh,
  loading,
}: SiteHeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const {
    connectSocket,
    connected,
    loadNotifications,
    loadUnreadCount,
    socketConfigured,
    unreadCount: unreadNotificationCount,
  } = useNotifications()

  // Live = gateway accepted · Connecting = transport retrying · REST = list/poll only
  const liveDotClassName = connected
    ? "bg-emerald-500"
    : socketConfigured
      ? "bg-amber-500 animate-pulse"
      : "bg-slate-400"
  const liveStatusLabel = connected ? "Live" : socketConfigured ? "Connecting" : "REST only"

  React.useEffect(() => {
    void loadNotifications()
    void loadUnreadCount()
    connectSocket()
  }, [connectSocket, loadNotifications, loadUnreadCount])

  return (
    <header
      data-slot="site-header"
      className="site-header sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-1.5 border-b border-border/80 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) supports-[backdrop-filter]:backdrop-blur-md"
    >
      {/* Decorative depth — mirrors sidebar polish */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-10 top-1/2 h-24 w-40 -translate-y-1/2 rounded-full bg-primary/[0.08] blur-2xl dark:bg-primary/15" />
        <div className="absolute -right-8 top-0 h-20 w-32 rounded-full bg-primary/[0.06] blur-2xl dark:bg-primary/12" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
      </div>

      <div className="relative z-[1] flex w-full items-center gap-1.5 px-3 lg:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-3.5 data-vertical:self-auto bg-border/80" />

        <div className="ml-auto flex items-center gap-1.5">
          <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            {/* Badge sits outside the button so overflow-hidden doesn't clip it */}
            <div className="relative">
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={
                      unreadNotificationCount > 0
                        ? `Notifications, ${unreadNotificationCount} unread`
                        : "Notifications"
                    }
                    title="Notifications"
                  />
                }
              >
                <Bell size={18} animation="path-loop" animateOnHover="path-loop" />
                <span className="sr-only">Notifications</span>
              </DialogTrigger>
              {unreadNotificationCount > 0 ? (
                <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums !text-white shadow-sm ring-2 ring-background">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
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
                        className={`h-2 w-2 shrink-0 rounded-full ${liveDotClassName}`}
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
                      <CheckCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      All caught up
                    </span>
                  ) : null}
                </div>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <NotificationCenter
                  open={notificationsOpen}
                  onOpenChange={setNotificationsOpen}
                />
              </div>
              <DialogFooter className="shrink-0 border-t border-border pt-3">
                <DialogClose render={<Button variant="outline" size="sm">Close</Button>} />
              </DialogFooter>
            </DialogPopup>
          </Dialog>
          <ThemeTogglerButton
            variant="outline"
            size="icon-sm"
            direction="right"
            modes={["light", "dark"]}
          />
          <AccentColorPicker />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onRefresh()}
            disabled={loading}
            aria-label="Refresh page data"
            title="Refresh page data"
          >
            <RefreshCwIcon className={`text-primary ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </header>
  )
}
