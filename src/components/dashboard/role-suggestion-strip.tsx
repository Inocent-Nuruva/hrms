"use client"

import {
  Briefcase20Regular,
  People20Regular,
  PeopleTeam20Regular,
  Sparkle16Regular,
} from "@fluentui/react-icons"

import type { ResolvedRoleSuggestion } from "@/components/dashboard/role-suggestions"
import { cn } from "@/lib/utils"

const ICONS: Record<string, typeof People20Regular> = {
  employee: People20Regular,
  "hr-manager": PeopleTeam20Regular,
  "hr-officer": Briefcase20Regular,
  "sales-representative": Briefcase20Regular,
  "sales-manager": PeopleTeam20Regular,
  "department-manager": PeopleTeam20Regular,
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
        "px-0 py-0",
        className,
      )}
    >
      <div className="mb-2.5 flex items-start gap-2">
        <Sparkle16Regular className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Suggested roles</p>
          <p className="text-xs text-muted-foreground">
            Skip the full permission list. Open a starter, review what it can do, then create it.
          </p>
        </div>
      </div>
      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-3">
        {suggestions.map((suggestion) => {
          const Icon = ICONS[suggestion.id] ?? Briefcase20Regular
          return (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onUse(suggestion)}
              className="flex min-w-0 items-start gap-3 px-2 py-2.5 text-left transition hover:bg-muted/40 sm:px-3"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center text-blue-600 dark:text-blue-400">
                <Icon className="size-5" />
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
