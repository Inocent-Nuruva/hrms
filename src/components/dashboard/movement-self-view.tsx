"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecordArray,
  formatDate,
  optionLabel,
  prettify,
  readBoolean,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals"
import {
  acknowledgeMyMovement,
  getMyMovement,
  listMyMovements,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function needsAcknowledgement(row: AdminRecord) {
  const required = readBoolean(row, ["employeeAcknowledgementRequired", "employee_acknowledgement_required"])
  const acknowledged = readString(row, ["employeeAcknowledgedAt", "employee_acknowledged_at"])
  return required && !acknowledged
}

export function MovementSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
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

  const awaiting = rows.filter((row) => needsAcknowledgement(row)).length
  const applied = rows.filter((row) => readString(row, ["status"]).toUpperCase() === "APPLIED").length
  const changes = asRecordArray(detail?.changes)

  const columns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "movement",
      label: "Movement",
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{readString(row, ["title", "movementNo", "movement_no"], `Movement #${rowId(row)}`)}</p>
          <p className="text-xs text-muted-foreground">{prettify(readString(row, ["movementType", "movement_type"], ""))}</p>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
    { key: "effective", label: "Effective", render: (row) => formatDate(row.effectiveDate ?? row.effective_date) },
    {
      key: "ack",
      label: "Acknowledgement",
      render: (row) => needsAcknowledgement(row) ? <StatusChip value="NEEDED" /> : <StatusChip value={readString(row, ["employeeAcknowledgedAt", "employee_acknowledged_at"]) ? "ACKNOWLEDGED" : "NOT REQUIRED"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const id = rowId(row)
        if (!needsAcknowledgement(row)) return null
        return (
          <button
            type="button"
            className={actionButtonClass}
            disabled={busyId === id}
            onClick={(event) => {
              event.stopPropagation()
              const token = readStoredToken()
              if (!token || !id) return
              setBusyId(id)
              void acknowledgeMyMovement(token, id)
                .then(() => {
                  toast.success("Acknowledged.")
                  return load()
                })
                .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not acknowledge."))
                .finally(() => setBusyId(""))
            }}
          >
            Acknowledge
          </button>
        )
      },
    },
  ], [busyId, load])

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My movements"
        title="Assignment changes"
        description="Review transfers and promotions recorded for your profile, then acknowledge the ones that need it."
        actions={
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Movements" value={rows.length} />
        <MetricTile label="Need acknowledgement" value={awaiting} />
        <MetricTile label="Applied" value={applied} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My movements"
          data={rows}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey="me-movements"
          onRowSelect={(_, row) => row && void openDetail(row)}
        />
      </div>
      {detail && changes.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Proposed changes</h2>
          <ul className="mt-3 grid gap-2">
            {changes.map((change) => (
              <li key={rowId(change) || readString(change, ["field"])} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{prettify(readString(change, ["field"], "Change"))}</span>
                <span className="ml-2 text-muted-foreground">
                  {readString(change, ["oldValue", "old_value"], "—")} → {readString(change, ["newValue", "new_value"], "—")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail)} row={detail} />
    </section>
  )
}
