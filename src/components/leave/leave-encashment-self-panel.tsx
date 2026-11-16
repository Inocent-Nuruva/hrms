"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  cancelMyLeaveEncashmentRequest,
  createMyLeaveEncashmentRequest,
  listMyLeaveEncashmentRequests,
  type AdminRecord,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"

const text = (v: unknown) => (v == null || v === "" ? "—" : String(v))
const typeName = (row: AdminRecord) => {
  const type = (row.leave_type ?? {}) as Record<string, unknown>
  return text(type.name ?? type.code ?? row.leave_type_name ?? row.leave_type_id)
}

/**
 * Employee leave encashment: request to be paid for unused days, track the
 * request and cancel it while pending. The backend enforces the policy
 * (encashment enabled, maximum days, minimum balance kept, approval).
 */
export function LeaveEncashmentSelfPanel({ token, balances }: { token: string | null; balances: AdminRecord[] }) {
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [balanceKey, setBalanceKey] = React.useState("")
  const [days, setDays] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const options = React.useMemo(
    () =>
      balances
        .filter((b) => b.leave_type_id != null && b.fiscal_year != null)
        .map((b) => ({
          key: `${String(b.leave_type_id)}:${String(b.fiscal_year)}`,
          leaveTypeId: Number(b.leave_type_id),
          fiscalYear: String(b.fiscal_year),
          label: `${typeName(b)} · ${String(b.fiscal_year)} · ${text(b.available_days ?? b.available)} days available`,
        })),
    [balances],
  )

  const load = React.useCallback(async () => {
    if (!token) return
    try {
      setRows(await listMyLeaveEncashmentRequests(token))
    } catch {
      setRows([])
    }
  }, [token])

  React.useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    const option = options.find((o) => o.key === balanceKey)
    const requested = Number(days)
    if (!token || !option) return showErrorAlert("Choose a leave balance.")
    if (!Number.isFinite(requested) || requested <= 0) return showErrorAlert("Enter the number of days to encash.")
    if (!reason.trim()) return showErrorAlert("Give a reason.")
    setBusy(true)
    try {
      await createMyLeaveEncashmentRequest(token, {
        leave_type_id: option.leaveTypeId,
        fiscal_year: option.fiscalYear,
        requested_days: requested,
        reason: reason.trim(),
      })
      showSuccessAlert("Encashment request sent for approval.")
      setDays("")
      setReason("")
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not send the request.")
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (row: AdminRecord) => {
    if (!token || !window.confirm("Cancel this encashment request?")) return
    try {
      await cancelMyLeaveEncashmentRequest(token, String(row.id))
      showSuccessAlert("Encashment request cancelled.")
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not cancel the request.")
    }
  }

  if (!options.length && !rows.length) return null

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Encash leave</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Ask to be paid for unused leave days. Only leave types whose policy allows encashment are accepted; approved requests are paid through payroll.
      </p>
      {options.length ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            aria-label="Leave balance"
            value={balanceKey}
            onChange={(event) => setBalanceKey(event.target.value)}
          >
            <option value="">Choose a balance…</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <Input inputMode="decimal" placeholder="Days" aria-label="Days to encash" value={days} onChange={(e) => setDays(e.target.value)} />
          <Input placeholder="Reason" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button disabled={busy} onClick={() => void submit()}>
            Request
          </Button>
        </div>
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                {["Leave type / year", "Requested", "Approved", "Status", "Payment", ""].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-2 py-1.5">
                    {typeName(row)} · {text(row.fiscal_year)}
                  </td>
                  <td className="px-2 py-1.5">{text(row.requested_days)}</td>
                  <td className="px-2 py-1.5">{text(row.approved_days)}</td>
                  <td className="px-2 py-1.5">{text(row.status)}</td>
                  <td className="px-2 py-1.5">{String(row.payment_status ?? "").toUpperCase() === "PAID" ? "Paid" : row.payroll_handoff_reference ? "With payroll" : "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    {String(row.status) === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => void cancel(row)}>
                        Cancel
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
