"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, RefreshCw, Search } from "lucide-react"

import { FluentSelect } from "@/components/ui/fluent-select"
import { errorMessage, listContracts, type ContractRow } from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

import { CONTRACT_TYPE_LABELS, ContractStatusBadge, ContractValidityText, formatDate } from "./contract-ui"
import { contractWorkspaceMessages as m } from "./contract-workspace-messages"

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_HR_SIGNATURE", label: "Awaiting company signature" },
  { value: "PENDING_EMPLOYEE_SIGNATURE", label: "Awaiting employee signature" },
  { value: "PENDING_VERIFICATION", label: "Upload to verify" },
  { value: "SIGNED", label: "Signed" },
  { value: "TERMINATED", label: "Ended (exit)" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "SUPERSEDED", label: "Superseded" },
]

const VALIDITY_FILTERS = [
  { value: "", label: "Any validity" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRING", label: "Expiring (30 days)" },
  { value: "EXPIRED", label: "Expired" },
  { value: "NOT_STARTED", label: "Starts later" },
  { value: "TERMINATED", label: "Ended" },
]

const PAGE_SIZE = 25

/** HR contract list. With `employeeId` it is scoped to one employee (profile tab, onboarding). */
export function ContractsList({
  token,
  canManage,
  employeeId,
  employeeName,
  compact = false,
}: {
  token: string
  canManage: boolean
  employeeId?: number | null
  employeeName?: string
  compact?: boolean
}) {
  const [rows, setRows] = React.useState<ContractRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [validity, setValidity] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const result = await listContracts(token, {
        page,
        limit: PAGE_SIZE,
        q: q.trim() || undefined,
        status: status || undefined,
        validity: validity || undefined,
        employee_id: employeeId ?? undefined,
      })
      setRows(result.data)
      setTotal(result.total)
    } catch (cause) {
      setError(errorMessage(cause, "Contracts could not be loaded"))
    } finally {
      setLoading(false)
    }
  }, [token, page, q, status, validity, employeeId])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), q ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [load, q])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section aria-label="Employment contracts" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {!compact ? (
          <div className="flex flex-1 flex-wrap items-end gap-2">
            {!employeeId ? (
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-md border border-border pl-8 pr-3 text-sm"
                  placeholder="Reference, name or employee no."
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value)
                    setPage(1)
                  }}
                  aria-label="Search contracts"
                />
              </div>
            ) : null}
            <FluentSelect ariaLabel="Status" className="w-full sm:w-56" value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={STATUS_FILTERS} />
            <FluentSelect ariaLabel="Validity" className="w-full sm:w-44" value={validity} onChange={(value) => { setValidity(value); setPage(1) }} options={VALIDITY_FILTERS} />
          </div>
        ) : (
          <h3 className="text-base font-semibold">Contracts</h3>
        )}
        <div className="flex gap-2">
          <button type="button" aria-label="Refresh" className="rounded-md border border-border p-2" onClick={() => void load()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
          {canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => router.push(`/dashboard/employees/contracts/new${employeeId ? `?employee_id=${employeeId}` : ""}`)}
            >
              <Plus className="size-4" /> New contract
            </button>
          ) : null}
        </div>
      </div>

      {!compact ? <nav aria-label={m.quickFilters} className="flex flex-wrap gap-2">{STATUS_FILTERS.filter((item) => ["", "DRAFT", "PENDING_HR_SIGNATURE", "PENDING_EMPLOYEE_SIGNATURE", "SIGNED"].includes(item.value)).map((item) => <button key={item.value || "all"} type="button" aria-pressed={status === item.value && !validity} className="rounded-full border border-border px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground" onClick={() => { setStatus(item.value); setValidity(""); setPage(1) }}>{item.label}</button>)}<button type="button" aria-pressed={validity === "EXPIRING"} className="rounded-full border border-border px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground" onClick={() => { setStatus(""); setValidity("EXPIRING"); setPage(1) }}>{VALIDITY_FILTERS.find((item) => item.value === "EXPIRING")?.label}</button></nav> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Reference</th>
              {!employeeId ? <th className="px-3 py-2">Employee</th> : null}
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Validity</th>
              <th className="px-3 py-2">Company signatory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/dashboard/employees/contracts/${row.id}`} className="font-medium text-primary hover:underline">
                    {row.referenceNo}
                  </Link>
                  <span className="block text-xs text-muted-foreground">v{row.version}{row.amendmentReason ? ` · ${row.amendmentReason}` : ""}</span>
                </td>
                {!employeeId ? (
                  <td className="px-3 py-2">
                    {row.employeeName}
                    <span className="block text-xs text-muted-foreground">{row.employeeNo}</span>
                  </td>
                ) : null}
                <td className="px-3 py-2">{CONTRACT_TYPE_LABELS[row.contractType]}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : "open"}
                </td>
                <td className="px-3 py-2"><ContractStatusBadge status={row.status} /></td>
                <td className="px-3 py-2"><ContractValidityText validity={row.validity} /></td>
                <td className="px-3 py-2 text-slate-600">{row.signatoryName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-border md:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/dashboard/employees/contracts/${row.id}`} className="grid gap-1 px-3 py-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.referenceNo}</span>
                  <ContractStatusBadge status={row.status} />
                </span>
                {!employeeId ? <span className="text-sm">{row.employeeName}{row.employeeNo ? ` · ${row.employeeNo}` : ""}</span> : null}
                <span className="text-xs text-muted-foreground">
                  {CONTRACT_TYPE_LABELS[row.contractType]} · {formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : "open"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!rows.length && !loading ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {employeeId ? `No contracts for ${employeeName ?? "this employee"} yet.` : "No contracts match these filters."}
          </p>
        ) : null}
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      ) : null}

    </section>
  )
}
