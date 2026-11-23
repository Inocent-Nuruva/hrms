"use client"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Textarea } from "@/components/ui/textarea"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import {
  confirmLeavePayrollComponent,
  getLeavePayrollComponentStatus,
  syncLeaveEncashmentPayments,
  type LeavePayrollComponentStatus,
} from "@/lib/leave-engine-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

const token = () => readStoredSessionTokens().accessToken
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

type ConfirmForm = {
  component_code: string
  general_ledger_account_code: string
  liability_account_code: string
  expense_account_code: string
  tax_treatment: string
  taxable_percentage: string
  pensionable: boolean
  effective_date: string
  notes: string
}

/**
 * Leave money in payroll: whether the LEAVE_ENCASHMENT and
 * PUBLIC_HOLIDAY_WORK components are confirmed by Finance (handoffs are
 * refused until then), the confirmation form, and an on-demand check of
 * payroll for paid or reversed encashments.
 */
export function LeavePayrollIntegrationView() {
  const actor = useDashboardActor()
  const canConfirm = canPerformPermission(actor.permissionLabels, "leave_encashment:finance_confirm")
  const canSync = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_balances:manage", "leave_balances:adjust-manually"],
    mode: "any",
  })
  const [components, setComponents] = React.useState<LeavePayrollComponentStatus[]>([])
  const [form, setForm] = React.useState<ConfirmForm | null>(null)
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      setComponents(await getLeavePayrollComponentStatus(token()))
    } catch (error) {
      showErrorAlert(errorText(error, "Could not load the payroll components."))
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function startConfirm(component: LeavePayrollComponentStatus) {
    setForm({
      component_code: component.code,
      general_ledger_account_code: component.placeholder_gl ? "" : (component.general_ledger_account_code ?? ""),
      liability_account_code: "",
      expense_account_code: "",
      tax_treatment: component.tax_treatment,
      taxable_percentage: String(Number(component.taxable_percentage)),
      pensionable: component.pensionable,
      effective_date: new Date().toISOString().slice(0, 10),
      notes: "",
    })
  }

  async function submit() {
    if (!form) return
    setBusy(true)
    try {
      await confirmLeavePayrollComponent(token(), {
        ...form,
        taxable_percentage: Number(form.taxable_percentage),
      })
      setForm(null)
      await load()
      showSuccessAlert("Payroll treatment confirmed. Handoffs to payroll are now allowed.")
    } catch (error) {
      showErrorAlert(errorText(error, "Could not confirm the component."))
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    try {
      const result = await syncLeaveEncashmentPayments(token())
      showSuccessAlert(`Checked ${result.checked}: ${result.paid} newly paid, ${result.reversed} reversed.`)
    } catch (error) {
      showErrorAlert(errorText(error, "Could not check payroll."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="Leave payroll integration"
        description="Encashments and public-holiday pay reach payroll as draft inputs. An encashment shows as paid only when the payroll run paying it is paid; payroll reversals show as reversed."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCwIcon className="mr-1 size-4" /> Refresh
            </Button>
            {canSync ? (
              <Button size="sm" disabled={busy} onClick={() => void sync()}>
                Check payroll payments now
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-3 lg:grid-cols-2">
        {components.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave payroll components exist for this company yet (run the payroll baseline setup).</p>
        ) : null}
        {components.map((component) => (
          <article key={component.code} className="space-y-2 rounded-lg border border-border p-4" data-testid="leave-payroll-component">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{component.name}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  component.ready_for_handoff
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
                )}
              >
                {component.ready_for_handoff
                  ? component.finance_verified
                    ? "Confirmed by Finance"
                    : "Test configuration"
                  : "Waiting for Finance"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-1 text-xs">
              <dt className="text-muted-foreground">Code</dt><dd>{component.code}</dd>
              <dt className="text-muted-foreground">Status</dt><dd>{component.status}</dd>
              <dt className="text-muted-foreground">Tax treatment</dt><dd>{component.tax_treatment} ({Number(component.taxable_percentage)}%)</dd>
              <dt className="text-muted-foreground">Pensionable (NSSF)</dt><dd>{component.pensionable ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">GL account</dt>
              <dd>{component.general_ledger_account_code ?? "—"}{component.placeholder_gl ? " (placeholder)" : ""}</dd>
              <dt className="text-muted-foreground">Confirmed</dt><dd>{component.verified_at ? new Date(String(component.verified_at)).toLocaleString() : "Not yet"}</dd>
            </dl>
            {canConfirm ? (
              <Button size="sm" variant="outline" onClick={() => startConfirm(component)}>
                {component.finance_verified ? "Update confirmation" : "Confirm treatment"}
              </Button>
            ) : null}
          </article>
        ))}
      </section>

      {form ? (
        <section className="space-y-3 rounded-lg border-2 border-primary/40 p-4" aria-label="Confirm payroll treatment">
          <h2 className="text-base font-semibold">Confirm {form.component_code}</h2>
          <p className="text-xs text-muted-foreground">Enter the treatment Finance has approved. This is recorded with your name and date.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["general_ledger_account_code", "GL account"],
                ["liability_account_code", "Liability account"],
                ["expense_account_code", "Expense account"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <Input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Tax treatment</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={form.tax_treatment}
                onChange={(event) => setForm({ ...form, tax_treatment: event.target.value })}
              >
                <option value="TAXABLE">Taxable</option>
                <option value="PARTIALLY_TAXABLE">Partially taxable</option>
                <option value="NON_TAXABLE">Non-taxable</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Taxable %</span>
              <Input type="number" value={form.taxable_percentage} onChange={(event) => setForm({ ...form, taxable_percentage: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Effective date</span>
              <Input type="date" value={form.effective_date} onChange={(event) => setForm({ ...form, effective_date: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pensionable} onChange={(event) => setForm({ ...form, pensionable: event.target.checked })} />
              Pensionable (NSSF applies)
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Approval notes</span>
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Who approved this treatment and on what basis" />
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !form.general_ledger_account_code.trim() || !form.liability_account_code.trim() || !form.expense_account_code.trim() || !form.notes.trim()}
              onClick={() => void submit()}
            >
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
