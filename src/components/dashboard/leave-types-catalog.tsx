"use client"

import * as React from "react"
import { Switch } from "@heroui/react"
import { ListFilter, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react"

import { TalentDoodle, TalentDoodleSprites } from "@/components/dashboard/talent-visuals"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type LeaveTypesCatalogProps = {
  types: AdminRecord[]
  loading: boolean
  canEdit: boolean
  canDelete: boolean
  onRefresh: () => void
  onCreate: () => void
  onEdit: (row: AdminRecord) => void
  onDelete: (row: AdminRecord) => void
  onToggleStatus: (row: AdminRecord) => void
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as AdminRecord) : null
}

function readText(row: AdminRecord | null | undefined, keys: string[], fallback = ""): string {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim() && value.trim() !== "-") return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function readBool(row: AdminRecord | null | undefined, keys: string[]): boolean {
  if (!row) return false
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") {
      if (value === 1) return true
      if (value === 0) return false
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes", "y"].includes(normalized)) return true
      if (["false", "0", "no", "n"].includes(normalized)) return false
    }
  }
  return false
}

function formatDays(value: string, suffix = "days / year"): string {
  if (!value) return ""
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return ""
  const amount = Number.isInteger(parsed) ? String(parsed) : String(parsed)
  return `${amount} ${suffix}`
}

function formatGender(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === "female") return "Female"
  if (normalized === "male") return "Male"
  return ""
}

function formatDateTime(value: string): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function HeaderSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(Boolean(value.trim()))
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (value.trim()) setOpen(true)
  }, [value])

  React.useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Search leave types"
        title="Search"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
      </button>
    )
  }

  return (
    <div className="flex h-8 w-44 items-center gap-1.5 rounded-md border border-white/25 bg-white px-2">
      <Search className="size-3.5 shrink-0 text-primary" />
      <input
        ref={inputRef}
        aria-label="Search leave types"
        className="min-w-0 w-full border-0 bg-transparent p-0 text-xs text-slate-900 outline-none placeholder:text-slate-400"
        placeholder="Search leave types"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label="Close search"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        onClick={() => {
          onChange("")
          setOpen(false)
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function FilterChoice({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2 text-[11px] font-semibold transition",
              active
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-slate-300",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function metaParts(item: {
  paid: boolean
  status: string
  maxDays: string
  gender: string
  attachment: boolean
  carry: boolean
}): string[] {
  const parts = [
    item.paid ? "Paid" : "Unpaid",
    item.status === "active" ? "Active" : "Inactive",
  ]
  if (item.gender) parts.push(item.gender)
  if (item.maxDays) parts.push(item.maxDays)
  if (item.attachment) parts.push("Attachment required")
  if (item.carry) parts.push("Carry forward")
  return parts
}

function LeaveTypeTitle({ name, paid }: { name: string; paid: boolean }) {
  return (
    <span
      className={cn(
        "block min-w-0 max-w-full truncate text-sm font-semibold",
        paid
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-amber-700 dark:text-amber-300",
      )}
    >
      {name}
    </span>
  )
}

export function LeaveTypesCatalog({
  types,
  loading,
  canEdit,
  canDelete,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onToggleStatus,
}: LeaveTypesCatalogProps) {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [payFilter, setPayFilter] = React.useState("all")
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)

  const rows = React.useMemo(() => {
    return types
      .map((row) => {
        const name = readText(row, ["name", "title"], "Untitled type")
        const code = readText(row, ["code"])
        const status = readText(row, ["status"], "active").toLowerCase()
        return {
          row,
          name,
          code,
          status,
          paid: readBool(row, ["is_paid", "isPaid"]),
          description: readText(row, ["description"]),
          maxDays: formatDays(readText(row, ["max_days_per_year", "maxDaysPerYear"])),
          gender: formatGender(readText(row, ["gender_restriction", "genderRestriction"])),
          attachment: readBool(row, ["requires_attachment", "requiresAttachment"]),
          carry: readBool(row, ["is_carry_forward_allowed", "isCarryForwardAllowed"]),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [types])

  const visible = rows.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false
    if (payFilter === "paid" && !item.paid) return false
    if (payFilter === "unpaid" && item.paid) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return `${item.name} ${item.code} ${item.description}`.toLowerCase().includes(query)
  })

  const activeCount = rows.filter((item) => item.status === "active").length
  const filtersActive = statusFilter !== "all" || payFilter !== "all"
  const selectedName = readText(selected, ["name", "title"], "Leave type")
  const selectedCode = readText(selected, ["code"])
  const selectedActive = readText(selected, ["status"], "active").toLowerCase() !== "inactive"

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-border dark:bg-background">
      <div className="sticky top-11 z-30 overflow-hidden rounded-t-md bg-primary text-white">
        <TalentDoodleSprites />
        <TalentDoodle />
        <div className="relative z-10 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Leave types</h2>
          <p className="text-[11px] text-white/75">
            {rows.length} {rows.length === 1 ? "type" : "types"}
            {rows.length ? ` · ${activeCount} active` : ""}
          </p>
        </div>
        <HeaderSearch value={search} onChange={setSearch} />
        <Popover>
          <PopoverTrigger
            type="button"
            aria-label="Filter leave types"
            title="Filter"
            className={cn(
              "relative inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10 text-white transition hover:bg-white/20",
              filtersActive && "bg-white text-primary hover:bg-white",
            )}
          >
            <ListFilter className="size-3.5" />
            {filtersActive ? (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-300" />
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 space-y-3 p-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Status</p>
              <FilterChoice
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Pay</p>
              <FilterChoice
                value={payFilter}
                onChange={setPayFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "paid", label: "Paid" },
                  { value: "unpaid", label: "Unpaid" },
                ]}
              />
            </div>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        {canEdit ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-white/90"
            onClick={onCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Create leave type
          </button>
        ) : null}
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-border">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse bg-slate-50 dark:bg-muted/30" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-white">No leave types</p>
          <p className="mt-1 text-xs text-slate-500">
            {rows.length === 0 ? "Create a type before employees can request leave." : "Nothing matches these filters."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-border">
          {visible.map((item) => {
            const inactive = item.status !== "active"
            const meta = metaParts(item)
            return (
              <li key={readText(item.row, ["id", "code", "name"]) || item.name}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-muted/40",
                    inactive && "opacity-60",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelected(item.row)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <LeaveTypeTitle name={item.name} paid={item.paid} />
                      {item.code ? (
                        <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">
                          {item.code}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {meta.join(" · ")}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit ? (
                      <Switch.Root
                        isSelected={!inactive}
                        onChange={() => onToggleStatus(item.row)}
                        size="sm"
                        aria-label={`${inactive ? "Activate" : "Deactivate"} ${item.name}`}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    ) : null}
                    {canEdit ? (
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-background"
                        onClick={() => onEdit(item.row)}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-rose-600 dark:hover:bg-background"
                        onClick={() => onDelete(item.row)}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-md data-[side=right]:sm:max-w-md">
          <header className="shrink-0 border-b border-slate-200 px-4 py-3 pr-11 dark:border-border">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedName}
              </SheetTitle>
              {selected ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-medium",
                    selectedActive ? "text-emerald-600" : "text-slate-500",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", selectedActive ? "bg-emerald-500" : "bg-slate-400")} />
                  {selectedActive ? "Active" : "Inactive"}
                </span>
              ) : null}
            </div>
            <SheetDescription className="mt-0.5 text-xs text-slate-500">
              {selectedCode || "Leave type"}
            </SheetDescription>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {selected ? (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {readText(selected, ["description"]) || "No description."}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  {[
                    { label: "Pay", value: readBool(selected, ["is_paid", "isPaid"]) ? "Paid" : "Unpaid" },
                    {
                      label: "Yearly maximum",
                      value: formatDays(readText(selected, ["max_days_per_year", "maxDaysPerYear"])) || "Not fixed",
                    },
                    {
                      label: "Who can use it",
                      value: formatGender(readText(selected, ["gender_restriction", "genderRestriction"])) || "Everyone",
                    },
                    {
                      label: "Attachment",
                      value: readBool(selected, ["requires_attachment", "requiresAttachment"]) ? "Required" : "Optional",
                    },
                    {
                      label: "Carry forward",
                      value: readBool(selected, ["is_carry_forward_allowed", "isCarryForwardAllowed"])
                        ? formatDays(readText(selected, ["max_carry_forward_days", "maxCarryForwardDays"]), "days") || "Allowed"
                        : "Not allowed",
                    },
                    {
                      label: "Company",
                      value:
                        readText(asRecord(selected.company), ["name", "company_name"]) ||
                        readText(selected, ["company_name", "companyName"]) ||
                        "—",
                    },
                    { label: "Updated", value: formatDateTime(readText(selected, ["updated_at", "updatedAt"])) },
                  ].map((fact) => (
                    <div key={fact.label} className="min-w-0">
                      <dt className="text-[11px] text-slate-500">{fact.label}</dt>
                      <dd className="mt-0.5 truncate font-medium text-slate-900 dark:text-white" title={fact.value}>
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
          <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-end gap-1.5 border-t border-slate-200 px-4 py-2 dark:border-border">
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 dark:border-border dark:text-foreground"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
            {canEdit && selected ? (
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold !text-white"
                onClick={() => {
                  const row = selected
                  setSelected(null)
                  onEdit(row)
                }}
              >
                Edit
              </button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
