"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import { DateTimeInput } from "@/components/ui/date-time-input"
import * as React from "react"
import { FileText, Plus, RefreshCw, Upload } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"
import {
  listEmployees,
  listOnboardingWorkflows,
  listPositions,
  listRecruitmentCandidates,
  listRecruitmentRequests,
  listAllCurrentCompanyUsers,
  recruitmentCommand,
  type AdminRecord,
} from "@/lib/admin-api"
import { API_BASE_URL, AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Button } from "@/components/ui/button"
import { Dropdown, Option } from "@/components/ui/dropdown"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogFooter, DialogHeader, DialogPopup, DialogTitle,
} from "@/components/animate-ui/components/base/dialog"

type FormMode = "request" | "candidate" | "interview" | "score" | "check" | "offer" | "convert"

function readToken() {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem("hrms.admin.accessToken")?.trim()
  if (direct) return direct
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens) ?? "{}")
    return String(stored.accessToken ?? stored.access_token ?? "")
  } catch { return "" }
}

function idOf(row: AdminRecord) { return Number(row.id ?? 0) }
function value(row: AdminRecord, key: string) { return String(row[key] ?? "") }
function label(row: AdminRecord) {
  const firstName = value(row, "first_name") || value(row, "firstName") || value(row, "given_name") || value(row, "givenName")
  const lastName = value(row, "last_name") || value(row, "lastName") || value(row, "family_name") || value(row, "familyName")
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  const displayName = ["display_name", "displayName", "full_name", "fullName", "employee_name", "employeeName", "name", "preferred_name", "preferredName"]
    .map((key) => value(row, key).trim())
    .find(Boolean)
  const employeeNo = value(row, "employee_no") || value(row, "employeeNo")
  const personName = fullName || displayName
  if (personName && employeeNo && !personName.includes(employeeNo)) return `${personName} · ${employeeNo}`
  if (personName) return personName
  if (employeeNo) return `Employee ${employeeNo}`
  return `Unnamed employee · #${idOf(row)}`
}
function status(row: AdminRecord) { return value(row, "status") }

const fieldClass = "min-h-9 w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm"

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-muted-foreground"><span>{title}</span>{children}</label>
}

export function RecruitmentPipelineView() {
  const [token, setToken] = React.useState("")
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [candidates, setCandidates] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [users, setUsers] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])
  const [requestId, setRequestId] = React.useState<number | null>(null)
  const [candidateId, setCandidateId] = React.useState<number | null>(null)
  const [mode, setMode] = React.useState<FormMode | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const request = requests.find((row) => idOf(row) === requestId)
  const candidate = candidates.find((row) => idOf(row) === candidateId)

  const refresh = React.useCallback(async (accessToken: string, selectedRequestId?: number | null) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [nextRequests, nextCandidates] = await Promise.all([
        listRecruitmentRequests(accessToken),
        selectedRequestId ? listRecruitmentCandidates(accessToken, selectedRequestId) : Promise.resolve([]),
      ])
      setRequests(nextRequests)
      setCandidates(nextCandidates)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Recruitment records could not be loaded")
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => {
    const accessToken = readToken()
    setToken(accessToken)
    if (!accessToken) return
    void refresh(accessToken)
    void Promise.allSettled([
      listPositions(accessToken, { page: 1, limit: 200 }),
      listEmployees(accessToken, { page: 1, limit: 200 }),
      listAllCurrentCompanyUsers(accessToken),
      listOnboardingWorkflows(accessToken),
    ]).then(([p, e, u, w]) => {
      if (p.status === "fulfilled") setPositions(p.value.rows)
      if (e.status === "fulfilled") setEmployees(e.value.rows)
      if (u.status === "fulfilled") setUsers(u.value)
      if (w.status === "fulfilled") setWorkflows(w.value.rows)
    })
  }, [refresh])

  async function selectRequest(id: number) {
    setRequestId(id)
    setCandidateId(null)
    if (token) await refresh(token, id)
  }

  async function command(path: string, body?: Record<string, unknown>) {
    if (!token) return
    setBusy(true)
    try {
      await recruitmentCommand(token, path, body)
      toast.success("Recruitment record updated")
      setMode(null)
      setForm({})
      await refresh(token, requestId)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The action could not be completed")
    } finally { setBusy(false) }
  }

  function open(next: FormMode) { setForm({}); setMode(next) }
  function set(key: string, next: string) { setForm((current) => ({ ...current, [key]: next })) }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "request") return command("requests", {
      position_id: Number(form.position_id), manager_employee_id: Number(form.manager_employee_id),
      vacancies: Number(form.vacancies), budget_amount: form.budget_amount,
      job_title: form.job_title, job_description: form.job_description,
      closes_on: form.closes_on || undefined,
    })
    if (mode === "candidate" && requestId) return command(`requests/${requestId}/candidates`, {
      first_name: form.first_name, last_name: form.last_name, gender: form.gender,
      email: form.email, phone: form.phone,
    })
    if (!candidateId) return
    if (mode === "interview") return command(`candidates/${candidateId}/interview`, {
      scheduled_at: new Date(form.scheduled_at).toISOString(), location: form.location,
      panel_company_user_ids: form.panel_ids.split(",").map(Number).filter(Boolean),
    })
    if (mode === "score") return command(`candidates/${candidateId}/interview/score`, {
      score: Number(form.score), comments: form.comments,
    })
    if (mode === "check") return command(`candidates/${candidateId}/checks`, {
      type: form.type, result: form.result, evidence_note: form.evidence_note,
    })
    if (mode === "offer") return command(`candidates/${candidateId}/offer`, {
      salary: form.salary, start_date: form.start_date,
    })
    if (mode === "convert") return command(`candidates/${candidateId}/convert`, {
      onboarding_workflow_id: Number(form.onboarding_workflow_id),
    })
  }

  async function upload(type: "cv" | "offer-letter", file?: File) {
    if (!file || !candidateId || !token) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      void command(`candidates/${candidateId}/${type}`, {
        fileName: file.name, fileSize: file.size,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : file.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword'),
        fileString: result.split(",")[1] ?? "",
      })
    }
    reader.readAsDataURL(file)
  }

  async function download(documentId: number) {
    if (!token || !candidateId) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/recruitment/candidates/${candidateId}/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error("Document could not be opened")
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Recruitment pipeline</h2>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void refresh(token, requestId)} disabled={loading} title="Refresh"><RefreshCw className="size-4" /></Button>
        <Button size="sm" onClick={() => open("request")}><Plus className="size-4" /> Request</Button>
      </div>
    </div>

    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.7fr)]">
      <section className="min-w-0 border-t" aria-label="Recruitment requests">
        <div className="border-b py-3 text-sm font-semibold">Requests</div>
        {requests.length ? requests.map((row) => <button key={idOf(row)} type="button" onClick={() => void selectRequest(idOf(row))}
          className={`block w-full border-b px-2 py-3 text-left text-sm hover:bg-muted/40 ${requestId === idOf(row) ? "bg-muted/60" : ""}`}>
          <span className="block font-medium">{value(row, "jobTitle")}</span>
          <span className="mt-1 block text-xs text-muted-foreground">#{idOf(row)} · {status(row).replaceAll("_", " ")} · {value(row, "vacancies")} vacancy</span>
        </button>) : <p className="py-5 text-sm text-muted-foreground">No recruitment requests.</p>}
      </section>

      <div className="min-w-0 space-y-5">
        {request ? <section className="min-w-0 border-t">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b py-3">
            <div><h3 className="font-semibold">{value(request, "jobTitle")}</h3><p className="text-xs text-muted-foreground">{status(request).replaceAll("_", " ")} · Budget TZS {Number(request.budgetAmount ?? 0).toLocaleString()}</p></div>
            <div className="flex gap-2">
              {status(request).startsWith("PENDING_") ? <Button size="sm" onClick={() => void command(`requests/${requestId}/approve`)} disabled={busy}>Approve</Button> : null}
              {status(request) === "APPROVED" ? <Button size="sm" onClick={() => void command(`requests/${requestId}/post`)} disabled={busy}>Post</Button> : null}
              {status(request) === "POSTED" ? <Button size="sm" variant="outline" onClick={() => void command(`requests/${requestId}/close`)} disabled={busy}>Close</Button> : null}
            </div>
          </div>
          <p className="whitespace-pre-wrap py-3 text-sm text-muted-foreground">{value(request, "jobDescription")}</p>
        </section> : <p className="border-t py-8 text-sm text-muted-foreground">Select a request to view its candidates.</p>}

        {request ? <section className="min-w-0 border-t">
          <div className="flex items-center justify-between border-b py-3"><h3 className="text-sm font-semibold">Candidates</h3>{status(request) === "POSTED" ? <Button size="sm" variant="outline" onClick={() => open("candidate")}><Plus className="size-4" /> Applicant</Button> : null}</div>
          {candidates.length ? candidates.map((row) => <button key={idOf(row)} type="button" onClick={() => setCandidateId(idOf(row))}
            className={`flex w-full items-center justify-between gap-3 border-b px-2 py-3 text-left text-sm hover:bg-muted/40 ${candidateId === idOf(row) ? "bg-muted/60" : ""}`}>
            <span className="font-medium">{label({ ...row, first_name: row.firstName, last_name: row.lastName })}</span><span className="shrink-0 text-xs text-muted-foreground">{status(row).replaceAll("_", " ")}</span>
          </button>) : <p className="py-5 text-sm text-muted-foreground">No applicants recorded.</p>}
        </section> : null}

        {candidate ? <section className="min-w-0 border-t">
          <div className="border-b py-3"><h3 className="font-semibold">{value(candidate, "firstName")} {value(candidate, "lastName")}</h3><p className="text-xs text-muted-foreground">{value(candidate, "email")} · {status(candidate).replaceAll("_", " ")}</p></div>
          <div className="flex flex-wrap items-center gap-2 py-3">
            {candidate.cvDocumentId ? <Button size="sm" variant="outline" onClick={() => void download(Number(candidate.cvDocumentId))}><FileText className="size-4" /> CV</Button> : null}
            {candidate.offerDocumentId ? <Button size="sm" variant="outline" onClick={() => void download(Number(candidate.offerDocumentId))}><FileText className="size-4" /> Offer</Button> : null}
            {status(candidate) === "APPLIED" || status(candidate) === "SHORTLISTED" ? <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-sm"><Upload className="size-4" /> CV<input type="file" className="sr-only" accept=".pdf,.doc,.docx" onChange={(event) => void upload("cv", event.target.files?.[0])} /></label> : null}
            {status(candidate) === "APPLIED" ? <Button size="sm" onClick={() => void command(`candidates/${candidateId}/shortlist`)}>Shortlist</Button> : null}
            {status(candidate) === "SHORTLISTED" ? <><Button size="sm" variant="outline" onClick={() => open("interview")}>Interview</Button><Button size="sm" variant="outline" onClick={() => open("score")}>Score</Button><Button size="sm" variant="outline" onClick={() => open("check")}>Check</Button><Button size="sm" onClick={() => open("offer")}>Offer</Button></> : null}
            {status(candidate) === "OFFER_DRAFT" ? <><label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-sm"><Upload className="size-4" /> Letter<input type="file" className="sr-only" accept=".pdf" onChange={(event) => void upload("offer-letter", event.target.files?.[0])} /></label><Button size="sm" onClick={() => void command(`candidates/${candidateId}/offer/approve`)}>Approve offer</Button></> : null}
            {status(candidate) === "OFFER_APPROVED" ? <Button size="sm" onClick={() => void command(`candidates/${candidateId}/offer/send`)}>Send offer</Button> : null}
            {status(candidate) === "OFFER_ACCEPTED" ? <Button size="sm" onClick={() => open("convert")}>Create invitation</Button> : null}
            {["APPLIED", "SHORTLISTED", "OFFER_DRAFT", "OFFER_APPROVED"].includes(status(candidate)) ? <Button size="sm" variant="outline" onClick={() => void command(`candidates/${candidateId}/reject`)}>Reject</Button> : null}
          </div>
          {candidate.interview ? <p className="text-xs text-muted-foreground">Interview {String((candidate.interview as AdminRecord).scheduled_at ?? "")} · {String((candidate.interview as AdminRecord).location ?? "")}</p> : null}
          {candidate.checks ? <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">{Object.entries(candidate.checks as AdminRecord).map(([key, data]) => <span key={key}>{key}: {String((data as AdminRecord).result ?? "pending")}</span>)}</div> : null}
          {candidate.invitationId ? <p className="mt-3 text-xs text-muted-foreground">Invitation #{String(candidate.invitationId)}</p> : null}
        </section> : null}
      </div>
    </div>

    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null) }}>
      <DialogPopup className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "request" ? "New recruitment request" : mode === "candidate" ? "New applicant" : mode === "interview" ? "Schedule interview" : mode === "score" ? "Panel score" : mode === "check" ? "Verification check" : mode === "offer" ? "Draft offer" : "Create invitation"}</DialogTitle></DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid max-h-[65vh] gap-3 overflow-auto py-1 sm:grid-cols-2">
            {mode === "request" ? <>
              <Field title="Position"><FluentSelect ariaLabel="Position" className="w-full" value={form.position_id ?? ""} placeholder="Select" onChange={(next) => { const selected = positions.find((row) => idOf(row) === Number(next)); setForm((current) => ({ ...current, position_id: next, job_title: String(selected?.name ?? current.job_title ?? "") })) }} options={[{ value: "", label: "Select" }, ...positions.map((row) => ({ value: String(idOf(row)), label: value(row, "name") }))]} /></Field>
              <Field title="Manager"><FluentSelect ariaLabel="Manager" className="w-full" value={form.manager_employee_id ?? ""} placeholder="Select" onChange={(next) => set("manager_employee_id", next)} options={[{ value: "", label: "Select" }, ...employees.map((row) => ({ value: String(idOf(row)), label: label(row) }))]} /></Field>
              <Field title="Vacancies"><Input required min="1" type="number" value={form.vacancies ?? "1"} onChange={(event) => set("vacancies", event.target.value)} /></Field>
              <Field title="Monthly budget (TZS)"><Input required min="1" type="number" value={form.budget_amount ?? ""} onChange={(event) => set("budget_amount", event.target.value)} /></Field>
              <Field title="Job title"><Input required value={form.job_title ?? ""} onChange={(event) => set("job_title", event.target.value)} /></Field>
              <Field title="Posting closes"><DateInput value={form.closes_on ?? ""} onChange={(event) => set("closes_on", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field title="Job description"><Textarea required className={fieldClass} rows={5} value={form.job_description ?? ""} onChange={(event) => set("job_description", event.target.value)} /></Field></div>
            </> : null}
            {mode === "candidate" ? <>
              {(["first_name", "last_name", "email", "phone"] as const).map((key) => <Field key={key} title={key.replaceAll("_", " ")}><Input required type={key === "email" ? "email" : "text"} value={form[key] ?? ""} onChange={(event) => set(key, event.target.value)} /></Field>)}
              <Field title="Gender"><FluentSelect ariaLabel="Gender" className="w-full" value={form.gender ?? ""} placeholder="Select" onChange={(next) => set("gender", next)} options={[{ value: "", label: "Select" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} /></Field>
            </> : null}
            {mode === "interview" ? <>
              <Field title="Scheduled at"><DateTimeInput required aria-label="Scheduled at" value={form.scheduled_at ?? ""} onChange={(event) => set("scheduled_at", event.target.value)} /></Field>
              <Field title="Location"><Input required value={form.location ?? ""} onChange={(event) => set("location", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field title="Panel"><Dropdown multiselect aria-label="Panel" className="w-full" placeholder="Select panel" selectedOptions={(form.panel_ids ?? "").split(",").filter(Boolean)} onOptionSelect={(_event, data) => set("panel_ids", (data.selectedOptions ?? []).join(","))}>{users.map((row) => <Option key={idOf(row)} value={String(idOf(row))} text={label(row)}>{label(row)}</Option>)}</Dropdown></Field></div>
            </> : null}
            {mode === "score" ? <><Field title="Score / 100"><Input required min="0" max="100" type="number" value={form.score ?? ""} onChange={(event) => set("score", event.target.value)} /></Field><div className="sm:col-span-2"><Field title="Comments"><Textarea required className={fieldClass} rows={3} value={form.comments ?? ""} onChange={(event) => set("comments", event.target.value)} /></Field></div></> : null}
            {mode === "check" ? <><Field title="Check"><FluentSelect ariaLabel="Check" className="w-full" value={form.type ?? ""} placeholder="Select" onChange={(next) => set("type", next)} options={[{ value: "", label: "Select" }, { value: "REFERENCE", label: "Reference" }, { value: "CERTIFICATE", label: "Certificate" }, { value: "NIDA", label: "NIDA" }]} /></Field><Field title="Result"><FluentSelect ariaLabel="Result" className="w-full" value={form.result ?? ""} placeholder="Select" onChange={(next) => set("result", next)} options={[{ value: "", label: "Select" }, { value: "PASS", label: "Pass" }, { value: "FAIL", label: "Fail" }]} /></Field><div className="sm:col-span-2"><Field title="Evidence note"><Textarea required className={fieldClass} rows={3} value={form.evidence_note ?? ""} onChange={(event) => set("evidence_note", event.target.value)} /></Field></div></> : null}
            {mode === "offer" ? <><Field title="Monthly salary (TZS)"><Input required min="1" type="number" value={form.salary ?? ""} onChange={(event) => set("salary", event.target.value)} /></Field><Field title="Start date"><DateInput required value={form.start_date ?? ""} onChange={(event) => set("start_date", event.target.value)} /></Field></> : null}
            {mode === "convert" ? <div className="sm:col-span-2"><Field title="Onboarding workflow"><FluentSelect ariaLabel="Onboarding workflow" className="w-full" value={form.onboarding_workflow_id ?? ""} placeholder="Select" onChange={(next) => set("onboarding_workflow_id", next)} options={[{ value: "", label: "Select" }, ...workflows.map((row) => ({ value: String(idOf(row)), label: value(row, "name") }))]} /></Field></div> : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null} Save</Button></DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  </div>
}
