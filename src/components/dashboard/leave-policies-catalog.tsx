"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { Pencil, Trash2 } from "lucide-react"

import { LeaveCatalogFrame } from "@/components/dashboard/leave-catalog-frame"
import {
  attachedLeavePolicyTypes,
  leavePolicyAccrualLabel,
  leavePolicyRecordToForm,
} from "@/lib/leave-policy-form"
import type { AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type LeavePoliciesCatalogProps = {
  policies: AdminRecord[]
  loading: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  saving?: boolean
  onRefresh: () => void
  onCreate: () => void
  onOpen: (row: AdminRecord) => void
  onEdit: (row: AdminRecord) => void
  onDelete: (row: AdminRecord) => void
  onToggleStatus: (row: AdminRecord) => void
}

function readText(row: AdminRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim() && value.trim() !== "-") return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export function LeavePoliciesCatalog({
  policies,
  loading,
  canCreate,
  canEdit,
  canDelete,
  saving,
  onRefresh,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onToggleStatus,
}: LeavePoliciesCatalogProps) {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const rows = React.useMemo(() => {
    return policies
      .map((row) => {
        const form = leavePolicyRecordToForm(row)
        const typeCount =
          attachedLeavePolicyTypes(form).length ||
          readNumber(row, ["leave_type_count", "leaveTypeCount", "types_count"]) ||
          0
        const status = readText(row, ["status"], form.status || "active").toLowerCase()
        return {
          row,
          name: form.name || readText(row, ["name", "title"], "Untitled policy"),
          status,
          accrual: leavePolicyAccrualLabel(form.accrual_method || readText(row, ["accrual_method"], "yearly")),
          typeCount,
          description: form.description || readText(row, ["description"]),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [policies])

  const visible = rows.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return `${item.name} ${item.accrual} ${item.description}`.toLowerCase().includes(query)
  })

  const activeCount = rows.filter((item) => item.status === "active").length

  return (
    <LeaveCatalogFrame
      title="Leave policies"
      subtitle={`${rows.length} ${rows.length === 1 ? "policy" : "policies"}${rows.length ? ` · ${activeCount} active` : ""}`}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search policies"
      searchAriaLabel="Search leave policies"
      filterAriaLabel="Filter leave policies"
      filterGroups={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          options: [
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ],
        },
      ]}
      onFilterChange={(_, value) => setStatusFilter(value)}
      onRefresh={onRefresh}
      loading={loading}
      createLabel="New policy"
      onCreate={onCreate}
      canCreate={canCreate}
      emptyTitle="No leave policies"
      emptyDescription={
        rows.length === 0 ? "Create a policy to define how leave is earned and used." : "Nothing matches these filters."
      }
      isEmpty={visible.length === 0}
      showSkeleton={loading && rows.length === 0}
    >
      <ul className="divide-y divide-slate-100 dark:divide-border">
        {visible.map((item) => {
          const inactive = item.status !== "active"
          return (
            <li key={readText(item.row, ["id", "policy_id", "name"]) || item.name}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-3 hover:bg-muted/35 sm:px-4",
                  inactive && "opacity-60",
                )}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item.row)}>
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {[
                      `${item.accrual} accrual`,
                      `${item.typeCount} ${item.typeCount === 1 ? "type" : "types"}`,
                      inactive ? "Inactive" : "Active",
                    ].join(" · ")}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      "mr-1 hidden items-center gap-1 text-[11px] font-medium sm:inline-flex",
                      inactive ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", inactive ? "bg-slate-400" : "bg-emerald-500")} />
                    {inactive ? "Inactive" : "Active"}
                  </span>
                  {canEdit ? (
                    <Switch
                      checked={!inactive}
                      onCheckedChange={() => onToggleStatus(item.row)}
                      size="sm"
                      disabled={saving}
                      aria-label={`${inactive ? "Activate" : "Deactivate"} ${item.name}`}
                    />
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
                      onClick={() => onEdit(item.row)}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-rose-600"
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
    </LeaveCatalogFrame>
  )
}
