"use client"

import * as React from "react"
import Link from "next/link"
import { Dialog as FluentDialog, DialogSurface, DialogTitle } from "@fluentui/react-components"
import { AlertTriangle, Loader2 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  acknowledgePayrollContractWarnings,
  errorMessage,
  getPayrollContractWarnings,
  type PayrollContractWarnings,
} from "@/lib/contracts-api"

const CODE_LABEL: Record<string, string> = {
  NO_SIGNED_CONTRACT: "No signed contract",
  CONTRACT_EXPIRED: "Contract expired",
  CONTRACT_EXPIRING: "Expiring within 30 days",
}

/**
 * Before locking a payroll run: returns true when there are no contract
 * warnings or they are already acknowledged; otherwise the caller shows
 * the dialog. Never blocks pay by itself.
 */
export async function contractWarningsCleared(token: string, runId: number) {
  try {
    const result = await getPayrollContractWarnings(token, runId)
    return result.acknowledged ? null : result
  } catch {
    // Users without contract access: the server still enforces on lock.
    return null
  }
}

export function PayrollContractWarningsDialog({
  token,
  warnings,
  onClose,
  onAcknowledged,
}: {
  token: string
  warnings: PayrollContractWarnings | null
  onClose: () => void
  onAcknowledged: () => void
}) {
  const [confirmed, setConfirmed] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    setConfirmed(false)
    setNote("")
    setError(null)
  }, [warnings])

  const acknowledge = async () => {
    if (!warnings) return
    setBusy(true)
    setError(null)
    try {
      await acknowledgePayrollContractWarnings(token, warnings.payroll_run_id, warnings.warnings_hash, note.trim() || undefined)
      onAcknowledged()
    } catch (cause) {
      setError(errorMessage(cause, "Could not record the acknowledgement"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FluentDialog open={Boolean(warnings)} onOpenChange={(_event, data) => !data.open && !busy && onClose()}>
      <DialogSurface className="!w-[min(640px,calc(100vw-2rem))] !max-w-[640px] !p-0">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle as="h2" className="flex items-center gap-2 !text-lg !font-semibold">
            <AlertTriangle className="size-5 text-amber-600" /> Employment contract warnings
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            These do not stop payroll. HR must acknowledge them before this run (period ending {warnings?.period_end_date}) is locked.
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
          <ul className="divide-y divide-border text-sm">
            {warnings?.warnings.map((row) => (
              <li key={`${row.employee_id}-${row.code}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{row.employee_name}</span>{" "}
                  <span className="text-xs text-muted-foreground">{row.employee_no}</span>
                  <span className="block text-xs text-slate-600">{row.message}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{CODE_LABEL[row.code] ?? row.code}</span>
                  {row.contract_id ? (
                    <Link href={`/dashboard/employees/contracts/${row.contract_id}`} className="text-xs text-primary hover:underline">
                      Open
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-2 border-t border-border px-5 py-3">
          <Textarea formatting={false} placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} />
            I have reviewed these contract warnings.
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={!confirmed || busy}
              onClick={() => void acknowledge()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Acknowledge and lock
            </button>
          </div>
        </div>
      </DialogSurface>
    </FluentDialog>
  )
}
