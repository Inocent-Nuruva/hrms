"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Copy, Download, Eye, FileUp, Loader2, Send, Printer, XCircle } from "lucide-react"

import { FluentSelect } from "@/components/ui/fluent-select"
import { toast } from "@/components/ui/fluent-toast-store"
import { readStatusFieldErrors } from "@/lib/admin-api"
import {
  attachContractPdf,
  base64ToBlob,
  cancelContract,
  errorMessage,
  fetchContractFile,
  fileToBase64,
  duplicateContract,
  getContract,
  getContractFields,
  listContractTemplates,
  type ContractSection,
  type ContractField,
  listSignatories,
  previewContract,
  reassignContractSignatory,
  renewContract,
  saveBlob,
  sendContract,
  updateContractDraft,
  verifyContractUpload,
  type ContractDetail,
  type ContractType,
  type Signatory,
} from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

import { ClausesEditor } from "./contract-settings"
import { ContractFieldsPanel } from "./contract-fields-panel"
import { useContractDialogs } from "./contract-dialogs"
import { ActivityPanel, PanelSection, SignatoriesPanel, SummaryPanel, VersionsPanel } from "./contract-page-panels"
import { ContractSigningPanel } from "./contract-signing-panel"
import {
  CONTRACT_TYPE_LABELS,
  ContractPdfViewer,
  formatDate,
  formatDateTime,
} from "./contract-ui"

const input = "h-9 w-full rounded-md border border-border px-2.5 text-sm"
const btn = "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
const TERMINAL = ["SIGNED", "CANCELLED", "SUPERSEDED", "TERMINATED"]

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  )
}

type DraftForm = {
  contract_type: ContractType
  start_date: string
  end_date: string
  title: string
  job_title: string
  work_location: string
  place_of_recruitment: string
  job_description: string
  hours_of_work: string
  probation_months: string
  salary_amount: string
  salary_currency: string
  pay_frequency: string
  remuneration_method: string
  benefits: string
  assigned_signatory_id: string
}

function toForm(contract: ContractDetail): DraftForm {
  const p = contract.particulars ?? {}
  const s = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "")
  return {
    contract_type: contract.contractType,
    start_date: contract.startDate,
    end_date: contract.endDate ?? "",
    title: contract.title,
    job_title: contract.jobTitle ?? "",
    work_location: contract.workLocation ?? "",
    place_of_recruitment: s(p.place_of_recruitment),
    job_description: s(p.job_description),
    hours_of_work: contract.hoursOfWork ?? "",
    probation_months: contract.probationMonths == null ? "" : String(contract.probationMonths),
    salary_amount: contract.salaryAmount ?? "",
    salary_currency: contract.salaryCurrency ?? "",
    pay_frequency: contract.payFrequency ?? "",
    remuneration_method: s(p.remuneration_method),
    benefits: contract.benefits ?? "",
    assigned_signatory_id: contract.assignedSignatoryId ? String(contract.assignedSignatoryId) : "",
  }
}

function DraftEditor({
  token,
  contract,
  signatories,
  onSaved,
}: {
  token: string
  contract: ContractDetail
  signatories: Signatory[]
  onSaved: () => void
}) {
  const [form, setForm] = React.useState(() => toForm(contract))
  const [sections, setSections] = React.useState(contract.sections)
  const [busy, setBusy] = React.useState<"save" | "preview" | "send" | "attach" | null>(null)
  const [missing, setMissing] = React.useState<string[]>([])
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [dirty, setDirty] = React.useState(false)
  const [fields, setFields] = React.useState<ContractField[]>([])
  const [fieldEdits, setFieldEdits] = React.useState<Record<string, string>>({})
  const [templateSections, setTemplateSections] = React.useState<ContractSection[] | undefined>(undefined)

  // The template this draft came from, for "Changed from template" / "Reset".
  React.useEffect(() => {
    if (!contract.templateId) return
    listContractTemplates(token)
      .then((rows) => setTemplateSections(rows.find((row) => row.id === contract.templateId)?.sections))
      .catch(() => undefined)
  }, [token, contract.templateId])
  const attachInput = React.useRef<HTMLInputElement | null>(null)
  const { confirm, dialog } = useContractDialogs()

  // Reload field values whenever the saved draft changes.
  React.useEffect(() => {
    getContractFields(token, contract.id)
      .then((rows) => {
        setFields(rows)
        setFieldEdits({})
      })
      .catch(() => undefined)
  }, [token, contract.id, contract.updatedAt])

  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const set = (key: keyof DraftForm) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }
  const text = (key: keyof DraftForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(event.target.value)

  const save = async () => {
    setBusy("save")
    setFieldErrors({})
    try {
      await updateContractDraft(token, contract.id, {
        expected_updated_at: contract.updatedAt,
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        title: form.title,
        job_title: form.job_title,
        work_location: form.work_location,
        place_of_recruitment: form.place_of_recruitment,
        job_description: form.job_description,
        hours_of_work: form.hours_of_work,
        probation_months: form.probation_months === "" ? null : Number(form.probation_months),
        ...(contract.salaryHidden ? {} : { salary_amount: form.salary_amount || null }),
        salary_currency: form.salary_currency || null,
        pay_frequency: form.pay_frequency || null,
        remuneration_method: form.remuneration_method,
        benefits: form.benefits,
        sections,
        ...(Object.keys(fieldEdits).length ? { field_overrides: fieldEdits } : {}),
        ...(form.assigned_signatory_id ? { assigned_signatory_id: Number(form.assigned_signatory_id) } : {}),
      })
      setDirty(false)
      toast.success("Draft saved")
      onSaved()
      return true
    } catch (cause) {
      const errors = readStatusFieldErrors(cause)
      setFieldErrors(errors)
      // Clause rules come back per clause; show their exact wording.
      const clauseMessages = Object.entries(errors)
        .filter(([key]) => key.startsWith("sections."))
        .map(([, message]) => message)
      toast.error(clauseMessages.length ? clauseMessages.join(" ") : errorMessage(cause, "Could not save the draft"))
      return false
    } finally {
      setBusy(null)
    }
  }

  const preview = async (download = false) => {
    if (dirty && !(await save())) return
    setBusy("preview")
    try {
      const result = await previewContract(token, contract.id)
      setMissing(result.missing_fields)
      const blob = base64ToBlob(result.content_base64)
      if (download) saveBlob(blob, result.file_name)
      else setPreviewUrl(URL.createObjectURL(blob))
    } catch (cause) {
      toast.error(errorMessage(cause, "Preview failed"))
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    if (dirty && !(await save())) return
    const ok = await confirm({
      title: "Send for signature?",
      message: "The content is locked and the company signatory is asked to sign first. After that the employee signs.",
      confirmLabel: "Send for signature",
    })
    if (!ok) return
    setBusy("send")
    setFieldErrors({})
    try {
      await sendContract(token, contract.id, form.assigned_signatory_id ? Number(form.assigned_signatory_id) : null)
      toast.success("Sent to the company signatory")
      onSaved()
    } catch (cause) {
      const errors = readStatusFieldErrors(cause)
      setFieldErrors(errors)
      const payload = (cause as { payload?: { missing_fields?: unknown } }).payload
      if (Array.isArray(payload?.missing_fields)) setMissing(payload.missing_fields.map(String))
      toast.error(errorMessage(cause, "Could not send"))
    } finally {
      setBusy(null)
    }
  }

  const attach = async (file?: File) => {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("Select a PDF")
      return
    }
    if (attachInput.current) attachInput.current.value = ""
    const ok = await confirm({
      title: "Use your own PDF?",
      message: "This PDF replaces the generated contract and is sent for signature as-is. The company signs first.",
      confirmLabel: "Use this PDF and send",
    })
    if (!ok) return
    setBusy("attach")
    try {
      await attachContractPdf(token, contract.id, await fileToBase64(file))
      toast.success("PDF attached and sent to the company signatory")
      onSaved()
    } catch (cause) {
      toast.error(errorMessage(cause, "Upload failed"))
    } finally {
      setBusy(null)
      if (attachInput.current) attachInput.current.value = ""
    }
  }

  const needsEnd = form.contract_type !== "UNSPECIFIED"

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {dialog}
      <div className="grid content-start gap-4">
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h3 className="text-base font-semibold">Contract details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contract type">
              <FluentSelect ariaLabel="Contract type" value={form.contract_type} onChange={set("contract_type")} options={(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((value) => ({ value, label: CONTRACT_TYPE_LABELS[value] }))} />
            </Field>
            <Field label="Title">
              <input className={input} value={form.title} onChange={text("title")} />
            </Field>
            <Field label="Start date" error={fieldErrors.start_date}>
              <input type="date" className={input} value={form.start_date} onChange={text("start_date")} />
            </Field>
            {needsEnd ? (
              <Field label="End date" error={fieldErrors.end_date}>
                <input type="date" className={input} value={form.end_date} min={form.start_date} onChange={text("end_date")} />
              </Field>
            ) : null}
            <Field label="Job title">
              <input className={input} value={form.job_title} onChange={text("job_title")} />
            </Field>
            <Field label="Place of work">
              <input className={input} value={form.work_location} onChange={text("work_location")} />
            </Field>
            <Field label="Place of recruitment">
              <input className={input} value={form.place_of_recruitment} onChange={text("place_of_recruitment")} />
            </Field>
            <Field label="Probation (months)">
              <input type="number" min={0} max={24} className={input} value={form.probation_months} onChange={text("probation_months")} />
            </Field>
            <Field label="Hours of work">
              <input className={input} placeholder="e.g. 08:00–17:00, Monday to Friday" value={form.hours_of_work} onChange={text("hours_of_work")} />
            </Field>
            <Field label="Basic salary">
              {contract.salaryHidden ? (
                <p className="rounded-md border border-border bg-slate-50 px-2.5 py-1.5 text-sm text-muted-foreground">
                  Hidden — set by a user with payroll access. Your changes keep it as it is.
                </p>
              ) : (
              <div className="flex gap-2">
                <input className={cn(input, "w-20")} placeholder="TZS" value={form.salary_currency} onChange={text("salary_currency")} aria-label="Currency" />
                <input className={input} inputMode="decimal" value={form.salary_amount} onChange={text("salary_amount")} aria-label="Amount" />
              </div>
              )}
            </Field>
            <Field label="Pay frequency">
              <FluentSelect ariaLabel="Pay frequency" value={form.pay_frequency} onChange={set("pay_frequency")} options={[{ value: "", label: "Not set" }, { value: "MONTHLY", label: "Monthly" }, { value: "BIWEEKLY", label: "Every two weeks" }, { value: "WEEKLY", label: "Weekly" }, { value: "DAILY", label: "Daily" }]} />
            </Field>
            <Field label="Payment method">
              <input className={input} placeholder="e.g. bank transfer" value={form.remuneration_method} onChange={text("remuneration_method")} />
            </Field>
            <Field label="Company signatory" error={fieldErrors.assigned_signatory_id}>
              <FluentSelect ariaLabel="Company signatory" value={form.assigned_signatory_id} onChange={set("assigned_signatory_id")} options={[{ value: "", label: "Automatic (company rules)" }, ...signatories.filter((row) => row.isActive && row.employeeId !== contract.employeeId).map((row) => ({ value: String(row.id), label: `${row.displayName} — ${row.jobTitle}` }))]} />
            </Field>
          </div>
          <Field label="Job description">
            <textarea className="min-h-16 rounded-md border border-border px-2.5 py-1.5 text-sm" value={form.job_description} onChange={text("job_description")} />
          </Field>
          <Field label="Allowances and benefits">
            <textarea className="min-h-12 rounded-md border border-border px-2.5 py-1.5 text-sm" value={form.benefits} onChange={text("benefits")} />
          </Field>
        </section>
        {fields.length ? (
          <ContractFieldsPanel
            fields={fields}
            overrides={fieldEdits}
            onChange={(key, value) => {
              setFieldEdits((current) => ({ ...current, [key]: value }))
              setDirty(true)
            }}
          />
        ) : null}
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h3 className="text-base font-semibold">Clauses</h3>
          <ClausesEditor
            sections={sections}
            templateSections={templateSections}
            onChange={(next) => {
              setSections(next)
              setDirty(true)
            }}
          />
        </section>
      </div>

      <div className="grid content-start gap-3 lg:sticky lg:top-4">
        {missing.length ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">Fill these in before sending:</p>
            <p className="text-xs">{missing.map((key) => key.replace(/_/g, " ")).join(", ")}</p>
            <p className="mt-1 text-xs">
              Company fields are set under{" "}
              <Link href="/dashboard/employees/contracts?tab=company" className="font-medium underline">
                Contracts → Company details
              </Link>
              .
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(btn, "border border-border")} disabled={!!busy} onClick={() => void save()}>
            {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null} Save draft
          </button>
          <button type="button" className={cn(btn, "border border-border")} disabled={!!busy} onClick={() => void preview()}>
            {busy === "preview" ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Preview PDF
          </button>
          <button type="button" className={cn(btn, "border border-border")} disabled={!!busy} onClick={() => void preview(true)}>
            <Download className="size-4" /> Download draft
          </button>
          <button type="button" className={cn(btn, "bg-primary text-primary-foreground")} disabled={!!busy} onClick={() => void send()}>
            {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send for signature
          </button>
        </div>
        <button type="button" className="w-fit text-xs font-medium text-primary hover:underline" onClick={() => attachInput.current?.click()} disabled={!!busy}>
          <FileUp className="mr-1 inline size-3.5" /> Use an externally prepared PDF instead
        </button>
        <input ref={attachInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => void attach(event.target.files?.[0])} />
        {previewUrl ? (
          <iframe title="Contract preview" src={previewUrl} className="hidden h-[75vh] w-full rounded-md border border-border bg-white sm:block" />
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            Preview the PDF to see the contract exactly as it will be sent (watermarked “DRAFT”).
          </p>
        )}
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary sm:hidden">
            Open preview
          </a>
        ) : null}
      </div>
    </div>
  )
}

function VerifyUpload({ token, contract, onDone }: { token: string; contract: ContractDetail; onDone: () => void }) {
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const decide = async (outcome: "ACCEPT" | "REJECT") => {
    setBusy(true)
    try {
      await verifyContractUpload(token, contract.id, outcome, outcome === "REJECT" ? reason.trim() : undefined)
      toast.success(outcome === "ACCEPT" ? "Contract completed" : "Upload rejected; the employee was notified")
      onDone()
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not record the decision"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
      <div>
        <h3 className="text-sm font-semibold">Verify the employee’s signed upload</h3>
        <p className="text-xs text-muted-foreground">Compare it with the company-signed version: same pages, signed where required.</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium">Employee upload</p>
          <ContractPdfViewer token={token} contractId={contract.id} documentId={contract.pendingUploadDocumentId} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">Company-signed version</p>
          <ContractPdfViewer token={token} contractId={contract.id} documentId={contract.companySignedDocumentId} />
        </div>
      </div>
      <textarea className="min-h-12 rounded-md border border-border px-2.5 py-1.5 text-sm" placeholder="Reason (required to reject)" value={reason} onChange={(event) => setReason(event.target.value)} />
      <div className="flex gap-2">
        <button type="button" className={cn(btn, "bg-emerald-600 text-white")} disabled={busy} onClick={() => void decide("ACCEPT")}>
          Accept
        </button>
        <button type="button" className={cn(btn, "border border-rose-300 text-rose-700")} disabled={busy || reason.trim().length < 3} onClick={() => void decide("REJECT")}>
          Reject
        </button>
      </div>
    </section>
  )
}

function RenewPanel({ token, contract, movementId }: { token: string; contract: ContractDetail; movementId: number | null }) {
  const [kind, setKind] = React.useState<"RENEWAL" | "AMENDMENT">(movementId ? "AMENDMENT" : "RENEWAL")
  const [reason, setReason] = React.useState(movementId ? "Employee movement applied" : "")
  const [endDate, setEndDate] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const draft = await renewContract(token, contract.id, {
        kind,
        reason: reason.trim(),
        ...(endDate ? { end_date: endDate } : {}),
        ...(movementId ? { source_movement_id: movementId } : {}),
      })
      toast.success("New draft created; the current contract stays valid until it is signed")
      window.location.assign(`/dashboard/employees/contracts/${draft.id}`)
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not create the new version"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="grid gap-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{movementId ? "Contract amendment suggested" : "Renew or amend"}</h3>
      {movementId ? <p className="text-xs text-muted-foreground">A promotion, transfer or salary change was applied. Prepare an amendment if contract terms changed.</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <FluentSelect ariaLabel="Kind" value={kind} onChange={(value) => setKind(value as "RENEWAL" | "AMENDMENT")} options={[{ value: "RENEWAL", label: "Renewal" }, { value: "AMENDMENT", label: "Amendment" }]} />
        <input className={input} placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason" />
        <input type="date" className={input} value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="New end date (optional)" />
      </div>
      <button type="button" className={cn(btn, "w-fit bg-primary text-primary-foreground")} disabled={busy || reason.trim().length < 3} onClick={() => void submit()}>
        Prepare new version
      </button>
    </section>
  )
}

/** Opens the PDF in a hidden frame and starts the browser's print dialog. */
async function printContract(token: string, contractId: number) {
  const file = await fetchContractFile(token, contractId)
  const url = URL.createObjectURL(file.blob)
  const frame = document.createElement("iframe")
  frame.style.position = "fixed"
  frame.style.width = "0"
  frame.style.height = "0"
  frame.style.border = "0"
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, "_blank", "noopener")
    }
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  document.body.appendChild(frame)
}

export function ContractDetailView({ contractId, token }: { contractId: number; token: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const amendMovement = Number(searchParams?.get("amend_movement")) || null
  const [contract, setContract] = React.useState<ContractDetail | null>(null)
  const [signatories, setSignatories] = React.useState<Signatory[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [opened, setOpened] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const replaceInput = React.useRef<HTMLInputElement | null>(null)
  const { confirm, askReason, dialog } = useContractDialogs()

  const load = React.useCallback(async () => {
    if (!token) return
    try {
      setContract(await getContract(token, contractId))
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause, "Contract not found"))
    }
  }, [token, contractId])

  React.useEffect(() => {
    void load()
    listSignatories(token).then(setSignatories).catch(() => undefined)
  }, [load, token])

  if (error) return <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
  if (!contract)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading contract…
      </p>
    )

  const isDraft = contract.status === "DRAFT"
  // Redesigned drafts are edited in the step-by-step editor.
  const liveDraft = isDraft && contract.canManage && contract.particulars?.mode === "live"
  const canManage = contract.canManage
  const awaitingCompany = contract.status === "PENDING_HR_SIGNATURE"
  const canReplace = ["PENDING_HR_SIGNATURE", "PENDING_EMPLOYEE_SIGNATURE", "ISSUED"].includes(contract.status)

  const doCancel = async () => {
    const reason = await askReason({
      title: "Cancel this contract?",
      message: "The contract can no longer be signed. This is recorded in the audit trail.",
      confirmLabel: "Cancel contract",
      tone: "danger",
      placeholder: "Why is this contract being cancelled?",
    })
    if (!reason) return
    try {
      await cancelContract(token, contract.id, reason)
      toast.success("Contract cancelled")
      await load()
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not cancel"))
    }
  }

  const replace = async (file?: File) => {
    if (replaceInput.current) replaceInput.current.value = ""
    if (!file) return
    const ok = await confirm({
      title: "Replace the sent PDF?",
      message:
        "The sent PDF is locked. Replacing it cancels this version and issues a new version that the company and the employee must sign again.",
      confirmLabel: "Replace and issue new version",
    })
    if (!ok) return
    try {
      const result = await attachContractPdf(token, contract.id, await fileToBase64(file))
      toast.success("New version issued")
      router.push(`/dashboard/employees/contracts/${String(result.contract_id ?? contract.id)}`)
    } catch (cause) {
      toast.error(errorMessage(cause, "Upload failed"))
    }
  }

  const duplicate = async () => {
    const ok = await confirm({
      title: "Duplicate as a new draft?",
      message: "A new draft is created for the same employee with these terms and clauses. This contract is not changed.",
      confirmLabel: "Create draft",
    })
    if (!ok) return
    setBusy(true)
    try {
      const draft = await duplicateContract(token, contract)
      toast.success("Draft created")
      router.push(`/dashboard/employees/contracts/${draft.id}`)
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not duplicate"))
    } finally {
      setBusy(false)
    }
  }

  const download = () =>
    void fetchContractFile(token, contract.id)
      .then((file) => saveBlob(file.blob, file.fileName))
      .catch((cause: unknown) => toast.error(errorMessage(cause, "Download failed")))

  const actionButton = "w-full justify-start border border-border bg-white"

  return (
    <div className="grid min-w-0 gap-4">
      {dialog}
      <Link href="/dashboard/employees/contracts" className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" /> Contracts
      </Link>
      <header className="min-w-0">
        <h2 className="break-words text-xl font-semibold">
          {contract.referenceNo} · v{contract.version} · {contract.title}
        </h2>
        <p className="break-words text-sm text-muted-foreground">
          {contract.employeeName} ({contract.employeeNo}) · {CONTRACT_TYPE_LABELS[contract.contractType]}
        </p>
      </header>

      {contract.status === "TERMINATED" || contract.endedAt ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {contract.status === "TERMINATED" ? "Ended" : "Ends"} on {formatDate(contract.endedAt)} because the employee exited
          {contract.endReason ? ` (${contract.endReason})` : ""}.
        </p>
      ) : null}
      {contract.status === "CANCELLED" && contract.cancelReason ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Cancelled: {contract.cancelReason}</p>
      ) : null}

      {liveDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
          <p className="text-sm">This draft is edited step by step, with a live preview.</p>
          <Link href={`/dashboard/employees/contracts/${contract.id}/edit`} className={cn(btn, "bg-primary text-primary-foreground")}>
            Continue editing
          </Link>
        </div>
      ) : null}
      {isDraft && canManage && !liveDraft ? (
        <>
          <DraftEditor token={token} contract={contract} signatories={signatories} onSaved={() => void load()} />
          <div className="grid gap-3 lg:grid-cols-2">
            <VersionsPanel token={token} contract={contract} />
            <ActivityPanel token={token} contract={contract} />
          </div>
        </>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
          {/* Side panel: first on phones, right-hand column on large screens. */}
          <aside className="grid min-w-0 content-start gap-3 lg:order-2">
            <SummaryPanel contract={contract} />
            <SignatoriesPanel contract={contract} />

            <PanelSection title="Actions">
              <div className="grid gap-2">
                {contract.documentId ? (
                  <>
                    <button type="button" className={cn(btn, actionButton)} onClick={download}>
                      <Download className="size-4" /> Download PDF
                    </button>
                    <button
                      type="button"
                      className={cn(btn, actionButton)}
                      onClick={() => void printContract(token, contract.id).catch((cause: unknown) => toast.error(errorMessage(cause, "Could not print")))}
                    >
                      <Printer className="size-4" /> Print
                    </button>
                  </>
                ) : null}
                {canManage ? (
                  <button type="button" className={cn(btn, actionButton)} disabled={busy} onClick={() => void duplicate()}>
                    <Copy className="size-4" /> Duplicate as new draft
                  </button>
                ) : null}
                {canManage && canReplace ? (
                  <>
                    <button type="button" className={cn(btn, actionButton)} onClick={() => replaceInput.current?.click()}>
                      <FileUp className="size-4" /> Replace PDF (new version)
                    </button>
                    <input ref={replaceInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => void replace(event.target.files?.[0])} />
                  </>
                ) : null}
                {canManage && awaitingCompany ? (
                  <label className="grid gap-1 text-xs">
                    <span className="text-muted-foreground">Company signatory</span>
                    <FluentSelect
                      ariaLabel="Reassign signatory"
                      value={contract.assignedSignatoryId ? String(contract.assignedSignatoryId) : ""}
                      onChange={(value) =>
                        void reassignContractSignatory(token, contract.id, Number(value))
                          .then(() => load())
                          .catch((cause: unknown) => toast.error(errorMessage(cause, "Could not reassign")))
                      }
                      options={signatories
                        .filter((row) => row.isActive && row.employeeId !== contract.employeeId)
                        .map((row) => ({ value: String(row.id), label: `${row.displayName} — ${row.jobTitle}` }))}
                    />
                  </label>
                ) : null}
                {canManage && !TERMINAL.includes(contract.status) ? (
                  <button type="button" className={cn(btn, actionButton, "text-rose-700")} onClick={() => void doCancel()}>
                    <XCircle className="size-4" /> Cancel contract
                  </button>
                ) : null}
              </div>
            </PanelSection>

            <VersionsPanel token={token} contract={contract} />
            {contract.files.length ? (
              <PanelSection title="Files" count={contract.files.length} defaultOpen={false}>
                <ul className="grid gap-1">
                  {contract.files.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className="text-left text-primary hover:underline"
                        onClick={() =>
                          void fetchContractFile(token, contract.id, file.id)
                            .then((result) => saveBlob(result.blob, result.fileName))
                            .catch((cause: unknown) => toast.error(errorMessage(cause, "Download failed")))
                        }
                      >
                        {(file.document_type ?? "file").replace(/^CONTRACT_/, "").replace(/_/g, " ").toLowerCase()}
                      </button>
                      {file.current ? <span className="ml-1 text-xs text-emerald-700">current</span> : null}
                      <span className="block text-xs text-muted-foreground">{formatDateTime(file.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}
            <ActivityPanel token={token} contract={contract} />
          </aside>

          <div className="grid min-w-0 content-start gap-4 lg:order-1">
            {contract.status === "PENDING_VERIFICATION" && canManage ? (
              <VerifyUpload token={token} contract={contract} onDone={() => void load()} />
            ) : null}
            {contract.signing.my_party || (awaitingCompany && canManage) ? (
              <ContractSigningPanel
                token={token}
                contract={contract}
                signerName={contract.signing.my_party === "COMPANY" ? (contract.signatory?.displayName ?? "") : (contract.employeeName ?? "")}
                attestOnBehalf={awaitingCompany && canManage && !contract.signing.my_party}
                opened={opened}
                onChanged={() => void load()}
              />
            ) : null}
            {!isDraft ? (
              <ContractPdfViewer token={token} contractId={contract.id} documentId={contract.signing.current_document_id} onLoaded={() => setOpened(true)} />
            ) : null}
            {contract.status === "SIGNED" && canManage ? <RenewPanel token={token} contract={contract} movementId={amendMovement} /> : null}
          </div>
        </div>
      )}
    </div>
  )
}
