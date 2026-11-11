"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, ChevronDown, Circle, Clock } from "lucide-react"

import {
  CONTRACT_FIELD_LABELS,
  getContractActivity,
  listContracts,
  type ContractActivityItem,
  type ContractDetail,
  type ContractRow,
} from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

import { CONTRACT_TYPE_LABELS, ContractStatusBadge, ContractValidityText, formatDate, formatDateTime } from "./contract-ui"

/** Collapsible card; open by default on large screens only when `defaultOpen`. */
export function PanelSection({
  title,
  defaultOpen = true,
  count,
  children,
}: {
  title: string
  defaultOpen?: boolean
  count?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <section className="rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
        onClick={() => setOpen(!open)}
      >
        <span>
          {title}
          {typeof count === "number" ? <span className="ml-1 font-normal text-muted-foreground">({count})</span> : null}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-border px-4 py-3 text-sm">{children}</div> : null}
    </section>
  )
}

/** Frozen snapshot values once sent; the stored columns for older contracts. */
function keyTerms(contract: ContractDetail): Array<[string, string]> {
  const snapshot = (contract.particulars?.snapshot ?? null) as { values?: Record<string, string> } | null
  const v = snapshot?.values ?? {}
  const pick = (key: string, fallback: string | null | undefined) => (v[key] ?? fallback ?? "").toString().trim()
  const salary = pick("salary", contract.salaryAmount)
  const currency = pick("currency", contract.salaryCurrency)
  const frequency = pick("pay_frequency", contract.payFrequency?.toLowerCase())
  const probation = pick("probation_months", contract.probationMonths == null ? "" : String(contract.probationMonths))
  return [
    ["Job title", pick("job_title", contract.jobTitle)],
    ["Department", pick("department", contract.departmentName)],
    ["Reports to", pick("reporting_manager", contract.reportingManagerName)],
    ["Place of work", pick("work_location", contract.workLocation)],
    ["Period", `${formatDate(contract.startDate)} – ${contract.endDate ? formatDate(contract.endDate) : "open"}`],
    ["Probation", probation ? `${probation} month(s)` : ""],
    ["Hours", pick("hours_of_work", contract.hoursOfWork)],
    [
      "Salary",
      contract.salaryHidden
        ? "Hidden (payroll permission needed)"
        : salary
          ? `${currency} ${salary}${frequency ? ` ${frequency}` : ""}`.trim()
          : "",
    ],
    ["Basis", pick("employment_basis", "")],
  ].filter(([, value]) => value) as Array<[string, string]>
}

export function SummaryPanel({ contract }: { contract: ContractDetail }) {
  const snapshot = contract.particulars?.snapshot as { frozen_at?: string } | undefined
  return (
    <PanelSection title="Summary">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <ContractStatusBadge status={contract.status} />
        </dd>
        <dt className="text-muted-foreground">Validity</dt>
        <dd>
          <ContractValidityText validity={contract.validity} />
          {contract.endDate ? <span className="text-xs text-muted-foreground"> · ends {formatDate(contract.endDate)}</span> : null}
        </dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd>{CONTRACT_TYPE_LABELS[contract.contractType]}</dd>
        {keyTerms(contract).map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {snapshot?.frozen_at ? (
        <p className="mt-2 text-xs text-muted-foreground">Values frozen when sent ({formatDateTime(snapshot.frozen_at)}).</p>
      ) : null}
      {contract.amendmentReason ? <p className="mt-2 text-xs text-slate-600">{contract.amendmentReason}</p> : null}
    </PanelSection>
  )
}

export function SignatoriesPanel({ contract }: { contract: ContractDetail }) {
  const latest = (party: "COMPANY" | "EMPLOYEE") =>
    [...contract.signatures].reverse().find((row) => row.party === party && row.verificationOutcome !== "REJECTED")
  const rows: Array<{ label: string; name: string; signedAt: string | null; pending: string | null }> = [
    {
      label: "Company",
      name: latest("COMPANY")?.signerName ?? contract.signatory?.displayName ?? "Not assigned",
      signedAt: latest("COMPANY")?.signedAt ?? null,
      pending: contract.status === "PENDING_HR_SIGNATURE" ? "Waiting" : null,
    },
    {
      label: "Employee",
      name: latest("EMPLOYEE")?.signerName ?? contract.employeeName ?? "",
      // The employee has signed only once the contract is complete.
      signedAt: ["SIGNED", "SUPERSEDED", "TERMINATED"].includes(contract.status)
        ? (latest("EMPLOYEE")?.signedAt ?? contract.completedAt)
        : null,
      pending:
        contract.status === "PENDING_EMPLOYEE_SIGNATURE"
          ? "Waiting"
          : contract.status === "PENDING_VERIFICATION"
            ? "Upload awaiting HR check"
            : null,
    },
  ]
  return (
    <PanelSection title="Signatures">
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-2">
            {row.signedAt ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Signed" />
            ) : row.pending ? (
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Pending" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-label="Not yet" />
            )}
            <span>
              <span className="font-medium">{row.label}:</span> {row.name}
              <span className="block text-xs text-muted-foreground">
                {row.signedAt ? `Signed ${formatDateTime(row.signedAt)}` : (row.pending ?? "Not yet")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}

export function VersionsPanel({ token, contract }: { token: string; contract: ContractDetail }) {
  const [rows, setRows] = React.useState<ContractRow[] | null>(null)
  React.useEffect(() => {
    listContracts(token, { employee_id: contract.employeeId, limit: 50 })
      .then((result) => setRows([...result.data].sort((a, b) => b.version - a.version)))
      .catch(() => setRows([]))
  }, [token, contract.employeeId, contract.updatedAt])
  return (
    <PanelSection title="Versions" count={rows?.length} defaultOpen={false}>
      {!rows ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className={cn("grid gap-0.5", row.id === contract.id && "font-medium")}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                {row.id === contract.id ? (
                  <span>
                    v{row.version} · {row.referenceNo} (this)
                  </span>
                ) : (
                  <Link href={`/dashboard/employees/contracts/${row.id}`} className="text-primary hover:underline">
                    v{row.version} · {row.referenceNo}
                  </Link>
                )}
                <ContractStatusBadge status={row.status} />
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : "open"}
                {row.amendmentReason ? ` · ${row.amendmentReason}` : ""}
                {row.status === "CANCELLED" && row.cancelReason ? ` · ${row.cancelReason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  )
}

const ACTION_LABELS: Record<string, string> = {
  draft_create: "Draft created",
  draft_update: "Draft edited",
  preview: "Previewed",
  send: "Sent for signature",
  sign: "Signed",
  sign_challenge: "Requested a signing code",
  signed_upload: "Uploaded a signed copy",
  verify_accept: "Accepted the signed upload",
  verify_reject: "Rejected the signed upload",
  reassign_signatory: "Changed the company signatory",
  replace_document: "Replaced the PDF (new version)",
  cancel: "Cancelled",
  download: "Downloaded a file",
  tamper_detected: "File failed its integrity check",
  end_on_exit: "Ended on exit",
}

function describe(item: ContractActivityItem) {
  if (item.title) return item.title
  return ACTION_LABELS[item.action] ?? item.action.replace(/_/g, " ")
}

/** "override.company_tin" → "Company TIN (override)". */
function fieldLabel(field: string) {
  const [prefix, rest] = field.includes(".") ? field.split(".", 2) : ["", field]
  const label = CONTRACT_FIELD_LABELS[rest] ?? rest.replace(/_/g, " ")
  return prefix ? `${label} (${prefix.replace(/_/g, " ")})` : label
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

export function ActivityPanel({ token, contract }: { token: string; contract: ContractDetail }) {
  const [items, setItems] = React.useState<ContractActivityItem[] | null>(null)
  const [truncated, setTruncated] = React.useState(false)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    getContractActivity(token, contract.id)
      .then((result) => {
        setItems(result.items)
        setTruncated(result.truncated === true)
      })
      .catch(() => setError(true))
  }, [token, contract.id, contract.updatedAt])
  if (error) return null // readers without HR access do not see the audit trail
  return (
    <PanelSection title="Activity & audit" count={items?.length} defaultOpen={false}>
      {!items ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !items.length ? (
        <p className="text-muted-foreground">No activity yet.</p>
      ) : (
        <>
        {truncated ? <p className="mb-2 text-xs text-muted-foreground">Showing the most recent activity; older entries are not listed.</p> : null}
        <ol className="grid gap-2 border-l border-border pl-3">
          {items.map((item) => (
            <li key={item.id} className="grid gap-0.5">
              <span className={cn(item.outcome !== "SUCCESS" && "text-rose-700")}>
                {describe(item)}
                {item.outcome !== "SUCCESS" ? " (failed)" : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(item.at)}
                {item.actor_name ? ` · ${item.actor_name}` : ""}
                {item.detail ? ` · ${item.detail}` : ""}
              </span>
              {item.changed_fields.length ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-primary">{item.changed_fields.length} field(s) changed</summary>
                  <ul className="mt-1 grid gap-0.5">
                    {item.changed_fields.map((field) => (
                      <li key={field} className="break-words">
                        <span className="font-medium">{fieldLabel(field)}:</span>{" "}
                        {show(item.old_values?.[field])} → {show(item.new_values?.[field])}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
        </>
      )}
    </PanelSection>
  )
}
