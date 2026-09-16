"use client"

import * as React from "react"
import { Switch } from "@heroui/react"
import { Pencil, Trash2 } from "lucide-react"

import { LeaveCatalogFrame } from "@/components/dashboard/leave-catalog-frame"
import type { AdminRecord } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type LeaveWorkflowsCatalogProps = {
  workflows: AdminRecord[]
  draftRow?: AdminRecord | null
  loading: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  saving?: boolean
  draftBanner?: React.ReactNode
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

function readBool(row: AdminRecord, keys: string[]) {
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

export function LeaveWorkflowsCatalog({
  workflows,
  draftRow,
  loading,
  canCreate,
  canEdit,
  canDelete,
  saving,
  draftBanner,
  onRefresh,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onToggleStatus,
}: LeaveWorkflowsCatalogProps) {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const rows = React.useMemo(() => {
    const source = draftRow ? [draftRow, ...workflows] : workflows
    return source.map((row) => {
      const status = readText(row, ["status"], "active").toLowerCase()
      const isDraft = readBool(row, ["_isLocalDraft"]) || status === "draft"
      return {
        row,
        name: readText(row, ["name", "title"], "Untitled workflow"),
        status,
        isDraft,
        isDefault: readBool(row, ["is_default", "isDefault"]),
        leaveType: readText(row, ["leave_type_name", "leaveTypeName", "leave_type"]),
      }
    })
  }, [draftRow, workflows])

  const visible = rows.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return `${item.name} ${item.leaveType} ${item.status}`.toLowerCase().includes(query)
  })

  const activeCount = rows.filter((item) => item.status === "active").length

  return (
    <LeaveCatalogFrame
      title="Leave workflows"
      subtitle={`${rows.length} ${rows.length === 1 ? "workflow" : "workflows"}${rows.length ? ` · ${activeCount} active` : ""}`}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search workflows"
      searchAriaLabel="Search leave workflows"
      filterAriaLabel="Filter leave workflows"
      filterGroups={[
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          options: [
            { value: "all", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ],
        },
      ]}
      onFilterChange={(_, value) => setStatusFilter(value)}
      onRefresh={onRefresh}
      loading={loading}
      createLabel="New workflow"
      onCreate={onCreate}
      canCreate={canCreate}
      banner={draftBanner}
      emptyTitle="No leave workflows"
      emptyDescription={
        rows.length === 0 ? "Create a workflow to define who approves leave." : "Nothing matches these filters."
      }
      isEmpty={visible.length === 0}
      showSkeleton={loading && rows.length === 0}
    >
      <ul className="divide-y divide-slate-100 dark:divide-border">
        {visible.map((item) => {
          const inactive = item.status !== "active"
          return (
            <li key={readText(item.row, ["id", "workflow_id", "name"]) || item.name}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-3 hover:bg-muted/35 sm:px-4",
                  item.isDraft && "bg-amber-50/70 dark:bg-amber-500/10",
                  !item.isDraft && inactive && "opacity-60",
                )}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item.row)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                    {item.isDraft ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        Draft
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {[
                      item.isDefault ? "All leave types" : item.leaveType || "Leave type not set",
                      item.isDefault ? "Default workflow" : "Type-specific workflow",
                      item.isDraft ? "Draft" : inactive ? "Inactive" : "Active",
                    ].join(" · ")}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {!item.isDraft ? (
                    <span
                      className={cn(
                        "mr-1 hidden items-center gap-1 text-[11px] font-medium sm:inline-flex",
                        inactive ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", inactive ? "bg-slate-400" : "bg-emerald-500")} />
                      {inactive ? "Inactive" : "Active"}
                    </span>
                  ) : null}
                  {canEdit && !item.isDraft ? (
                    <Switch.Root
                      isSelected={!inactive}
                      onChange={() => onToggleStatus(item.row)}
                      size="sm"
                      isDisabled={saving}
                      aria-label={`${inactive ? "Activate" : "Deactivate"} ${item.name}`}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Root>
                  ) : null}
                  {canEdit || item.isDraft ? (
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
                      onClick={() => onEdit(item.row)}
                      aria-label={item.isDraft ? `Continue ${item.name}` : `Edit ${item.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                  {(canDelete || item.isDraft) ? (
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-rose-600"
                      onClick={() => onDelete(item.row)}
                      aria-label={item.isDraft ? `Clear ${item.name}` : `Delete ${item.name}`}
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
