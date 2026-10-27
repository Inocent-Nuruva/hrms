"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import * as React from "react"
import {
  Badge,
  Button,
  Checkbox,
  ProgressBar,
  Switch,
} from "@fluentui/react-components"
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  Info16Regular,
} from "@fluentui/react-icons"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  filterPermissionOptions,
  isPermissionSelected,
  permissionAliases,
  togglePermissionSelection,
  type PermissionOption,
} from "@/components/dashboard/permission-selection"

export type { PermissionOption } from "@/components/dashboard/permission-selection"
export {
  canonicalizePermissionNames,
  filterPermissionOptions,
  isPermissionSelected,
  permissionAliases,
  permissionGroupFromName,
  permissionTokenFromAssignment,
  toPermissionOptions,
  togglePermissionSelection,
} from "@/components/dashboard/permission-selection"

export function PermissionPicker({
  options,
  selectedNames,
  onChange,
  onQueryChange,
  className,
  compact = false,
  loading = false,
  reviewSelected = false,
}: {
  options: PermissionOption[]
  selectedNames: string[]
  onChange: (next: string[]) => void
  onQueryChange?: (query: string) => void
  className?: string
  compact?: boolean
  loading?: boolean
  reviewSelected?: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [enabledOnly, setEnabledOnly] = React.useState(reviewSelected)

  React.useEffect(() => {
    setEnabledOnly(reviewSelected)
  }, [reviewSelected])
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const selectedSet = React.useMemo(() => new Set(selectedNames), [selectedNames])

  const filtered = React.useMemo(
    () => filterPermissionOptions(options, selectedSet, query, enabledOnly),
    [enabledOnly, options, query, selectedSet],
  )

  const grouped = React.useMemo(() => {
    const map = new Map<string, PermissionOption[]>()
    for (const option of filtered) {
      const list = map.get(option.group) ?? []
      list.push(option)
      map.set(option.group, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // Auto-expand groups that match the search query or the enabled-only filter.
  React.useEffect(() => {
    if (!query.trim() && !enabledOnly) return
    const next: Record<string, boolean> = {}
    for (const [group] of grouped) next[group] = true
    setOpenGroups((prev) => ({ ...prev, ...next }))
  }, [enabledOnly, grouped, query])

  const toggle = (option: PermissionOption) => {
    onChange(togglePermissionSelection(option, selectedNames))
  }

  const toggleGroup = (groupOptions: PermissionOption[], selectAll: boolean) => {
    const aliases = new Set(groupOptions.flatMap((option) => permissionAliases(option)))
    const names = groupOptions.map((option) => option.name)
    if (selectAll) {
      onChange(Array.from(new Set([
        ...selectedNames.filter((name) => !aliases.has(name)),
        ...names,
      ])))
      return
    }
    onChange(selectedNames.filter((name) => !aliases.has(name)))
  }

  const selectedPct =
    options.length > 0 ? Math.round((selectedNames.length / options.length) * 100) : 0

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className={cn("shrink-0", compact ? "space-y-2" : "overflow-hidden border-b border-border bg-card")}>
        <div className={cn("flex flex-wrap items-center justify-between gap-3", compact ? "" : "px-4 py-3")}>
          {compact ? (
            <p className="text-xs tabular-nums text-slate-500">
              {loading && options.length === 0 ? (
                "Loading…"
              ) : (
                <>
                  <span className="font-medium text-slate-900">{selectedNames.length}</span>
                  {" / "}
                  {options.length}
                  {selectedPct > 0 ? ` · ${selectedPct}%` : ""}
                </>
              )}
            </p>
          ) : (
            <div className="min-w-[15rem] flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge appearance="filled" color="brand" size="medium">
                  {selectedPct}%
                </Badge>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {selectedNames.length} of {options.length} permissions enabled
                </p>
              </div>
              <ProgressBar value={selectedPct / 100} thickness="medium" aria-label={`${selectedPct}% of permissions enabled`} />
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Switch
              checked={enabledOnly}
              label="Enabled only"
              onChange={(_event, data) => setEnabledOnly(data.checked)}
            />
            <Button appearance="secondary" size="small" onClick={() => onChange(options.map((option) => option.name))}>
              Select all
            </Button>
            <Button appearance="subtle" size="small" onClick={() => onChange([])}>
              Deselect all
            </Button>
          </div>
        </div>

        <div className={cn(compact ? "" : "border-t border-border px-4 py-3")}>
          <FluentSearchBox
            size="medium"
            aria-label="Search permissions"
            value={query}
            onChange={(_event, data) => {
              const next = data.value
              setQuery(next)
              onQueryChange?.(next)
            }}
            placeholder="Search permissions…"
            className="w-full max-w-xl"
          />
        </div>
      </div>

      {/* Single scroll region — no nested group scrollbars */}
      <div
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain border-b border-border bg-card",
          compact ? "min-h-40 max-h-64" : "flex-1",
        )}
      >
        {loading && options.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <FluentLoadingIndicator className="size-5 animate-spin text-primary" />
            <p className="text-xs text-slate-500">Loading permissions…</p>
          </div>
        ) : grouped.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">
            {enabledOnly && !query.trim()
              ? "No enabled permissions yet."
              : "No permissions match your search."}
          </p>
        ) : (
          grouped.map(([group, groupOptions]) => {
            const selectedInGroup = groupOptions.filter((option) =>
              isPermissionSelected(option, selectedSet)
            ).length
            const allSelected = selectedInGroup === groupOptions.length && groupOptions.length > 0
            const isOpen = openGroups[group] ?? (compact || selectedInGroup > 0)

            return (
              <section key={group} className="border-b border-border last:border-b-0">
                <div className={cn("flex items-center gap-2", isOpen ? "bg-muted/35" : "hover:bg-muted/25")}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [group]: !isOpen }))
                    }
                  >
                    {isOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {group}
                    </span>
                    <Badge appearance="tint" color={selectedInGroup > 0 ? "brand" : "subtle"} size="small">
                      {selectedInGroup} / {groupOptions.length}
                    </Badge>
                  </button>
                  <Checkbox
                    className="mr-2"
                    aria-label={`${allSelected ? "Deselect" : "Select"} all ${group} permissions`}
                    checked={allSelected ? true : selectedInGroup > 0 ? "mixed" : false}
                    onChange={() => toggleGroup(groupOptions, !allSelected)}
                  />
                </div>

                {isOpen ? (
                  <ul className="divide-y divide-border/70">
                    {groupOptions.map((option) => {
                      const checked = isPermissionSelected(option, selectedSet)
                      return (
                        <li key={option.name} className={cn("flex items-center gap-2 px-3 py-2", checked && "bg-primary/[0.04]")}>
                          <Checkbox
                            checked={checked}
                            aria-label={option.label}
                            onChange={() => toggle(option)}
                          />
                          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggle(option)}>
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                              {option.label}
                            </span>
                            <span className="hidden max-w-[14rem] shrink-0 truncate font-mono text-xs text-muted-foreground lg:block">
                              {option.name}
                            </span>
                          </button>
                          {option.description ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-primary"
                                    aria-label={`What ${option.label} does`}
                                  />
                                }
                              >
                                <Info16Regular />
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="end"
                                className="max-w-64 text-left text-xs leading-relaxed"
                              >
                                {option.description}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
