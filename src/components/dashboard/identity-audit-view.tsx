"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/fluent-toast-store"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  type IdentityAuditEntry,
  type IdentityAuditField,
  type IdentityAuditQuery,
  type IdentityAuditSource,
  downloadIdentityAuditCsv,
  listIdentityAudit,
  rollbackIdentityChange,
} from "@/lib/admin-api"
import { hasPermission } from "@/lib/dashboard-permissions"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const PAGE_SIZE = 25
const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

const FIELD_LABELS: Record<IdentityAuditField, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
}

const SOURCE_LABELS: Record<IdentityAuditSource, string> = {
  user_update: "User edit",
  employee_update: "Employee edit",
  rollback: "Rollback",
}

function readStoredToken(): string {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) return direct
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) return ""
  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

/** Groups consecutive rows of the same change set so one operation reads as one entry. */
function groupByChangeSet(items: IdentityAuditEntry[]) {
  const groups: { changeSetId: string; rows: IdentityAuditEntry[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.changeSetId === item.change_set_id) {
      last.rows.push(item)
    } else {
      groups.push({ changeSetId: item.change_set_id, rows: [item] })
    }
  }
  return groups
}

export function IdentityAuditView() {
  const actor = useDashboardActor()
  const canRollback = hasPermission(actor.permissionLabels, {
    permissions: ["identity_audit:rollback"],
    mode: "any",
  })

  const [filters, setFilters] = React.useState<IdentityAuditQuery>({})
  const [draftSearch, setDraftSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [items, setItems] = React.useState<IdentityAuditEntry[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingRollback, setPendingRollback] = React.useState<IdentityAuditEntry[] | null>(null)
  const [rollbackReason, setRollbackReason] = React.useState("")
  const [rollingBack, setRollingBack] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listIdentityAudit(readStoredToken(), {
        ...filters,
        page,
        limit: PAGE_SIZE,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit history.")
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  React.useEffect(() => {
    void load()
  }, [load])

  const updateFilter = (patch: Partial<IdentityAuditQuery>) => {
    setPage(1)
    setFilters((current) => ({ ...current, ...patch }))
  }

  const exportCsv = async () => {
    try {
      const blob = await downloadIdentityAuditCsv(readStoredToken(), filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "identity-change-audit.csv"
      link.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "Export failed.")
    }
  }

  const confirmRollback = async () => {
    if (!pendingRollback?.length) return
    setRollingBack(true)
    try {
      await rollbackIdentityChange(
        readStoredToken(),
        pendingRollback[0].change_set_id,
        rollbackReason.trim(),
      )
      toast.success("Change rolled back.")
      setPendingRollback(null)
      setRollbackReason("")
      await load()
    } catch (rollbackError) {
      toast.error(rollbackError instanceof Error ? rollbackError.message : "Rollback failed.")
    } finally {
      setRollingBack(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const groups = groupByChangeSet(items)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Identity change audit</h1>
          <p className="text-muted-foreground text-sm">
            Every change to names, email and phone, synced between user accounts and employee records.
          </p>
        </div>
        <Button appearance="secondary" onClick={() => void exportCsv()}>
          Export CSV
        </Button>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          updateFilter({ search: draftSearch.trim() || undefined })
        }}
      >
        <Input
          className="w-64"
          placeholder="Search name or value"
          value={draftSearch}
          onChange={(event) => setDraftSearch(event.target.value)}
        />
        <select
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          value={filters.field ?? ""}
          onChange={(event) =>
            updateFilter({ field: (event.target.value || undefined) as IdentityAuditField | undefined })
          }
        >
          <option value="">All fields</option>
          {Object.entries(FIELD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          value={filters.source ?? ""}
          onChange={(event) =>
            updateFilter({ source: (event.target.value || undefined) as IdentityAuditSource | undefined })
          }
        >
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input
          type="date"
          className="w-40"
          aria-label="From date"
          value={filters.from?.slice(0, 10) ?? ""}
          onChange={(event) =>
            updateFilter({ from: event.target.value ? `${event.target.value}T00:00:00` : undefined })
          }
        />
        <Input
          type="date"
          className="w-40"
          aria-label="To date"
          value={filters.to?.slice(0, 10) ?? ""}
          onChange={(event) =>
            updateFilter({ to: event.target.value ? `${event.target.value}T23:59:59` : undefined })
          }
        />
        <Button type="submit" appearance="primary">
          Apply
        </Button>
      </form>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date &amp; time</TableHead>
              <TableHead>Employee / user</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Previous value</TableHead>
              <TableHead>New value</TableHead>
              <TableHead>Changed by</TableHead>
              <TableHead>Source</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  No changes recorded.
                </TableCell>
              </TableRow>
            ) : (
              groups.flatMap(({ rows }) =>
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    {index === 0 ? (
                      <>
                        <TableCell rowSpan={rows.length} className="align-top whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell rowSpan={rows.length} className="align-top">
                          {row.subject_name ?? "—"}
                          <div className="text-muted-foreground text-xs">
                            {row.user_id ? `User #${row.user_id}` : null}
                            {row.user_id && row.employee_id ? " · " : null}
                            {row.employee_id ? `Employee #${row.employee_id}` : null}
                          </div>
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell>{FIELD_LABELS[row.field]}</TableCell>
                    <TableCell className="break-all">{row.old_value ?? "—"}</TableCell>
                    <TableCell className="break-all">{row.new_value ?? "—"}</TableCell>
                    {index === 0 ? (
                      <>
                        <TableCell rowSpan={rows.length} className="align-top">
                          {row.actor_name ?? row.actor_email ?? "System"}
                          {row.reason ? (
                            <div className="text-muted-foreground text-xs">Reason: {row.reason}</div>
                          ) : null}
                        </TableCell>
                        <TableCell rowSpan={rows.length} className="align-top">
                          {SOURCE_LABELS[row.source]}
                          {row.rolled_back_by_change_set_id ? (
                            <div className="text-muted-foreground text-xs">Rolled back</div>
                          ) : null}
                        </TableCell>
                        <TableCell rowSpan={rows.length} className="align-top">
                          {canRollback && row.can_rollback ? (
                            <Button
                              appearance="secondary"
                              size="small"
                              onClick={() => setPendingRollback(rows)}
                            >
                              Roll back
                            </Button>
                          ) : null}
                        </TableCell>
                      </>
                    ) : null}
                  </TableRow>
                )),
              )
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} change{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button appearance="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button appearance="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <AlertDialog
        open={pendingRollback !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRollback(null)
            setRollbackReason("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back this change?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRollback
                ? `This restores ${pendingRollback
                    .map((row) => `${FIELD_LABELS[row.field]} to "${row.old_value ?? "empty"}"`)
                    .join(", ")} on the user account and every linked employee record. A new audit entry will be recorded.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Reason (optional)"
            maxLength={500}
            value={rollbackReason}
            onChange={(event) => setRollbackReason(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction disabled={rollingBack} onClick={() => void confirmRollback()}>
              {rollingBack ? "Rolling back…" : "Roll back"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
