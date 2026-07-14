"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
  className,
}: {
  options: PermissionOption[]
  selectedNames: string[]
  onChange: (next: string[]) => void
  className?: string
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

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedNames.length}</span> selected
          <span className="mx-1 text-border">·</span>
          {options.length} in catalog
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5"
            onClick={() => onChange(options.map((option) => option.name))}
          >
            Select all
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or key…"
        className="h-9"
      />

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {grouped.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No permissions match your search.
          </p>
        ) : (
          grouped.map(([group, groupOptions]) => {
            const selectedInGroup = groupOptions.filter((option) =>
              selectedSet.has(option.name)
            ).length
            const allSelected = selectedInGroup === groupOptions.length && groupOptions.length > 0
            const isOpen = openGroups[group] ?? selectedInGroup > 0

            return (
              <div
                key={group}
                className="overflow-hidden rounded-lg border border-border/60 bg-background"
              >
                <div className="flex items-center gap-1 bg-muted/25 pr-1">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [group]: !isOpen }))
                    }
                  >
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        !isOpen && "-rotate-90"
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {group}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {selectedInGroup}/{groupOptions.length}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => toggleGroup(groupOptions, !allSelected)}
                  >
                    {allSelected ? "None" : "All"}
                  </button>
                </div>

                {isOpen ? (
                  <ul className="max-h-48 divide-y divide-border/40 overflow-y-auto border-t border-border/50">
                    {groupOptions.map((option) => {
                      const checked = selectedSet.has(option.name)
                      return (
                        <li key={option.name}>
                          <div
                            className={cn(
                              "flex items-start gap-2.5 px-2.5 py-2 transition-colors hover:bg-muted/30",
                              checked && "bg-primary/[0.04]"
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium leading-snug text-foreground">
                                {option.label}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] leading-snug text-muted-foreground">
                                {option.name}
                              </span>
                              {option.description ? (
                                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/90">
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                            <Switch
                              size="sm"
                              className="mt-0.5 shrink-0"
                              checked={checked}
                              onCheckedChange={() => toggle(option.name)}
                              aria-label={`${checked ? "Disable" : "Enable"} ${option.label}`}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
