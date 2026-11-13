import * as React from "react"
import { cn } from "@/lib/utils"

export type PageStat = {
  label: string
  value: React.ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
}

const toneClass: Record<NonNullable<PageStat["tone"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  info: "text-sky-600 dark:text-sky-400",
}

/**
 * Shared header for list pages: title and description on the left, count
 * tiles and actions on the right. Stacks on phones, one row on wider screens.
 */
export function PageHeader({
  title,
  description,
  titleAddon,
  stats,
  actions,
  className,
  as: Heading = "h1",
}: {
  title: React.ReactNode
  description?: React.ReactNode
  titleAddon?: React.ReactNode
  stats?: PageStat[]
  actions?: React.ReactNode
  className?: string
  as?: "h1" | "h2" | "h3"
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <Heading className="truncate text-base font-semibold tracking-tight text-foreground">{title}</Heading>
          {titleAddon}
        </div>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {stats?.length || actions ? (
        <div className="flex flex-col gap-2 sm:items-end">
          {stats?.length ? (
            <div
              className="grid gap-2 sm:flex"
              style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
            >
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-20 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-center">
                  <div className={cn("text-lg font-semibold tabular-nums", toneClass[stat.tone ?? "default"])}>{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
