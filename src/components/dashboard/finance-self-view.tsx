"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  acceptMyFinanceApplication,
  createMyFinanceApplication,
  listEmployeeFinanceProducts,
  listMyFinanceApplications,
  submitMyFinanceApplication,
  withdrawMyFinanceApplication,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function FinanceSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [applications, setApplications] = React.useState<AdminRecord[]>([])
  const [products, setProducts] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
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
    const results = await Promise.allSettled([
      listMyFinanceApplications(token).then(setApplications),
      listEmployeeFinanceProducts(token).then(setProducts).catch(() => setProducts([])),
    ])
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setApplications([])
      setError(first.reason instanceof Error ? first.reason.message : "Could not load your finance applications.")
    }
    setLoading(false)
  }, [leaveIfForbidden])

  React.useEffect(() => {
    setMounted(true)
    void load()
  }, [load])

  async function onCreate() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (!form.product_id || !form.requested_amount || !form.requested_term_months || !form.purpose) {
        throw new Error("Product, amount, term, and purpose are required.")
      }
      await createMyFinanceApplication(token, {
        product_id: Number(form.product_id),
        requested_amount: form.requested_amount,
        requested_term_months: Number(form.requested_term_months),
        purpose: form.purpose,
      })
      toast.success("Application created.")
      setCreateOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not create the application.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "app",
      label: "Application",
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{readString(row, ["purpose"], `Application #${rowId(row)}`)}</p>
          <p className="text-xs text-muted-foreground">{prettify(readString(row, ["productType", "product_type"], ""))}</p>
        </div>
      ),
    },
    { key: "amount", label: "Amount", render: (row) => readString(row, ["requestedAmount", "requested_amount"], "—") },
    { key: "term", label: "Term", render: (row) => readString(row, ["requestedTermMonths", "requested_term_months"], "—") },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const id = rowId(row)
        return (
          <div className="flex flex-wrap gap-1">
            <button type="button" className={actionButtonClass} disabled={busyId === `sub-${id}`} onClick={() => {
              const token = readStoredToken()
              if (!token || !id) return
              setBusyId(`sub-${id}`)
              void submitMyFinanceApplication(token, id)
                .then(() => { toast.success("Submitted."); return load() })
                .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not submit."))
                .finally(() => setBusyId(""))
            }}>Submit</button>
            <button type="button" className={actionButtonClass} disabled={busyId === `acc-${id}`} onClick={() => {
              const token = readStoredToken()
              if (!token || !id) return
              setBusyId(`acc-${id}`)
              void acceptMyFinanceApplication(token, id)
                .then(() => { toast.success("Accepted."); return load() })
                .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not accept."))
                .finally(() => setBusyId(""))
            }}>Accept</button>
            <button type="button" className={actionButtonClass} disabled={busyId === `wd-${id}`} onClick={() => {
              const token = readStoredToken()
              if (!token || !id) return
              setBusyId(`wd-${id}`)
              void withdrawMyFinanceApplication(token, id)
                .then(() => { toast.success("Withdrawn."); return load() })
                .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not withdraw."))
                .finally(() => setBusyId(""))
            }}>Withdraw</button>
          </div>
        )
      },
    },
  ], [busyId, load])

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My finance"
        title="Loans and advances"
        description="Apply, submit, accept an offer, or withdraw — only your own applications."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Applications", value: String(applications.length) },
          { label: "Products", value: String(products.length) },
          {
            label: "Open",
            value: String(
              applications.filter(
                (row) =>
                  !["WITHDRAWN", "REJECTED", "CLOSED"].includes(
                    readString(row, ["status"]).toUpperCase(),
                  ),
              ).length,
            ),
          },
        ].map((field) => (
          <div key={field.label} className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {field.label}
            </p>
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
              {field.value}
            </p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" className={primaryButtonClass} onClick={() => { setForm({}); setCreateOpen(true) }}>
          <PlusIcon className="size-4" /> New application
        </button>
      </div>
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My applications"
          data={applications}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey="me-finance-applications"
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
            <DialogDescription>Creates your staff loan or salary advance request.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Product</span>
              <select className={inputClass} value={form.product_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={rowId(product)} value={rowId(product)}>
                    {optionLabel(product)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Amount</span><input className={inputClass} value={form.requested_amount ?? ""} onChange={(event) => setForm((current) => ({ ...current, requested_amount: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Term (months)</span><input className={inputClass} value={form.requested_term_months ?? ""} onChange={(event) => setForm((current) => ({ ...current, requested_term_months: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Purpose</span><textarea className={textareaClass} value={form.purpose ?? ""} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} /></label>
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onCreate()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Create"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
