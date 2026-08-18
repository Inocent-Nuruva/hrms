"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { HeroBand, TalentDoodleSprites } from "@/components/dashboard/talent-visuals"
import { useCanSeePage } from "@/hooks/use-forbidden-route-guard"
import { useDashboardMotion } from "@/lib/dashboard-motion"

const SHORTCUTS = [
  { keys: "Ctrl K", label: "Open global search" },
  { keys: "↑ ↓", label: "Move through search results" },
  { keys: "Enter", label: "Open the selected search result" },
]

const DESTINATIONS = [
  { title: "My profile", url: "/dashboard/me/profile", hint: "Name, photo, and contact details" },
  { title: "My attendance", url: "/dashboard/attendance/today", hint: "Today’s state and punch history" },
  { title: "My leave", url: "/dashboard/me/leave/requests", hint: "Requests, balances, and holidays" },
  { title: "Settings", url: "/dashboard/settings", hint: "Password, 2FA, and devices" },
  { title: "Reports", url: "/dashboard/operations/reports", hint: "Attendance downloads and analytics jobs" },
  { title: "Employee numbering", url: "/dashboard/structure/numbering", hint: "Prefix and next employee number" },
]

export function HelpView() {
  const motionPreset = useDashboardMotion()

  return (
    <motion.section className="space-y-8" variants={motionPreset.container} initial="hidden" animate="show">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="Help"
        title="How to get around"
        description="Search, shortcuts, and the pages you can open with your current grants. Microsoft 365 SSO is specified but not live on this instance yet."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Keyboard</h2>
          <ul className="divide-y divide-border/80">
            {SHORTCUTS.map((item) => (
              <li key={item.keys} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <kbd className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                  {item.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Sign-in</h2>
          <p className="text-sm text-muted-foreground">
            Use work email and password. Two-factor follows if your account requires it.
            Microsoft SSO (`POST /api/auth/sso/microsoft`) is not enabled on the backend yet — see
            the internal SSO setup note when IT turns it on.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Pages you can open</h2>
        <ul className="divide-y divide-border/80">
          {DESTINATIONS.map((item) => (
            <HelpLink key={item.url} {...item} />
          ))}
        </ul>
      </div>
    </motion.section>
  )
}

function HelpLink({ title, url, hint }: { title: string; url: string; hint: string }) {
  const allowed = useCanSeePage(url)
  if (!allowed) return null
  return (
    <li className="py-2.5">
      <Link href={url} className="group flex flex-col gap-0.5">
        <span className="text-sm font-medium text-primary group-hover:underline">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </Link>
    </li>
  )
}
