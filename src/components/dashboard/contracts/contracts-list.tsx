"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Dialog as FluentDialog, DialogSurface, DialogTitle } from "@fluentui/react-components"
import { Loader2, Plus, RefreshCw, Search, X } from "lucide-react"

import { FluentSelect } from "@/components/ui/fluent-select"
import { listEmployees, type AdminRecord } from "@/lib/admin-api"
import {
  createContractDraft,
  errorMessage,
  listContracts,
  type ContractRow,
  type ContractType,
} from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

import { CONTRACT_TYPE_LABELS, ContractStatusBadge, ContractValidityText, formatDate } from "./contract-ui"

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

function NewContractDialog({
  open,
  onOpenChange,
  token,
  presetEmployee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  presetEmployee?: { id: number; name: string } | null
}) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [options, setOptions] = React.useState<AdminRecord[]>([])
  const [employee, setEmployee] = React.useState<{ id: number; name: string } | null>(presetEmployee ?? null)
  const [contractType, setContractType] = React.useState<ContractType>("UNSPECIFIED")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setEmployee(presetEmployee ?? null)
    setSearch("")
    setContractType("UNSPECIFIED")
    setStartDate("")
    setEndDate("")
    setError(null)
  }, [open, presetEmployee])

  React.useEffect(() => {
    if (!open || employee || search.trim().length < 2) {
      setOptions([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      listEmployees(token, { search: search.trim(), limit: 10 } as never, { signal: controller.signal })
        .then((result) => setOptions(result.rows))
        .catch(() => undefined)
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, employee, search, token])

  const needsEnd = contractType !== "UNSPECIFIED"
  const valid = employee && startDate && (!needsEnd || (endDate && endDate >= startDate))

  const create = async () => {
    if (!employee) return
    setBusy(true)
    setError(null)
    try {
      const draft = await createContractDraft(token, {
        employee_id: employee.id,
        contract_type: contractType,
        start_date: startDate,
        ...(needsEnd && endDate ? { end_date: endDate } : {}),
      })
      onOpenChange(false)
      router.push(`/dashboard/employees/contracts/${draft.id}`)
    } catch (cause) {
      setError(errorMessage(cause, "The draft could not be created"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FluentDialog open={open} onOpenChange={(_event, data) => !busy && onOpenChange(data.open)}>
      <DialogSurface className="!w-[min(520px,calc(100vw-2rem))] !max-w-[520px] !p-0">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <DialogTitle as="h2" className="!text-lg !font-semibold">
              New contract
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Details fill in from the employee record; you can edit them next.</p>
          </div>
          <button type="button" aria-label="Close" className="rounded-md p-1 hover:bg-slate-100" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-3 px-5 py-4">
          <div className="grid gap-1">
            <span className="text-sm font-medium">Employee</span>
            {employee ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{employee.name}</span>
                {!presetEmployee ? (
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setEmployee(null)}>
                    Change
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-md border border-border pl-8 pr-3 text-sm"
                  placeholder="Search name or employee number"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search employees"
                />
                {options.length ? (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-white shadow-md">
                    {options.map((row) => {
                      const name = `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim()
                      return (
                        <li key={String(row.id)}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => setEmployee({ id: Number(row.id), name: `${name} (${String(row.employee_no ?? row.id)})` })}
                          >
                            {name} <span className="text-xs text-muted-foreground">{String(row.employee_no ?? "")}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Contract type</span>
            <FluentSelect
              ariaLabel="Contract type"
              value={contractType}
              onChange={(value) => setContractType(value as ContractType)}
              options={(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((value) => ({ value, label: CONTRACT_TYPE_LABELS[value] }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Start date</span>
              <input type="date" className="h-9 rounded-md border border-border px-2" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            {needsEnd ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{contractType === "SPECIFIC_TASK" ? "Expected end date" : "End date"}</span>
                <input type="date" className="h-9 rounded-md border border-border px-2" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
            ) : null}
          </div>
          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={!valid || busy}
            onClick={() => void create()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create draft
          </button>
        </div>
      </DialogSurface>
    </FluentDialog>
  )
}

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
  const [creating, setCreating] = React.useState(false)

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
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" /> New contract
            </button>
          ) : null}
        </div>
      </div>

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
                {!employeeId ? <span className="text-sm">{row.employeeName}</span> : null}
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

      <NewContractDialog
        open={creating}
        onOpenChange={setCreating}
        token={token}
        presetEmployee={employeeId ? { id: employeeId, name: employeeName ?? `Employee #${employeeId}` } : null}
      />
    </section>
  )
}
