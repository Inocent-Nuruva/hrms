"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import {
  CompactStatStrip,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecordArray,
  formatDate,
  prettify,
  readBoolean,
  readString,
  rowId,
} from "@/components/dashboard/talent-visuals"
import {
  acknowledgeMyMovement,
  getMyMovement,
  listMyMovements,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import Link from "next/link"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function needsAcknowledgement(row: AdminRecord) {
  const required = readBoolean(row, ["employeeAcknowledgementRequired", "employee_acknowledgement_required"])
  const acknowledged = readString(row, ["employeeAcknowledgedAt", "employee_acknowledged_at"])
  return required && !acknowledged
}

function acknowledgementLabel(row: AdminRecord) {
  if (needsAcknowledgement(row)) return "Needed"
  if (readString(row, ["employeeAcknowledgedAt", "employee_acknowledged_at"])) return "Acknowledged"
  return "Not required"
}

export function MovementSelfView() {
  const actor = useDashboardActor()
  const canRecordMovements =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/movements/cases", actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState("")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRows(await listMyMovements(token))
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        setLoading(false)
        return
      }
      setRows([])
      setError(errorObject instanceof Error ? errorObject.message : "Could not load your movements.")
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden])

  React.useEffect(() => {
    setMounted(true)
    void load()
  }, [load])

  async function openDetail(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    setDetail(row)
    if (!token || !id) return
    try {
      const record = await getMyMovement(token, id)
      if (record) setDetail(record)
    } catch {
      // keep the list row if the detail fetch fails
    }
  }

  async function acknowledge(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(id)
    try {
      await acknowledgeMyMovement(token, id)
      toast.success("Acknowledged.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not acknowledge.")
    } finally {
      setBusyId("")
    }
  }

  const awaiting = rows.filter((row) => needsAcknowledgement(row)).length
  const applied = rows.filter((row) => readString(row, ["status"]).toUpperCase() === "APPLIED").length
  const selectedChanges = asRecordArray(detail?.changes)

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My movements"
        title="Assignment changes"
        description={
          canRecordMovements
            ? "Your own promotions and transfers. Record changes for other employees from Movement operations."
            : "Review transfers and promotions recorded for your profile, then acknowledge the ones that need it."
        }
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <CompactStatStrip
        items={[
          { label: "Movements", value: loading ? "…" : String(rows.length) },
          { label: "Need acknowledgement", value: loading ? "…" : String(awaiting) },
          { label: "Applied", value: loading ? "…" : String(applied) },
        ]}
      />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
            <FluentLoadingIndicator className="size-4 animate-spin" />
            Loading your movements...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">No movements yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {canRecordMovements
                ? "Nothing on your own record yet. Create a promotion, transfer, or reporting change from Movement operations."
                : "When HR records a promotion, transfer, or reporting change for you, it will show up here."}
            </p>
            {canRecordMovements ? (
              <Link
                href="/dashboard/movements/cases"
                className="mt-3 inline-flex h-8 items-center rounded-md bg-sky-50 px-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                Open movement operations
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {rows.map((row) => {
              const id = rowId(row)
              const isSelected = Boolean(id && rowId(detail) === id)
              const typeLabel = prettify(readString(row, ["movementType", "movement_type"], ""))
              const effective = formatDate(row.effectiveDate ?? row.effective_date)
              const changes = isSelected ? selectedChanges : []
              return (
                <div key={id || readString(row, ["title", "movementNo", "movement_no"])}>
                  <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                    <button
                      type="button"
                      className="min-w-0 space-y-1 text-left"
                      onClick={() => void openDetail(row)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {readString(row, ["title", "movementNo", "movement_no"], `Movement #${id}`)}
                        </p>
                        <StatusChip value={readString(row, ["status"], "DRAFT")} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[typeLabel, effective !== "—" ? `Effective ${effective}` : "", acknowledgementLabel(row)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                    {needsAcknowledgement(row) ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClass}
                          disabled={busyId === id}
                          onClick={() => void acknowledge(row)}
                        >
                          {busyId === id ? <FluentLoadingIndicator className="size-4 animate-spin" /> : "Acknowledge"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {changes.length > 0 ? (
                    <ul className="divide-y divide-border/70 border-t border-border/70">
                      {changes.map((change) => (
                        <li
                          key={rowId(change) || readString(change, ["field"])}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {prettify(readString(change, ["field"], "Change"))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {readString(change, ["oldValue", "old_value"], "—")} → {readString(change, ["newValue", "new_value"], "—")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
