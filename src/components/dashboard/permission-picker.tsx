"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, InfoIcon, Loader2Icon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AdminRecord } from "@/lib/admin-api"

export type PermissionOption = {
  id: string
  name: string
  label: string
  description?: string
  group: string
}

function prettifyGroup(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

export function permissionGroupFromName(name: string) {
  const normalized = name.trim()
  if (!normalized) return "General"
  if (normalized.includes(":")) {
    return prettifyGroup(normalized.split(":")[0] ?? "general")
  }
  if (normalized.includes(".")) {
    return prettifyGroup(normalized.split(".")[0] ?? "general")
  }
  return "General"
}

function readPermissionString(permission: AdminRecord, keys: string[]): string {
  for (const key of keys) {
    const value = permission[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

export function toPermissionOptions(permissions: AdminRecord[]): PermissionOption[] {
  const options: PermissionOption[] = []
  for (const permission of permissions) {
    const idRaw = permission.id
    const id =
      typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw) : ""
    const name =
      readPermissionString(permission, ["name", "key", "code", "display_name", "displayName"])
    if (!id || !name) continue
    const label =
      readPermissionString(permission, ["display_name", "displayName", "name"]) || name
    const description = readPermissionString(permission, ["description"])
    options.push({
      id,
      name,
      label,
      description: description || undefined,
      group: permissionGroupFromName(name),
    })
  }
  return options.sort(
    (a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)
  )
}

export function PermissionPicker({
  options,
  selectedNames,
  onChange,
  onQueryChange,
  className,
  compact = false,
  loading = false,
}: {
  options: PermissionOption[]
  selectedNames: string[]
  onChange: (next: string[]) => void
  onQueryChange?: (query: string) => void
  className?: string
  compact?: boolean
  loading?: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})
  const selectedSet = React.useMemo(() => new Set(selectedNames), [selectedNames])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const haystack =
        `${option.name} ${option.label} ${option.description ?? ""} ${option.group}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [options, query])

  const grouped = React.useMemo(() => {
    const map = new Map<string, PermissionOption[]>()
    for (const option of filtered) {
      const list = map.get(option.group) ?? []
      list.push(option)
      map.set(option.group, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // Auto-expand groups that match the search query.
  React.useEffect(() => {
    if (!query.trim()) return
    const next: Record<string, boolean> = {}
    for (const [group] of grouped) next[group] = true
    setOpenGroups((prev) => ({ ...prev, ...next }))
  }, [grouped, query])

  const toggle = (name: string) => {
    if (selectedSet.has(name)) {
      onChange(selectedNames.filter((entry) => entry !== name))
      return
    }
    onChange([...selectedNames, name])
  }

  const toggleGroup = (groupOptions: PermissionOption[], selectAll: boolean) => {
    const names = groupOptions.map((option) => option.name)
    if (selectAll) {
      onChange(Array.from(new Set([...selectedNames, ...names])))
      return
    }
    const remove = new Set(names)
    onChange(selectedNames.filter((name) => !remove.has(name)))
  }

  const selectedPct =
    options.length > 0 ? Math.round((selectedNames.length / options.length) * 100) : 0

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div
        className={cn(
          "shrink-0 space-y-2",
          compact ? "" : "rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2.5",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex items-center gap-2">
              <div
                className="relative size-9 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(var(--primary) ${selectedPct}%, hsl(var(--muted)) 0)`,
                }}
                title={`${selectedPct}% of catalog`}
              >
                <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-background text-[10px] font-semibold tabular-nums text-foreground">
                  {selectedPct}%
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {selectedNames.length}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    / {options.length}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">permissions selected</p>
              </div>
            </div>
          )}
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted"
              onClick={() => onChange(options.map((option) => option.name))}
            >
              Select all
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-muted"
              onClick={() => onChange([])}
            >
              Deselect all
            </button>
          </div>
        </div>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-primary" />
          <Input
            value={query}
            onChange={(event) => {
              const next = event.target.value
              setQuery(next)
              onQueryChange?.(next)
            }}
            placeholder="Search permissions…"
            className="h-8 border-slate-300 bg-white pl-8 text-xs dark:border-border dark:bg-background"
          />
        </div>
      </div>

      {/* Single scroll region — no nested group scrollbars */}
      <div
        className={cn(
          "min-h-0 space-y-1 overflow-y-auto overscroll-contain pr-0.5",
          compact ? "min-h-40 max-h-64" : "flex-1",
        )}
      >
        {loading && options.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Loader2Icon className="size-5 animate-spin text-primary" />
            <p className="text-xs text-slate-500">Loading permissions…</p>
          </div>
        ) : grouped.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">
            No permissions match your search.
          </p>
        ) : (
          grouped.map(([group, groupOptions]) => {
            const selectedInGroup = groupOptions.filter((option) =>
              selectedSet.has(option.name)
            ).length
            const allSelected = selectedInGroup === groupOptions.length && groupOptions.length > 0
            const isOpen = openGroups[group] ?? (compact || selectedInGroup > 0)

            return (
              <section
                key={group}
                className={cn(
                  "overflow-hidden rounded-md border bg-card",
                  selectedInGroup > 0 ? "border-primary/30" : "border-slate-200 dark:border-border"
                )}
              >
                <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/80 dark:border-border dark:bg-muted/20">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left"
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [group]: !isOpen }))
                    }
                  >
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 shrink-0 text-slate-400 transition-transform",
                        !isOpen && "-rotate-90"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
                      {group}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                      {selectedInGroup}/{groupOptions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "shrink-0 px-2 py-1.5 text-[10px] font-medium",
                      allSelected ? "text-primary" : "text-slate-500 hover:text-slate-800"
                    )}
                    onClick={() => toggleGroup(groupOptions, !allSelected)}
                  >
                    {allSelected ? "Deselect" : "All"}
                  </button>
                </div>

                {isOpen ? (
                  <ul>
                    {groupOptions.map((option) => {
                      const checked = selectedSet.has(option.name)
                      return (
                        <li key={option.name}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 px-2 py-1",
                              checked ? "bg-primary/[0.06]" : "hover:bg-slate-50 dark:hover:bg-muted/40"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                                checked
                                  ? "border-primary bg-primary text-white"
                                  : "border-slate-300 bg-white dark:border-border dark:bg-background"
                              )}
                            >
                              {checked ? <CheckIcon className="size-2.5" strokeWidth={3} /> : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-900 dark:text-foreground">
                              {option.label}
                            </span>
                            <span className="hidden max-w-[9rem] shrink-0 truncate font-mono text-[10px] text-slate-400 sm:block">
                              {option.name}
                            </span>
                            {option.description ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-primary"
                                      aria-label={`What ${option.label} does`}
                                      onClick={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                      }}
                                    />
                                  }
                                >
                                  <InfoIcon className="size-3" />
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
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggle(option.name)}
                              aria-label={option.label}
                            />
                          </label>
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
