"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Download, Loader2 } from "lucide-react"

import { toast } from "@/components/ui/fluent-toast-store"
import {
  errorMessage,
  fetchContractFile,
  getContract,
  listMyContracts,
  mySignatoryStatus,
  readAccessToken,
  saveBlob,
  type ContractDetail,
  type ContractRow,
} from "@/lib/contracts-api"

import { ContractSigningPanel } from "./contract-signing-panel"
import { CONTRACT_TYPE_LABELS, ContractPdfViewer, ContractStatusBadge, ContractValidityText, formatDate } from "./contract-ui"

const ACTION_NEEDED = ["PENDING_EMPLOYEE_SIGNATURE", "ISSUED"]

/** Employee self-service: my contracts, pending ones first. */
export function MyContractsView() {
  const [token, setToken] = React.useState("")
  const [rows, setRows] = React.useState<ContractRow[] | null>(null)
  const [signatoryContracts, setSignatoryContracts] = React.useState<
    NonNullable<Awaited<ReturnType<typeof mySignatoryStatus>>["contracts"]>
  >([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => setToken(readAccessToken()), [])
  React.useEffect(() => {
    if (!token) return
    listMyContracts(token)
      .then((result) =>
        setRows(
          [...result].sort(
            (a, b) => Number(ACTION_NEEDED.includes(b.status)) - Number(ACTION_NEEDED.includes(a.status)) || b.version - a.version,
          ),
        ),
      )
      .catch((cause: unknown) => setError(errorMessage(cause, "Could not load your contracts")))
    mySignatoryStatus(token)
      .then((result) => setSignatoryContracts(result.contracts ?? []))
      .catch(() => undefined)
  }, [token])

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">My contracts</h2>
        <p className="text-sm text-muted-foreground">View, download and sign your employment contracts.</p>
      </div>
      {signatoryContracts.length ? (
        <section className="grid gap-2" aria-label="Contracts to sign for the company">
          <div>
            <h3 className="text-base font-semibold">Contracts to sign for the company</h3>
            <p className="text-sm text-muted-foreground">
              You are the company signatory on these contracts.{" "}
              {(() => {
                const waiting = signatoryContracts.filter((c) => c.status === "PENDING_HR_SIGNATURE").length
                return waiting ? `${waiting} ${waiting === 1 ? "is" : "are"} waiting for your signature.` : "None are waiting for you right now."
              })()}
            </p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {signatoryContracts.map((row) => {
              const waiting = row.status === "PENDING_HR_SIGNATURE"
              return (
                <li key={row.id}>
                  <Link href={`/dashboard/me/contracts/${row.id}`} className="grid gap-1 px-4 py-3 hover:bg-slate-50">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {row.employeeName || "Employee"}
                        {row.employeeNo ? <span className="text-sm font-normal text-muted-foreground"> · {row.employeeNo}</span> : null}
                      </span>
                      <ContractStatusBadge status={row.status} />
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {row.title} · {row.referenceNo} · {CONTRACT_TYPE_LABELS[row.contractType]} · {formatDate(row.startDate)} –{" "}
                      {row.endDate ? formatDate(row.endDate) : "open"}
                      {waiting ? <span className="font-medium text-amber-700">Sign now</span> : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      {signatoryContracts.length ? <h3 className="text-base font-semibold">My own contracts</h3> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!rows ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : rows.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/dashboard/me/contracts/${row.id}`} className="grid gap-1 px-4 py-3 hover:bg-slate-50">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {row.title} <span className="text-sm font-normal text-muted-foreground">· {row.referenceNo}</span>
                  </span>
                  <ContractStatusBadge status={row.status} />
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {CONTRACT_TYPE_LABELS[row.contractType]} · {formatDate(row.startDate)} – {row.endDate ? formatDate(row.endDate) : "open"}
                  <ContractValidityText validity={row.validity} />
                  {ACTION_NEEDED.includes(row.status) ? <span className="font-medium text-amber-700">Action required</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">You have no contracts yet.</p>
      )}
    </div>
  )
}

/** Contract viewer for the employee or the company signatory. */
export function MyContractViewer({ contractId }: { contractId: number }) {
  const [token, setToken] = React.useState("")
  const [contract, setContract] = React.useState<ContractDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [opened, setOpened] = React.useState(false)

  React.useEffect(() => setToken(readAccessToken()), [])
  const load = React.useCallback(async () => {
    if (!token) return
    try {
      setContract(await getContract(token, contractId))
    } catch (cause) {
      setError(errorMessage(cause, "Contract not found"))
    }
  }, [token, contractId])
  React.useEffect(() => void load(), [load])

  if (error) return <p className="text-sm text-rose-600">{error}</p>
  if (!contract)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    )


  const party = contract.signing.my_party
  return (
    <div className="grid gap-4">
      <Link href="/dashboard/me/contracts" className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" /> My contracts
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{contract.title}</h2>
          <p className="text-sm text-muted-foreground">
            {contract.referenceNo} · version {contract.version}
            {party === "COMPANY" ? ` · ${contract.employeeName}` : ""}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            <ContractValidityText validity={contract.validity} />
          </div>
        </div>
        {contract.can_view_document ? <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium"
          onClick={() =>
            void fetchContractFile(token, contract.id)
              .then((file) => saveBlob(file.blob, file.fileName))
              .catch((cause: unknown) => toast.error(errorMessage(cause, "Download failed")))
          }
        >
          <Download className="size-4" /> {contract.status === "SIGNED" ? "Download signed contract" : "Download PDF"}
        </button> : null}
      </header>

      {contract.status === "PENDING_VERIFICATION" ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Your signed copy was uploaded. HR is checking it; you will be notified when the contract is complete.
        </p>
      ) : null}
      {contract.status === "PENDING_HR_SIGNATURE" && party !== "COMPANY" ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          The company signs first. You will be asked to sign once it has.
        </p>
      ) : null}

      {party ? (
        <ContractSigningPanel
          token={token}
          contract={contract}
          signerName={party === "COMPANY" ? (contract.signatory?.displayName ?? "") : (contract.employeeName ?? "")}
          opened={opened}
          onChanged={() => void load()}
        />
      ) : null}

      {contract.can_view_document ? <ContractPdfViewer token={token} contractId={contract.id} documentId={contract.signing.current_document_id} onLoaded={() => setOpened(true)} /> : null}
    </div>
  )
}
