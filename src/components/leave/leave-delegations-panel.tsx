"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { FluentSelect } from "@/components/ui/fluent-select"
import {
  cancelLeaveDelegation,
  createLeaveDelegation,
  listEmployees,
  listLeaveDelegations,
  type AdminRecord,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"

type Option = { value: string; label: string }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—"
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Leave approval cover while an approver is away. Approvers manage their own
 * cover; HR (`mode="hr"`) can set cover for anyone and sees every delegation.
 */
export function LeaveDelegationsPanel({
  token,
  mode = "self",
  currentCompanyUserId,
}: {
  token: string | null
  mode?: "self" | "hr"
  currentCompanyUserId?: number | null
}) {
  const actor = useDashboardActor()
  const isApprover = actor.permissionLabels.some((label) =>
    ["leave_requests:approve", "self_service_requests:manager_review", "leave_workflows:update"].includes(label),
  )
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [people, setPeople] = React.useState<Option[]>([])
  const [form, setForm] = React.useState({ delegator: "", delegate: "", start: today(), end: today(), reason: "" })
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!token) return
    try {
      setRows(await listLeaveDelegations(token, mode === "hr"))
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not load approval cover.")
    }
  }, [mode, token])

  React.useEffect(() => {
    if (!token || (mode === "self" && !isApprover)) return
    void load()
    listEmployees(token, { page: 1, limit: 500 })
      .then((result) =>
        setPeople(
          result.rows
            .filter((row) => row.company_user_id)
            .map((row) => ({
              value: String(row.company_user_id),
              label: [row.first_name, row.last_name].filter(Boolean).join(" ") || `Employee #${String(row.id)}`,
            })),
        ),
      )
      .catch(() => setPeople([]))
  }, [isApprover, load, mode, token])

  const nameOf = (id: unknown) => people.find((person) => person.value === String(id))?.label ?? `User #${String(id)}`

  const save = async () => {
    if (!token) return
    if (!form.delegate || (mode === "hr" && !form.delegator)) {
      showErrorAlert("Choose who covers the approvals.")
      return
    }
    setSaving(true)
    try {
      await createLeaveDelegation(token, {
        ...(mode === "hr" ? { delegator_company_user_id: Number(form.delegator) } : {}),
        delegate_company_user_id: Number(form.delegate),
        start_date: form.start,
        end_date: form.end,
        reason: form.reason.trim() || null,
      })
      showSuccessAlert("Approval cover saved. New leave approvals in this period go to the cover approver.")
      setForm({ delegator: "", delegate: "", start: today(), end: today(), reason: "" })
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not save approval cover.")
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (row: AdminRecord) => {
    if (!token) return
    try {
      await cancelLeaveDelegation(token, String(row.id))
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not cancel approval cover.")
    }
  }

  if (mode === "self" && !isApprover) return null

  const delegateOptions = people.filter((person) => Number(person.value) !== currentCompanyUserId || mode === "hr")
  const inputClass = "h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm"

  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{mode === "hr" ? "Approval cover (all approvers)" : "My approval cover"}</h3>
        <p className="text-xs text-muted-foreground">
          While cover is active, new leave approvals that would come to {mode === "hr" ? "the approver" : "you"} go to the cover approver instead.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {mode === "hr" ? (
          <FluentSelect
            ariaLabel="Approver who is away"
            value={form.delegator}
            onChange={(value) => setForm({ ...form, delegator: value })}
            options={[{ value: "", label: "Approver away…" }, ...people]}
          />
        ) : null}
        <FluentSelect
          ariaLabel="Cover approver"
          value={form.delegate}
          onChange={(value) => setForm({ ...form, delegate: value })}
          options={[{ value: "", label: "Covered by…" }, ...delegateOptions]}
        />
        <input type="date" aria-label="Cover starts" className={inputClass} value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
        <input type="date" aria-label="Cover ends" className={inputClass} value={form.end} min={form.start} onChange={(event) => setForm({ ...form, end: event.target.value })} />
        <input aria-label="Reason" placeholder="Reason (optional)" className={inputClass} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </div>
      <div className="flex justify-end">
        <Button appearance="primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Add cover"}
        </Button>
      </div>
      {rows.length ? (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => {
            const active = String(row.status) === "active" && String(row.end_date).slice(0, 10) >= today()
            return (
              <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{nameOf(row.delegator_company_user_id)}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-medium">{nameOf(row.delegate_company_user_id)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDate(row.start_date)} – {formatDate(row.end_date)}
                    {row.status === "cancelled" ? " · cancelled" : !active ? " · ended" : ""}
                  </span>
                </span>
                {active ? (
                  <Button appearance="subtle" size="small" onClick={() => void cancel(row)}>
                    Cancel
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No approval cover set.</p>
      )}
    </section>
  )
}
