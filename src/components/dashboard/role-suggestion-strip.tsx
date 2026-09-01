"use client"

import { BriefcaseIcon, SparklesIcon, UsersIcon } from "lucide-react"

import type { ResolvedRoleSuggestion } from "@/components/dashboard/role-suggestions"
import { cn } from "@/lib/utils"

const ICONS: Record<string, typeof UsersIcon> = {
  employee: UsersIcon,
  "hr-manager": BriefcaseIcon,
  "hr-officer": BriefcaseIcon,
  "sales-representative": BriefcaseIcon,
  "sales-manager": BriefcaseIcon,
  "department-manager": UsersIcon,
}

export function RoleSuggestionStrip({
  suggestions,
  onUse,
  className,
}: {
  suggestions: ResolvedRoleSuggestion[]
  onUse: (suggestion: ResolvedRoleSuggestion) => void
  className?: string
}) {
  if (suggestions.length === 0) return null

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div className="mb-2.5 flex items-start gap-2">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Suggested roles</p>
          <p className="text-xs text-muted-foreground">
            Skip the full permission list. Open a starter, review what it can do, then create it.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((suggestion) => {
          const Icon = ICONS[suggestion.id] ?? BriefcaseIcon
          return (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onUse(suggestion)}
              className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {suggestion.displayName}
                  </span>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {suggestion.permissionNames.length || "…"} perms
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {suggestion.description}
                </span>
                <span className="mt-1 inline-flex text-[11px] font-medium text-primary">
                  Review and create
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
