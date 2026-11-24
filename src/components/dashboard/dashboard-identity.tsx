"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { HomeDashboardKind } from "@/lib/dashboard-home"
import { cn } from "@/lib/utils"

export type DashboardIdentity = {
  name: string | null
  photoUrl: string | null
  rolesLabel: string | null
  homeDashboardKind?: HomeDashboardKind | null
}

const EMPTY_IDENTITY: DashboardIdentity = {
  name: null,
  photoUrl: null,
  rolesLabel: null,
}

const DashboardIdentityContext = React.createContext<DashboardIdentity>(EMPTY_IDENTITY)

export function DashboardIdentityProvider({
  value,
  children,
}: {
  value: DashboardIdentity
  children: React.ReactNode
}) {
  return (
    <DashboardIdentityContext.Provider value={value}>
      {children}
    </DashboardIdentityContext.Provider>
  )
}

export function useDashboardIdentity() {
  return React.useContext(DashboardIdentityContext)
}

function initialsFor(value: string | null) {
  const initials = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  return initials || "U"
}

export function DashboardIdentitySummary({
  className,
  compact = false,
  showName = true,
  tone = "onBrand",
}: {
  className?: string
  compact?: boolean
  showName?: boolean
  tone?: "onBrand" | "default"
}) {
  const identity = useDashboardIdentity()

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Avatar
        className={cn(
          tone === "default" ? "shrink-0 border-2 border-primary/15 bg-primary/10 shadow-sm" : "shrink-0 border-2 border-white/30 bg-white/15 shadow-sm",
          compact ? "size-10" : "size-12",
        )}
      >
        {identity.photoUrl ? (
          <AvatarImage src={identity.photoUrl} alt={identity.name || "Profile"} />
        ) : null}
        <AvatarFallback className={cn("text-sm font-semibold", tone === "default" ? "bg-primary/10 text-primary" : "bg-white/15 text-white")}>
          {initialsFor(identity.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        {showName && identity.name ? (
          <p className={cn("truncate text-sm font-semibold", tone === "default" ? "text-foreground" : "text-white")}>{identity.name}</p>
        ) : null}
        {identity.rolesLabel ? (
          <p className={cn("text-[10px] font-semibold uppercase leading-4 tracking-[0.15em]", tone === "default" ? "text-muted-foreground" : "text-white/75")}>
            {identity.rolesLabel}
          </p>
        ) : null}
      </div>
    </div>
  )
}
