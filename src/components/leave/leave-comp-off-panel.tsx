"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  approveCompOffPolicy,
  decideCompOff,
  getCompOffEligibility,
  getCompOffHistory,
  getCompOffUtilization,
  listCompOffCredits,
  listCompOffPolicies,
  listPendingCompOffCredits,
  requestCompOff,
  reverseCompOff,
  saveCompOffPolicy,
  type AdminRecord,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"

const text = (v: unknown) => (v == null || v === "" ? "—" : String(v))
const days = (v: unknown) => (v == null ? "—" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} d`)
const unwrap = <T,>(v: unknown): T =>
  (v && typeof v === "object" && "data" in (v as Record<string, unknown>) ? (v as { data: T }).data : v) as T
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Waiting for approval",
  credited: "Available",
  expired: "Expired",
  reversed: "Reversed",
  rejected: "Rejected",
}

/**
 * Approves a credit. If the server refuses because the credit would exceed
 * the maximum accumulation, offers an audited override (the server still
 * checks the leave_balances:override_cap permission).
 */
async function approveWithCapFallback(token: string, id: number) {
  try {
    return await decideCompOff(token, id, { approve: true })
  } catch (e) {
    const text = message(e, "")
    if (!/maximum accumulation/i.test(text)) throw e
    const reason = window.prompt(`${text}

To credit it anyway, give an override reason (recorded in the audit log). Cancel to leave it pending.`)
    if (!reason?.trim()) throw e
    return decideCompOff(token, id, { approve: true, cap_override_reason: reason.trim() })
  }
}

type Eligibility = { types: AdminRecord[]; convertible_overtime: AdminRecord[] }

function CreditsTable({
  rows,
  actions,
  showEmployee,
}: {
  rows: AdminRecord[]
  actions?: (row: AdminRecord) => React.ReactNode
  showEmployee?: boolean
}) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">No compensatory-off credits yet.</p>
  const headers = [
    ...(showEmployee ? ["Employee"] : []),
    "Worked on",
    "Hours",
    "Days",
    "Expires",
    "Status",
    "Expired part",
    "",
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-2 py-1.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {showEmployee ? <td className="px-2 py-1.5">#{text(row.employee_id)}</td> : null}
              <td className="px-2 py-1.5">{text(row.work_date)}</td>
              <td className="px-2 py-1.5">{text(row.hours)}</td>
              <td className="px-2 py-1.5">{days(row.days)}</td>
              <td className="px-2 py-1.5">{text(row.expires_on)}</td>
              <td className="px-2 py-1.5">{STATUS_LABEL[String(row.status)] ?? text(row.status)}</td>
              <td className="px-2 py-1.5">{Number(row.expired_days) ? days(row.expired_days) : "—"}</td>
              <td className="px-2 py-1.5 text-right">{actions?.(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryButton({ token, id }: { token: string; id: number }) {
  const [open, setOpen] = React.useState(false)
  const [data, setData] = React.useState<{ ledger: AdminRecord[]; audit: AdminRecord[] } | null>(null)
  const toggle = async () => {
    if (!open && !data) {
      try {
        setData(unwrap(await getCompOffHistory(token, id)))
      } catch (e) {
        return showErrorAlert(message(e, "Could not load the history."))
      }
    }
    setOpen((v) => !v)
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => void toggle()}>
        {open ? "Hide history" : "History"}
      </Button>
      {open && data ? (
        <ul className="max-w-[320px] text-left text-[11px] text-muted-foreground">
          {data.audit.map((a, i) => (
            <li key={`a${i}`}>
              {text(a.created_at).slice(0, 16)} · {text(a.action).replace("leave_comp_off.", "")}
            </li>
          ))}
          {data.ledger.map((l) => (
            <li key={`l${String(l.id)}`}>
              Ledger {text(l.transaction_type)} {days(l.amount_days)} on {text(l.effective_date)}
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  )
}

/** Employee view: balance of credits, request comp-off for approved overtime, history. */
function SelfView({ token }: { token: string }) {
  const [eligibility, setEligibility] = React.useState<Eligibility | null>(null)
  const [credits, setCredits] = React.useState<AdminRecord[]>([])
  const [typeId, setTypeId] = React.useState("")
  const [overtimeId, setOvertimeId] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      setEligibility(unwrap<Eligibility>(await getCompOffEligibility(token)))
      setCredits(await listCompOffCredits(token))
    } catch {
      setEligibility({ types: [], convertible_overtime: [] })
      setCredits([])
    }
  }, [token])
  React.useEffect(() => {
    void load()
  }, [load])

  if (!eligibility) return null
  const types = eligibility.types
  if (!types.length && !credits.length) return null
  const enabled = types.filter((t) => t.earning_enabled === true)
  const available = credits.filter((c) => c.status === "credited").reduce((s, c) => s + Number(c.days), 0)
  const pending = credits.filter((c) => c.status === "pending_approval").reduce((s, c) => s + Number(c.days), 0)
  const nextExpiry = credits
    .filter((c) => c.status === "credited" && c.expires_on)
    .map((c) => String(c.expires_on))
    .sort()[0]

  const submit = async () => {
    if (!typeId || !overtimeId) return showErrorAlert("Choose the leave type and the approved overtime.")
    setBusy(true)
    try {
      await requestCompOff(token, { leave_type_id: Number(typeId), overtime_request_id: Number(overtimeId) })
      showSuccessAlert("Compensatory off requested.")
      setOvertimeId("")
      await load()
    } catch (e) {
      showErrorAlert(message(e, "Could not request compensatory off."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Compensatory off">
      <h3 className="text-sm font-semibold">Compensatory off</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Approved overtime can be taken as time off instead of overtime pay. Credits are used oldest first and unused days lapse on the expiry date.
      </p>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border p-2 text-xs">
          <div className="text-muted-foreground">Credited (not yet expired)</div>
          <div className="text-base font-semibold">{days(available)}</div>
        </div>
        <div className="rounded-md border border-border p-2 text-xs">
          <div className="text-muted-foreground">Waiting for approval</div>
          <div className="text-base font-semibold">{days(pending)}</div>
        </div>
        <div className="rounded-md border border-border p-2 text-xs">
          <div className="text-muted-foreground">Next expiry</div>
          <div className="text-base font-semibold">{nextExpiry ?? "—"}</div>
        </div>
      </div>
      {enabled.length ? (
        eligibility.convertible_overtime.length ? (
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Comp-off leave type"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="">Leave type…</option>
              {enabled.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {text(t.name)}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Approved overtime"
              value={overtimeId}
              onChange={(e) => setOvertimeId(e.target.value)}
            >
              <option value="">Approved overtime…</option>
              {eligibility.convertible_overtime.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {text(o.work_date)} · {(Number(o.requested_minutes) / 60).toFixed(2)} h
                </option>
              ))}
            </select>
            <Button disabled={busy} onClick={() => void submit()}>
              Request
            </Button>
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">You have no approved overtime that can be converted.</p>
        )
      ) : (
        <p className="mb-3 rounded-md bg-muted p-2 text-xs text-muted-foreground" role="status">
          {text(types[0]?.disabled_reason ?? "Compensatory off is not available yet.")}
        </p>
      )}
      <CreditsTable rows={credits} actions={(row) => <HistoryButton token={token} id={Number(row.id)} />} />
    </section>
  )
}

/** HR / approver view: pending approvals, all credits with reversal, policy, utilisation. */
function HrView({ token, canManagePolicy }: { token: string; canManagePolicy: boolean }) {
  const [pending, setPending] = React.useState<AdminRecord[]>([])
  const [credits, setCredits] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [eligibility, setEligibility] = React.useState<Eligibility | null>(null)
  const [usage, setUsage] = React.useState<AdminRecord[]>([])
  const [form, setForm] = React.useState({ leave_type_id: "", hours_per_day: "8", expiry_days: "90", requires_approval: true, minimum_hours: "", max_days_per_credit: "" })
  const year = String(new Date().getFullYear())

  const load = React.useCallback(async () => {
    const safe = async <T,>(p: Promise<T>, fallback: T) => {
      try {
        return await p
      } catch {
        return fallback
      }
    }
    setPending(await safe(listPendingCompOffCredits(token), []))
    setCredits(await safe(listCompOffCredits(token), []))
    setPolicies(await safe(listCompOffPolicies(token), []))
    setEligibility(unwrap(await safe(getCompOffEligibility(token), { types: [], convertible_overtime: [] })))
    setUsage(await safe(getCompOffUtilization(token, year), []))
  }, [token, year])
  React.useEffect(() => {
    void load()
  }, [load])

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      showSuccessAlert(ok)
      await load()
    } catch (e) {
      showErrorAlert(message(e, "The action failed."))
    }
  }

  const types = eligibility?.types ?? []
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="Compensatory off administration">
      <div>
        <h3 className="text-sm font-semibold">Compensatory off</h3>
        <p className="text-xs text-muted-foreground">
          Off until HR approves a policy. Overtime converted to comp-off is not paid as overtime; reversing a credit makes it payable again.
        </p>
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold">Waiting for approval</h4>
        <CreditsTable
          rows={pending}
          showEmployee
          actions={(row) => (
            <span className="inline-flex gap-1">
              <Button size="sm" onClick={() => void act(() => approveWithCapFallback(token, Number(row.id)), "Credit approved.")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt("Reason for rejecting")
                  if (reason?.trim()) void act(() => decideCompOff(token, Number(row.id), { approve: false, reason }), "Credit rejected.")
                }}
              >
                Reject
              </Button>
            </span>
          )}
        />
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold">All credits</h4>
        <CreditsTable
          rows={credits}
          showEmployee
          actions={(row) => (
            <span className="inline-flex gap-1">
              <HistoryButton token={token} id={Number(row.id)} />
              {row.status === "credited" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = window.prompt("Reason for reversing this credit (min. 5 characters)")
                    if (reason && reason.trim().length >= 5) void act(() => reverseCompOff(token, Number(row.id), reason), "Credit reversed.")
                  }}
                >
                  Reverse
                </Button>
              ) : null}
            </span>
          )}
        />
      </div>

      {usage.length ? (
        <div>
          <h4 className="mb-1 text-xs font-semibold">Usage {year}</h4>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                {["Employee", "Earned", "Expired", "Reversed", "Pending", "Used (leave taken)"].map((h) => (
                  <th key={h} className="px-2 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usage.map((u, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">#{text(u.employee_id)}</td>
                  <td className="px-2 py-1.5">{days(u.earned_days)}</td>
                  <td className="px-2 py-1.5">{days(u.expired_days)}</td>
                  <td className="px-2 py-1.5">{days(u.reversed_days)}</td>
                  <td className="px-2 py-1.5">{days(u.pending_days)}</td>
                  <td className="px-2 py-1.5">{days(u.used_days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div>
        <h4 className="mb-1 text-xs font-semibold">Policy</h4>
        {policies.length ? (
          <ul className="mb-2 space-y-1 text-xs">
            {policies.map((p) => (
              <li key={String(p.id)} className="flex flex-wrap items-center gap-2">
                <span>
                  Type #{text(p.leave_type_id)} · {text(p.hours_per_day)} h = 1 day · expires after {text(p.expiry_days)} days ·{" "}
                  {p.requires_approval ? "needs approval" : "credited directly"} · <strong>{text(p.status)}</strong>
                </span>
                {canManagePolicy && p.status !== "approved" ? (
                  <Button size="sm" variant="outline" onClick={() => void act(() => approveCompOffPolicy(token, Number(p.id)), "Policy approved.")}>
                    Approve (another HR user)
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground">No compensatory-off policy. Earning is blocked.</p>
        )}
        {canManagePolicy ? (
          <div className="grid gap-2 sm:grid-cols-6">
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm sm:col-span-2"
              aria-label="Policy leave type"
              value={form.leave_type_id}
              onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
            >
              <option value="">Leave type with comp-off switched on…</option>
              {types.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {text(t.name)}
                </option>
              ))}
            </select>
            <Input aria-label="Hours per day" inputMode="decimal" placeholder="Hours = 1 day" value={form.hours_per_day} onChange={(e) => setForm({ ...form, hours_per_day: e.target.value })} />
            <Input aria-label="Expiry days" inputMode="numeric" placeholder="Expiry (days)" value={form.expiry_days} onChange={(e) => setForm({ ...form, expiry_days: e.target.value })} />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={form.requires_approval} onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })} />
              Needs approval
            </label>
            <Button
              onClick={() =>
                void act(
                  () =>
                    saveCompOffPolicy(token, {
                      leave_type_id: Number(form.leave_type_id),
                      hours_per_day: Number(form.hours_per_day),
                      expiry_days: form.expiry_days ? Number(form.expiry_days) : undefined,
                      requires_approval: form.requires_approval,
                    }),
                  "Policy saved as draft. Another HR user must approve it.",
                )
              }
              disabled={!form.leave_type_id}
            >
              Save draft
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function LeaveCompOffPanel({
  token,
  mode,
  canManagePolicy = false,
}: {
  token: string | null
  mode: "self" | "hr"
  canManagePolicy?: boolean
}) {
  if (!token) return null
  return mode === "self" ? <SelfView token={token} /> : <HrView token={token} canManagePolicy={canManagePolicy} />
}
