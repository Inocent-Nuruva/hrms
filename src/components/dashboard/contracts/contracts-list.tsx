"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Plus, RefreshCw, Search } from "lucide-react"

import {
  ProfileAddButton,
  ProfileRecordCollection,
  ProfileRecordEmpty,
  ProfileSectionHeader,
  RecordActionButton,
  RecordBadges,
  RecordTag,
  useProfileRecordView,
} from "@/components/dashboard/employee-profile/profile-record-views"
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
  const [recordView, setRecordView] = useProfileRecordView()

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

  const pager =
    pages > 1 ? (
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
    ) : null

  // One employee's contracts (profile, onboarding, recruitment): same header,
  // cards and list as the other employee profile sections.
  if (compact) {
    const newContract = () =>
      router.push(`/dashboard/employees/contracts/new${employeeId ? `?employee_id=${employeeId}` : ""}`)
    return (
      <section aria-label="Employment contracts" className="grid gap-3">
        <ProfileSectionHeader
          title="Contracts"
          count={loading && !rows.length ? undefined : total}
          view={recordView}
          onViewChange={setRecordView}
          actions={
            <>
              <button
                type="button"
                aria-label="Refresh"
                title="Refresh"
                className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
                onClick={() => void load()}
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              </button>
              {canManage ? <ProfileAddButton label="New contract" onClick={newContract} /> : null}
            </>
          }
        />
        {error ? (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {!rows.length && !loading ? (
          <ProfileRecordEmpty
            title="Contracts"
            message={`No contracts for ${employeeName ?? "this employee"} yet.`}
            actionLabel={canManage ? "New contract" : undefined}
            onAction={canManage ? newContract : undefined}
          />
        ) : (
          <ProfileRecordCollection
            title="Contracts"
            view={recordView}
            records={rows.map((row) => ({
              key: String(row.id),
              searchText: [row.referenceNo, CONTRACT_TYPE_LABELS[row.contractType], row.status, row.signatoryName ?? ""].join(" "),
              heading: (
                <Link href={`/dashboard/employees/contracts/${row.id}`} className="text-primary hover:underline">
                  {row.referenceNo}
                </Link>
              ),
              badges: (
                <RecordBadges inline>
                  <ContractStatusBadge status={row.status} />
                  <RecordTag>v{row.version}</RecordTag>
                  {row.validity ? <ContractValidityText validity={row.validity} /> : null}
                </RecordBadges>
              ),
              fields: [
                { label: "Type", value: CONTRACT_TYPE_LABELS[row.contractType] ?? String(row.contractType) },
                { label: "Period", value: `${formatDate(row.startDate)} – ${row.endDate ? formatDate(row.endDate) : "open"}` },
                { label: "Company signatory", value: row.signatoryName ?? "" },
                { label: "Amendment", value: row.amendmentReason ?? "" },
              ].filter((entry) => entry.value),
              actions: (
                <RecordActionButton
                  label="Open"
                  ariaLabel={`Open contract ${row.referenceNo}`}
                  icon={<ExternalLink className="size-4" />}
                  onClick={() => router.push(`/dashboard/employees/contracts/${row.id}`)}
                />
              ),
            }))}
          />
        )}
        {pager}
      </section>
    )
  }

  return (
    <section aria-label="Employment contracts" className="grid gap-3">
      <div className={cn("flex flex-wrap items-center justify-between gap-2", !compact && "rounded-xl border border-border bg-muted/20 p-2")}>
        {!compact ? (
          <div className="flex flex-1 flex-wrap items-end gap-2">
            {!employeeId ? (
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm"
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
          <button type="button" aria-label="Refresh" className="rounded-md border border-border bg-background p-2 hover:bg-muted" onClick={() => void load()}>
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

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <StandardTable className="hidden w-full text-sm md:table">
          <StandardTableHeader className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <StandardTableRow>
              <StandardTableHead className="px-4 py-2.5">Reference</StandardTableHead>
              {!employeeId ? <StandardTableHead className="px-4 py-2.5">Employee</StandardTableHead> : null}
              <StandardTableHead className="px-4 py-2.5">Type</StandardTableHead>
              <StandardTableHead className="px-4 py-2.5">Period</StandardTableHead>
              <StandardTableHead className="px-4 py-2.5">Status</StandardTableHead>
              <StandardTableHead className="px-4 py-2.5">Validity</StandardTableHead>
              <StandardTableHead className="px-4 py-2.5">Company signatory</StandardTableHead>
            </StandardTableRow>
          </StandardTableHeader>
          <StandardTableBody>
            {rows.map((row) => (
              <StandardTableRow key={row.id} className="border-t border-border hover:bg-muted/30">
                <StandardTableCell className="px-4 py-3">
                  <Link href={`/dashboard/employees/contracts/${row.id}`} className="font-medium text-primary hover:underline">
                    {row.referenceNo}
                  </Link>
                  <span className="block text-xs text-muted-foreground">v{row.version}{row.amendmentReason ? ` · ${row.amendmentReason}` : ""}</span>
                </StandardTableCell>
                {!employeeId ? (
                  <StandardTableCell className="px-4 py-3">
                    {row.employeeName}
                    <span className="block text-xs text-muted-foreground">{row.employeeNo}</span>
                  </StandardTableCell>
                ) : null}
                <StandardTableCell className="px-4 py-3">{CONTRACT_TYPE_LABELS[row.contractType]}</StandardTableCell>
                <StandardTableCell className="px-4 py-3 whitespace-nowrap">
                  {formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : "open"}
                </StandardTableCell>
                <StandardTableCell className="px-4 py-3"><ContractStatusBadge status={row.status} /></StandardTableCell>
                <StandardTableCell className="px-4 py-3"><ContractValidityText validity={row.validity} /></StandardTableCell>
                <StandardTableCell className="px-4 py-3 text-slate-600">{row.signatoryName ?? "—"}</StandardTableCell>
              </StandardTableRow>
            ))}
          </StandardTableBody>
        </StandardTable>
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

      {pager}

    </section>
  )
}
