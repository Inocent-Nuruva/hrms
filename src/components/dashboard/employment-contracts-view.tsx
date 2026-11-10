"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { Plus } from "lucide-react";
import {
  ArrowClockwise20Regular,
  ArrowUpload20Regular,
  DocumentPdf20Regular,
  History20Regular,
  Open20Regular,
} from "@fluentui/react-icons"
import { Button as FluentButton } from "@fluentui/react-components"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  attachEmploymentContract,
  issueEmploymentContract,
  listEmployees,
  listEmploymentContractSummary,
  listEmploymentContracts,
  type AdminRecord,
} from "@/lib/admin-api"
import { API_BASE_URL, AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Button } from "@/components/ui/button"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"

const fieldClass = "min-h-9 w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm"

function token() {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem("hrms.admin.accessToken")?.trim()
  if (direct) return direct
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens) ?? "{}")
    return String(stored.accessToken ?? stored.access_token ?? "")
  } catch { return "" }
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-muted-foreground"><span>{title}</span>{children}</label>
}

function employeeOptionLabel(employee: AdminRecord) {
  const nestedUser =
    typeof employee.user === "object" && employee.user !== null
      ? (employee.user as AdminRecord)
      : {}
  const firstName = String(
    employee.first_name ?? employee.firstName ?? nestedUser.first_name ?? nestedUser.firstName ?? "",
  ).trim()
  const lastName = String(
    employee.last_name ?? employee.lastName ?? nestedUser.last_name ?? nestedUser.lastName ?? "",
  ).trim()
  const composedName = [firstName, lastName].filter(Boolean).join(" ")
  const name = String(
    employee.full_name ??
      employee.fullName ??
      employee.display_name ??
      employee.displayName ??
      employee.name ??
      nestedUser.full_name ??
      nestedUser.fullName ??
      nestedUser.name ??
      composedName,
  ).trim()
  const employeeNumber = String(
    employee.employee_no ??
      employee.employeeNo ??
      employee.employee_number ??
      employee.employeeNumber ??
      employee.user_no ??
      nestedUser.user_no ??
      "",
  ).trim()

  if (name && employeeNumber) return `${name} · ${employeeNumber}`
  if (name) return name
  if (employeeNumber) return employeeNumber
  return `Employee #${String(employee.id ?? "")}`
}

export function EmploymentContractsView({ employee, canManage = true }: { employee?: AdminRecord; canManage?: boolean } = {}) {
  const [access, setAccess] = React.useState("")
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const scopedEmployeeId = Number(employee?.id ?? 0)
  const [employeeId, setEmployeeId] = React.useState(scopedEmployeeId)
  const [contracts, setContracts] = React.useState<AdminRecord[]>([])
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)
  const [employeeSearch, setEmployeeSearch] = React.useState("")
  const [contractFilter, setContractFilter] = React.useState<"all" | "contracted" | "not-contracted">("all")
  const [contractedEmployeeIds, setContractedEmployeeIds] = React.useState<Set<number> | null>(null)
  const [documentHistory, setDocumentHistory] = React.useState<Record<number, AdminRecord[]>>({})

  const selected = employee ?? employees.find((employee) => Number(employee.id) === employeeId)
  const normalizedSearch = employeeSearch.trim().toLowerCase()
  const filteredEmployees = React.useMemo(() => employees.filter((employee) => {
    const id = Number(employee.id)
    const hasContract = contractedEmployeeIds?.has(id) ?? false
    if (contractFilter === "contracted" && !hasContract) return false
    if (contractFilter === "not-contracted" && hasContract) return false
    return !normalizedSearch || employeeOptionLabel(employee).toLowerCase().includes(normalizedSearch)
  }), [contractFilter, contractedEmployeeIds, employees, normalizedSearch])

  React.useEffect(() => {
    const next = token()
    setAccess(next)
    if (!next) return
    if (scopedEmployeeId) return
    void listEmployees(next, { page: 1, limit: 200 })
      .then((result) => setEmployees(result.rows))
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : "Employees could not be loaded"))
    void listEmploymentContractSummary(next)
      .then((summary) => setContractedEmployeeIds(new Set(summary.map((item) => Number(item.employeeId ?? item.employee_id)).filter(Boolean))))
      .catch(() => setContractedEmployeeIds(null))
  }, [scopedEmployeeId])

  const refresh = React.useCallback(async (id: number) => {
    if (!access || !id) return
    try {
      const nextContracts = await listEmploymentContracts(access, id)
      setContracts(nextContracts)
      const histories = await Promise.all(nextContracts.map(async (contract) => {
        const contractId = Number(contract.id)
        const response = await fetch(`${API_BASE_URL}/api/employment-contracts/${contractId}/documents`, {
          headers: { Authorization: `Bearer ${access}` },
        })
        if (!response.ok) return [contractId, []] as const
        return [contractId, await response.json() as AdminRecord[]] as const
      }))
      setDocumentHistory(Object.fromEntries(histories))
    }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Contracts could not be loaded") }
  }, [access])

  React.useEffect(() => {
    if (!scopedEmployeeId || !access) return
    setEmployeeId(scopedEmployeeId)
    setContracts([])
    setShowForm(false)
    setForm({})
    void refresh(scopedEmployeeId)
  }, [access, scopedEmployeeId, refresh])

  function selectEmployee(id: number) {
    setEmployeeId(id)
    setContracts([])
    setShowForm(false)
    setForm({})
    void refresh(id)
  }

  function set(key: string, next: string) { setForm((current) => ({ ...current, [key]: next })) }

  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!access || !employeeId || !canManage) return
    setBusy(true)
    try {
      await issueEmploymentContract(access, {
        employee_id: employeeId,
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        employee_age: Number(form.employee_age),
        permanent_address: form.permanent_address,
        place_of_recruitment: form.place_of_recruitment,
        job_description: form.job_description,
        place_of_work: form.place_of_work,
        hours_of_work: form.hours_of_work,
        remuneration: form.remuneration,
        remuneration_method: form.remuneration_method,
        benefits: form.benefits,
      })
      toast.success("Contract draft created")
      setShowForm(false)
      setForm({})
      await refresh(employeeId)
      setContractedEmployeeIds((current) => current ? new Set(current).add(employeeId) : current)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Contract draft could not be created") }
    finally { setBusy(false) }
  }

  async function attach(id: number, file?: File) {
    if (!file || !access || !canManage) return
    if (file.type !== "application/pdf") { toast.error("Select a PDF contract"); return }
    setBusy(true)
    try {
      const fileString = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await attachEmploymentContract(access, id, { fileName: file.name, fileSize: file.size, mimeType: file.type, fileString })
      toast.success("Contract document attached")
      await refresh(employeeId)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Contract upload failed") }
    finally { setBusy(false) }
  }

  async function open(id: number, documentId?: number) {
    try {
      const suffix = documentId ? `/documents/${documentId}` : "/document"
      const response = await fetch(`${API_BASE_URL}/api/employment-contracts/${id}${suffix}`, {
        headers: { Authorization: `Bearer ${access}` },
      })
      if (!response.ok) throw new Error("Contract document could not be opened")
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Download failed") }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Employment contracts</h2><p className="text-sm text-muted-foreground">{employee ? employeeOptionLabel(employee) : "Issue and review employee contract versions"}</p></div>
      <div className="flex items-end gap-2">
        <FluentButton appearance="secondary" icon={<ArrowClockwise20Regular />} disabled={!employeeId} onClick={() => void refresh(employeeId)} title="Refresh contracts" aria-label="Refresh contracts" />
        {canManage ? <Button size="sm" disabled={!employeeId} onClick={() => { setForm({ start_date: String(selected?.hire_date ?? "").slice(0, 10), contract_type: "UNSPECIFIED" }); setShowForm(true) }}><Plus className="size-4" /> Contract</Button> : null}
      </div>
    </div>

    {!scopedEmployeeId ? <section className="space-y-3 border-y py-4">
      <div className="max-w-sm">
        <Field title="Search employees">
          <FluentSearchBox
            className="w-full"
            placeholder="Name or employee number"
            value={employeeSearch}
            onChange={(_, data) => setEmployeeSearch(data.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field title={`${filteredEmployees.length} employee${filteredEmployees.length === 1 ? "" : "s"}`}>
          <FluentSelect
            ariaLabel="Employee"
            className="w-full sm:w-[32rem]"
            value={employeeId && filteredEmployees.some((item) => Number(item.id) === employeeId) ? String(employeeId) : ""}
            onChange={(value) => selectEmployee(Number(value))}
            placeholder={filteredEmployees.length ? "Select employee" : "No employees match these filters"}
            options={[
              { value: "", label: filteredEmployees.length ? "Select employee" : "No employees match these filters" },
              ...filteredEmployees.map((item) => ({ value: String(Number(item.id)), label: employeeOptionLabel(item) })),
            ]}
          />
        </Field>
        {contractedEmployeeIds ? <div className="flex flex-wrap gap-2" role="group" aria-label="Contract status filter">
          {([
            ["all", "All", employees.length],
            ["contracted", "Contracted", contractedEmployeeIds.size],
            ["not-contracted", "Not contracted", Math.max(0, employees.length - contractedEmployeeIds.size)],
          ] as const).map(([value, label, count]) => <Button
            key={value}
            type="button"
            size="sm"
            variant={contractFilter === value ? "default" : "outline"}
            className="rounded-full px-2.5"
            aria-pressed={contractFilter === value}
            onClick={() => setContractFilter(value)}
          >{label} <span className="text-xs opacity-75">{count}</span></Button>)}
        </div> : null}
      </div>
    </section> : null}

    {employeeId ? <section className="border-t">
      <div className="border-b py-3 text-sm font-semibold">Versions</div>
      {contracts.length ? contracts.map((contract) => {
        const contractId = Number(contract.id)
        const documents = documentHistory[contractId] ?? []
        const hasDocument = Boolean(contract.documentId)
        return <article key={contractId} className="my-3 overflow-hidden rounded-lg border border-[#d7e3f4] bg-gradient-to-br from-[#f7fbff] via-background to-[#eef5ff] shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-background dark:to-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-lg bg-[#e5f1fb] p-2 text-[#0f6cbd] dark:bg-[#12395c]"><DocumentPdf20Regular /></div>
              <div>
                <p className="font-semibold">Version {String(contract.version)} · {String(contract.contractType).replaceAll("_", " ")}</p>
                <p className="text-xs text-muted-foreground">{String(contract.startDate)}{contract.endDate ? ` to ${String(contract.endDate)}` : ""} · {String(contract.status).replaceAll("_", " ").toLowerCase()}</p>
                {hasDocument && contract.status === "PENDING_EMPLOYEE_SIGNATURE" ? <p className="mt-1 text-xs font-medium text-[#8a6100]">PDF attached · awaiting employee signature</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasDocument ? <FluentButton appearance="secondary" icon={<Open20Regular />} onClick={() => void open(contractId)}>Open current PDF</FluentButton> : null}
              {canManage && (contract.status === "DRAFT" || contract.status === "PENDING_EMPLOYEE_SIGNATURE") ? <>
                <FluentButton appearance="primary" icon={<ArrowUpload20Regular />} disabled={busy} onClick={() => document.getElementById(`contract-pdf-${contractId}`)?.click()}>
                  {hasDocument ? "Reattach PDF" : "Attach PDF"}
                </FluentButton>
                <input id={`contract-pdf-${contractId}`} className="sr-only" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={(event) => void attach(contractId, event.target.files?.[0])} />
              </> : null}
            </div>
          </div>
          {documents.length ? <div className="border-t border-[#d7e3f4] bg-background/75 px-4 py-3 dark:border-slate-700">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History20Regular /> Document history</div>
            <div className="grid gap-2 md:grid-cols-2">
              {documents.map((document, index) => <button key={Number(document.id)} type="button" className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60" onClick={() => void open(contractId, Number(document.id))}>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{String(document.original_file_name ?? `Contract document ${index + 1}`)}</span><span className="block text-xs text-muted-foreground">{document.created_at ? new Date(String(document.created_at)).toLocaleString() : "Attached document"}{index === 0 ? " · Current" : ""}</span></span>
                <Open20Regular className="shrink-0" />
              </button>)}
            </div>
          </div> : null}
        </article>
      }) : <p className="py-6 text-sm text-muted-foreground">No contract versions yet.</p>}
    </section> : null}

    {showForm ? <form onSubmit={(event) => void issue(event)} className="border-t py-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">New contract draft</h3><Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field title="Contract type"><FluentSelect ariaLabel="Contract type" className="w-full" value={form.contract_type ?? ""} onChange={(value) => set("contract_type", value)} options={[{ value: "UNSPECIFIED", label: "Unspecified term" }, { value: "FIXED_TERM", label: "Fixed term" }, { value: "SPECIFIC_TASK", label: "Specific task" }]} /></Field>
        <Field title="Start date"><DateInput required value={form.start_date ?? ""} onChange={(event) => set("start_date", event.target.value)} /></Field>
        {form.contract_type === "FIXED_TERM" ? <Field title="End date"><DateInput required value={form.end_date ?? ""} onChange={(event) => set("end_date", event.target.value)} /></Field> : null}
        <Field title="Employee age"><Input required type="number" min="18" value={form.employee_age ?? ""} onChange={(event) => set("employee_age", event.target.value)} /></Field>
        <Field title="Permanent address"><Input required value={form.permanent_address ?? ""} onChange={(event) => set("permanent_address", event.target.value)} /></Field>
        <Field title="Place of recruitment"><Input required value={form.place_of_recruitment ?? ""} onChange={(event) => set("place_of_recruitment", event.target.value)} /></Field>
        <Field title="Place of work"><Input required value={form.place_of_work ?? ""} onChange={(event) => set("place_of_work", event.target.value)} /></Field>
        <Field title="Hours of work"><Input required value={form.hours_of_work ?? ""} onChange={(event) => set("hours_of_work", event.target.value)} /></Field>
        <Field title="Remuneration"><Input required value={form.remuneration ?? ""} onChange={(event) => set("remuneration", event.target.value)} /></Field>
        <Field title="Payment method"><Input required value={form.remuneration_method ?? ""} onChange={(event) => set("remuneration_method", event.target.value)} /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Field title="Job description"><Textarea required className={fieldClass} rows={3} value={form.job_description ?? ""} onChange={(event) => set("job_description", event.target.value)} /></Field></div>
        <div className="sm:col-span-2 lg:col-span-3"><Field title="Benefits"><Textarea required className={fieldClass} rows={2} value={form.benefits ?? ""} onChange={(event) => set("benefits", event.target.value)} /></Field></div>
      </div>
      <Button type="submit" className="mt-4" disabled={busy}>{busy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null} Create draft</Button>
    </form> : null}
  </div>
}
