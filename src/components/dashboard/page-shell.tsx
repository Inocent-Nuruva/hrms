"use client"

import * as React from "react"

import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

/**
 * Shared page layout for HR workspaces (registration, invite, onboarding,
 * contracts, salary approvals, recruitment): breathing room below the
 * section menu and one card holding the header, optional tabs and content.
 *
 * `embedded` drops the outer spacing and card so a page can sit inside
 * another page's shell (e.g. Invite inside Recruitment) without nesting cards.
 */
/**
 * The layout standard for HR workspace pages. One width, one spacing scale,
 * so every page in the section lines up exactly:
 * - card: max 80rem wide, centred, 2px-radius bordered card
 * - space below the section menu: 16px (phone) / 24px (tablet and up)
 * - space below the card: 24px (phone/tablet) / 40px (desktop)
 * - horizontal content padding: 16px (phone) / 24px (tablet and up)
 */
export const PAGE_SHELL_WIDTH = "max-w-7xl"

export function PageShell({
  children,
  embedded = false,
  className,
}: {
  children: React.ReactNode
  embedded?: boolean
  className?: string
}) {
  if (embedded) {
    return <div className={cn("flex min-w-0 flex-col", className)}>{children}</div>
  }
  return (
    <div className={cn("mx-auto w-full min-w-0 pt-4 pb-6 sm:pt-6 lg:pb-10", PAGE_SHELL_WIDTH)}>
      <section className={cn("flex min-w-0 flex-col rounded-[var(--hrms-control-radius)] border border-border bg-card", className)}>
        {children}
      </section>
    </div>
  )
}

/** Title, description, optional stats and actions; sits at the top of the shell. */
export function PageShellHeader({
  title,
  description,
  stats,
  actions,
  hidden,
  withTabs = false,
  as,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  stats?: React.ComponentProps<typeof PageHeader>["stats"]
  actions?: React.ReactNode
  hidden?: boolean
  /** Tabs follow directly below: no bottom rule here (the tab row draws it). */
  withTabs?: boolean
  as?: React.ComponentProps<typeof PageHeader>["as"]
}) {
  return (
    <div hidden={hidden} className={cn("px-4 pt-4 sm:px-6", withTabs ? "pb-0" : "border-b border-border pb-4")}>
      <PageHeader className="min-w-0" title={title} description={description} stats={stats} actions={actions} as={as} />
    </div>
  )
}

export type PageShellTab<T extends string> = {
  id: T
  label: string
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
  /** Shown as a small count pill after the label. */
  count?: number
}

/** Underline tabs with arrow-key navigation, the same on every HR page. */
export function PageShellTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  idPrefix,
  hidden,
}: {
  tabs: ReadonlyArray<PageShellTab<T>>
  active: T
  onChange: (id: T) => void
  ariaLabel: string
  /** Unique per page, used for tab/panel ids. */
  idPrefix: string
  hidden?: boolean
}) {
  return (
    <div
      hidden={hidden}
      role="tablist"
      aria-label={ariaLabel}
      className="mt-3 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:px-6"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === active
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
              event.preventDefault()
              const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]
              onChange(next.id)
              document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus()
            }}
            className={cn(
              "-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              selected
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Content area of the shell; `flush` removes padding for edge-to-edge tables. */
export function PageShellBody({
  children,
  flush = false,
  idPrefix,
  tabId,
  className,
}: {
  children: React.ReactNode
  flush?: boolean
  /** With tabs: the same prefix as PageShellTabs, for the tabpanel link. */
  idPrefix?: string
  tabId?: string
  className?: string
}) {
  return (
    <div
      role={idPrefix ? "tabpanel" : undefined}
      id={idPrefix ? `${idPrefix}-panel` : undefined}
      aria-labelledby={idPrefix && tabId ? `${idPrefix}-tab-${tabId}` : undefined}
      className={cn("min-w-0", !flush && "px-4 py-5 sm:px-6 sm:py-6", className)}
    >
      {children}
    </div>
  )
}
