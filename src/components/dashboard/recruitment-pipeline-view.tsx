"use client"

import * as React from "react"
import { FileText, Loader2, Plus, RefreshCw, Upload } from "lucide-react"
import { toast } from "sonner"
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
function label(row: AdminRecord) { return [row.first_name, row.last_name].filter(Boolean).join(" ") || value(row, "name") || `#${idOf(row)}` }
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
              <Field title="Position"><select required className={fieldClass} value={form.position_id ?? ""} onChange={(event) => { const selected = positions.find((row) => idOf(row) === Number(event.target.value)); setForm((current) => ({ ...current, position_id: event.target.value, job_title: String(selected?.name ?? current.job_title ?? "") })) }}><option value="">Select</option>{positions.map((row) => <option key={idOf(row)} value={idOf(row)}>{value(row, "name")}</option>)}</select></Field>
              <Field title="Manager"><select required className={fieldClass} value={form.manager_employee_id ?? ""} onChange={(event) => set("manager_employee_id", event.target.value)}><option value="">Select</option>{employees.map((row) => <option key={idOf(row)} value={idOf(row)}>{label(row)}</option>)}</select></Field>
              <Field title="Vacancies"><Input required min="1" type="number" value={form.vacancies ?? "1"} onChange={(event) => set("vacancies", event.target.value)} /></Field>
              <Field title="Monthly budget (TZS)"><Input required min="1" type="number" value={form.budget_amount ?? ""} onChange={(event) => set("budget_amount", event.target.value)} /></Field>
              <Field title="Job title"><Input required value={form.job_title ?? ""} onChange={(event) => set("job_title", event.target.value)} /></Field>
              <Field title="Posting closes"><Input type="date" value={form.closes_on ?? ""} onChange={(event) => set("closes_on", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field title="Job description"><textarea required className={fieldClass} rows={5} value={form.job_description ?? ""} onChange={(event) => set("job_description", event.target.value)} /></Field></div>
            </> : null}
            {mode === "candidate" ? <>
              {(["first_name", "last_name", "email", "phone"] as const).map((key) => <Field key={key} title={key.replaceAll("_", " ")}><Input required type={key === "email" ? "email" : "text"} value={form[key] ?? ""} onChange={(event) => set(key, event.target.value)} /></Field>)}
              <Field title="Gender"><select required className={fieldClass} value={form.gender ?? ""} onChange={(event) => set("gender", event.target.value)}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></Field>
            </> : null}
            {mode === "interview" ? <>
              <Field title="Scheduled at"><Input required type="datetime-local" value={form.scheduled_at ?? ""} onChange={(event) => set("scheduled_at", event.target.value)} /></Field>
              <Field title="Location"><Input required value={form.location ?? ""} onChange={(event) => set("location", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field title="Panel"><select required multiple className={`${fieldClass} min-h-28`} value={(form.panel_ids ?? "").split(",").filter(Boolean)} onChange={(event) => set("panel_ids", Array.from(event.target.selectedOptions).map((option) => option.value).join(","))}>{users.map((row) => <option key={idOf(row)} value={idOf(row)}>{label(row)}</option>)}</select></Field></div>
            </> : null}
            {mode === "score" ? <><Field title="Score / 100"><Input required min="0" max="100" type="number" value={form.score ?? ""} onChange={(event) => set("score", event.target.value)} /></Field><div className="sm:col-span-2"><Field title="Comments"><textarea required className={fieldClass} rows={3} value={form.comments ?? ""} onChange={(event) => set("comments", event.target.value)} /></Field></div></> : null}
            {mode === "check" ? <><Field title="Check"><select required className={fieldClass} value={form.type ?? ""} onChange={(event) => set("type", event.target.value)}><option value="">Select</option><option value="REFERENCE">Reference</option><option value="CERTIFICATE">Certificate</option><option value="NIDA">NIDA</option></select></Field><Field title="Result"><select required className={fieldClass} value={form.result ?? ""} onChange={(event) => set("result", event.target.value)}><option value="">Select</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></select></Field><div className="sm:col-span-2"><Field title="Evidence note"><textarea required className={fieldClass} rows={3} value={form.evidence_note ?? ""} onChange={(event) => set("evidence_note", event.target.value)} /></Field></div></> : null}
            {mode === "offer" ? <><Field title="Monthly salary (TZS)"><Input required min="1" type="number" value={form.salary ?? ""} onChange={(event) => set("salary", event.target.value)} /></Field><Field title="Start date"><Input required type="date" value={form.start_date ?? ""} onChange={(event) => set("start_date", event.target.value)} /></Field></> : null}
            {mode === "convert" ? <div className="sm:col-span-2"><Field title="Onboarding workflow"><select required className={fieldClass} value={form.onboarding_workflow_id ?? ""} onChange={(event) => set("onboarding_workflow_id", event.target.value)}><option value="">Select</option>{workflows.map((row) => <option key={idOf(row)} value={idOf(row)}>{value(row, "name")}</option>)}</select></Field></div> : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null} Save</Button></DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  </div>
}
