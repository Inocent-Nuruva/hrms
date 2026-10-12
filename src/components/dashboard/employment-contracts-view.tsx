"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { FileText, Plus, RefreshCw, Upload } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"
import {
  attachEmploymentContract,
  issueEmploymentContract,
  listEmployees,
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

export function EmploymentContractsView() {
  const [access, setAccess] = React.useState("")
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [employeeId, setEmployeeId] = React.useState(0)
  const [contracts, setContracts] = React.useState<AdminRecord[]>([])
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [showForm, setShowForm] = React.useState(false)

  const selected = employees.find((employee) => Number(employee.id) === employeeId)

  React.useEffect(() => {
    const next = token()
    setAccess(next)
    if (!next) return
    void listEmployees(next, { page: 1, limit: 200 })
      .then((result) => setEmployees(result.rows))
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : "Employees could not be loaded"))
  }, [])

  const refresh = React.useCallback(async (id: number) => {
    if (!access || !id) return
    try { setContracts(await listEmploymentContracts(access, id)) }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Contracts could not be loaded") }
  }, [access])

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
    if (!access || !employeeId) return
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
      toast.success("Contract version issued")
      setShowForm(false)
      setForm({})
      await refresh(employeeId)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Contract could not be issued") }
    finally { setBusy(false) }
  }

  async function attach(id: number, file?: File) {
    if (!file || !access) return
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

  async function open(id: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/employment-contracts/${id}/document`, {
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
      <div><h2 className="text-lg font-semibold">Employment contracts</h2><p className="text-sm text-muted-foreground">Alliance Insurance Corporation Limited</p></div>
      <div className="flex items-end gap-2">
        <Field title="Employee"><FluentSelect ariaLabel="Employee" className="w-full min-w-52" value={employeeId ? String(employeeId) : ""} onChange={(value) => selectEmployee(Number(value))} placeholder="Select employee" options={[{ value: "", label: "Select employee" }, ...employees.map((employee) => ({ value: String(Number(employee.id)), label: employeeOptionLabel(employee) }))]} /></Field>
        <Button size="sm" variant="outline" disabled={!employeeId} onClick={() => void refresh(employeeId)} title="Refresh"><RefreshCw className="size-4" /></Button>
        <Button size="sm" disabled={!employeeId} onClick={() => { setForm({ start_date: String(selected?.hire_date ?? "").slice(0, 10), contract_type: "UNSPECIFIED" }); setShowForm(true) }}><Plus className="size-4" /> Contract</Button>
      </div>
    </div>

    {employeeId ? <section className="border-t">
      <div className="border-b py-3 text-sm font-semibold">Versions</div>
      {contracts.length ? contracts.map((contract) => <div key={Number(contract.id)} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
        <div><p className="font-medium">Version {String(contract.version)} · {String(contract.contractType).replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{String(contract.startDate)}{contract.endDate ? ` to ${String(contract.endDate)}` : ""} · {String(contract.status)}</p></div>
        <div className="flex gap-2">
          {contract.documentId ? <Button size="sm" variant="outline" onClick={() => void open(Number(contract.id))}><FileText className="size-4" /> Open</Button> : null}
          {contract.status === "ISSUED" ? <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-sm"><Upload className="size-4" /> Attach PDF<input className="sr-only" type="file" accept=".pdf" disabled={busy} onChange={(event) => void attach(Number(contract.id), event.target.files?.[0])} /></label> : null}
        </div>
      </div>) : <p className="py-6 text-sm text-muted-foreground">No contract versions yet.</p>}
    </section> : null}

    {showForm ? <form onSubmit={(event) => void issue(event)} className="border-t py-4">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">Issue contract</h3><Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div>
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
      <Button type="submit" className="mt-4" disabled={busy}>{busy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null} Issue version</Button>
    </form> : null}
  </div>
}
