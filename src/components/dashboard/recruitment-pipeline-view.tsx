"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import { DateTimeInput } from "@/components/ui/date-time-input"
import * as React from "react"
import { ArrowLeft, BriefcaseBusiness, CalendarClock, CheckCircle2, FileText, MailPlus, Megaphone, Plus, RefreshCw, Send, ShieldCheck, Upload, UserPlus, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils"
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
import { FormField } from "@/components/ui/form-field"
import { PhoneInput } from "@/components/ui/phone-input"

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

function Field({ title, children, required }: { title: string; children: React.ReactNode; required?: boolean }) {
  return <FormField label={title.charAt(0).toUpperCase() + title.slice(1)} required={required}>{children}</FormField>
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
  const [requestQuery, setRequestQuery] = React.useState("")

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

  const requestStatus = request ? status(request) : ""
  const candidateStatus = candidate ? status(candidate) : ""
  const visibleRequests = requests.filter((row) => {
    const term = requestQuery.trim().toLowerCase()
    if (!term) return true
    return [value(row, "jobTitle"), status(row), String(idOf(row))].join(" ").toLowerCase().includes(term)
  })
  // Phones and tablets show one pane at a time; desktop shows both.
  const showDetailPane = requestId !== null

  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><BriefcaseBusiness className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Hiring pipeline</h2>
          <p className="text-sm text-muted-foreground">
            {requests.length} request{requests.length === 1 ? "" : "s"}
            {requests.length ? ` · ${requests.filter((row) => status(row) === "POSTED").length} open for applicants` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" className="h-9 w-9 p-0" onClick={() => void refresh(token, requestId)} disabled={loading} title="Refresh" aria-label="Refresh">
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
        <Button className="h-9 flex-1 px-4 sm:flex-none" onClick={() => open("request")}><Plus className="size-4" /> New request</Button>
      </div>
    </div>

    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(260px,20rem)_minmax(0,1fr)]">
      {/* Requests list */}
      <section aria-label="Recruitment requests" className={cn("min-w-0 flex-col gap-3", showDetailPane ? "hidden lg:flex" : "flex")}>
        {requests.length > 5 ? (
          <Input type="search" placeholder="Search requests" aria-label="Search requests" value={requestQuery} onChange={(event) => setRequestQuery(event.target.value)} />
        ) : null}
        {loading && !requests.length ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-border"><FluentLoadingIndicator /></div>
        ) : visibleRequests.length ? (
          <ul className="flex flex-col gap-2">
            {visibleRequests.map((row) => {
              const selected = requestId === idOf(row)
              return <li key={idOf(row)}>
                <button type="button" onClick={() => void selectRequest(idOf(row))} aria-current={selected ? "true" : undefined}
                  className={cn("flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    selected ? "border-primary bg-primary/[0.04]" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30")}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">{value(row, "jobTitle") || "Untitled request"}</span>
                    <StatusTag value={status(row)} />
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>#{idOf(row)}</span>
                    <span>{value(row, "vacancies") || "1"} vacanc{Number(value(row, "vacancies") || 1) === 1 ? "y" : "ies"}</span>
                    {row.closesOn ? <span>Closes {String(row.closesOn).slice(0, 10)}</span> : null}
                  </span>
                </button>
              </li>
            })}
          </ul>
        ) : (
          <EmptyState icon={<BriefcaseBusiness className="size-5" />} title={requests.length ? "No requests match" : "No hiring requests yet"}
            text={requests.length ? "Try another search." : "Create a request to start hiring for a position."}
            action={requests.length ? null : <Button className="h-9" onClick={() => open("request")}><Plus className="size-4" /> New request</Button>} />
        )}
      </section>

      {/* Request detail, candidates and the selected candidate */}
      <div className={cn("min-w-0 flex-col gap-5", showDetailPane ? "flex" : "hidden lg:flex")}>
        {request ? <>
          <Button variant="ghost" className="h-9 self-start px-2 text-muted-foreground lg:hidden" onClick={() => { setRequestId(null); setCandidateId(null) }}>
            <ArrowLeft className="size-4" /> All requests
          </Button>

          <section className="rounded-lg border border-border bg-background">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{value(request, "jobTitle")}</h3>
                  <StatusTag value={requestStatus} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Request #{idOf(request)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {requestStatus.startsWith("PENDING_") ? <Button className="h-9" onClick={() => void command(`requests/${requestId}/approve`)} disabled={busy}><CheckCircle2 className="size-4" /> Approve</Button> : null}
                {requestStatus === "APPROVED" ? <Button className="h-9" onClick={() => void command(`requests/${requestId}/post`)} disabled={busy}><Megaphone className="size-4" /> Post vacancy</Button> : null}
                {requestStatus === "POSTED" ? <Button className="h-9" variant="outline" onClick={() => void command(`requests/${requestId}/close`)} disabled={busy}>Close vacancy</Button> : null}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-b border-border p-4 sm:grid-cols-3 sm:p-5">
              <Fact label="Vacancies" value={value(request, "vacancies") || "1"} />
              <Fact label="Monthly budget" value={`TZS ${Number(request.budgetAmount ?? 0).toLocaleString()}`} />
              <Fact label="Posting closes" value={request.closesOn ? String(request.closesOn).slice(0, 10) : "Not set"} />
            </dl>
            {value(request, "jobDescription") ? (
              <div className="p-4 sm:p-5">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Job description</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value(request, "jobDescription")}</p>
              </div>
            ) : null}
          </section>

          <section aria-label="Candidates" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Candidates <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{candidates.length}</span>
              </h3>
              {requestStatus === "POSTED" ? <Button variant="outline" className="h-9" onClick={() => open("candidate")}><UserPlus className="size-4" /> Add applicant</Button> : null}
            </div>
            {candidates.length ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {candidates.map((row) => {
                  const selected = candidateId === idOf(row)
                  const name = label({ ...row, first_name: row.firstName, last_name: row.lastName })
                  return <li key={idOf(row)}>
                    <button type="button" onClick={() => setCandidateId(idOf(row))} aria-current={selected ? "true" : undefined}
                      className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                        selected ? "border-primary bg-primary/[0.04]" : "border-border bg-background hover:border-primary/40 hover:bg-muted/30")}>
                      <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{value(row, "email") || "No email"}</span>
                      </span>
                      <StatusTag value={status(row)} />
                    </button>
                  </li>
                })}
              </ul>
            ) : (
              <EmptyState icon={<UsersRound className="size-5" />} title="No applicants yet"
                text={requestStatus === "POSTED" ? "Add applicants as they apply." : "Post the vacancy to start adding applicants."} />
            )}
          </section>

          {candidate ? (
            <section aria-label="Candidate" className="rounded-lg border border-border bg-background">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(`${value(candidate, "firstName")} ${value(candidate, "lastName")}`)}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">{value(candidate, "firstName")} {value(candidate, "lastName")}</h3>
                    <p className="truncate text-xs text-muted-foreground">{[value(candidate, "email"), value(candidate, "phone")].filter(Boolean).join(" · ") || "No contact details"}</p>
                  </div>
                </div>
                <StatusTag value={candidateStatus} />
              </div>

              <div className="border-b border-border p-4 sm:p-5">
                <CandidateProgress status={candidateStatus} />
              </div>

              <div className="flex flex-col gap-4 p-4 sm:p-5">
                {candidate.interview || candidate.checks || candidate.invitationId ? (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {candidate.interview ? <Fact label="Interview" value={[String((candidate.interview as AdminRecord).scheduled_at ?? "").replace("T", " ").slice(0, 16), String((candidate.interview as AdminRecord).location ?? "")].filter(Boolean).join(" · ")} /> : null}
                    {candidate.invitationId ? <Fact label="Invitation" value={`#${String(candidate.invitationId)}`} /> : null}
                    {candidate.checks ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-muted-foreground">Verification checks</dt>
                        <dd className="mt-1.5 flex flex-wrap gap-1.5">
                          {Object.entries(candidate.checks as AdminRecord).map(([key, data]) => {
                            const result = String((data as AdminRecord).result ?? "pending")
                            return <span key={key} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                              result === "PASS" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : result === "FAIL" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                  : "bg-muted text-muted-foreground")}>{key}: {result.toLowerCase()}</span>
                          })}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                {candidate.cvDocumentId || candidate.offerDocumentId ? (
                  <div className="flex flex-wrap gap-2">
                    {candidate.cvDocumentId ? <Button variant="outline" className="h-9" onClick={() => void download(Number(candidate.cvDocumentId))}><FileText className="size-4" /> View CV</Button> : null}
                    {candidate.offerDocumentId ? <Button variant="outline" className="h-9" onClick={() => void download(Number(candidate.offerDocumentId))}><FileText className="size-4" /> View offer letter</Button> : null}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Next steps</p>
                  <div className="flex flex-wrap gap-2">
                    {candidateStatus === "APPLIED" || candidateStatus === "SHORTLISTED" ? <UploadButton label="Upload CV" accept=".pdf,.doc,.docx" onFile={(file) => void upload("cv", file)} /> : null}
                    {candidateStatus === "APPLIED" ? <Button className="h-9" onClick={() => void command(`candidates/${candidateId}/shortlist`)} disabled={busy}>Shortlist</Button> : null}
                    {candidateStatus === "SHORTLISTED" ? <>
                      <Button variant="outline" className="h-9" onClick={() => open("interview")}><CalendarClock className="size-4" /> Schedule interview</Button>
                      <Button variant="outline" className="h-9" onClick={() => open("score")}>Record score</Button>
                      <Button variant="outline" className="h-9" onClick={() => open("check")}><ShieldCheck className="size-4" /> Add check</Button>
                      <Button className="h-9" onClick={() => open("offer")}>Draft offer</Button>
                    </> : null}
                    {candidateStatus === "OFFER_DRAFT" ? <>
                      <UploadButton label="Upload offer letter" accept=".pdf" onFile={(file) => void upload("offer-letter", file)} />
                      <Button className="h-9" onClick={() => void command(`candidates/${candidateId}/offer/approve`)} disabled={busy}>Approve offer</Button>
                    </> : null}
                    {candidateStatus === "OFFER_APPROVED" ? <Button className="h-9" onClick={() => void command(`candidates/${candidateId}/offer/send`)} disabled={busy}><Send className="size-4" /> Send offer</Button> : null}
                    {candidateStatus === "OFFER_ACCEPTED" ? <Button className="h-9" onClick={() => open("convert")}><MailPlus className="size-4" /> Create invitation</Button> : null}
                    {["APPLIED", "SHORTLISTED", "OFFER_DRAFT", "OFFER_APPROVED"].includes(candidateStatus) ? (
                      <Button variant="outline" className="h-9 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300" onClick={() => void command(`candidates/${candidateId}/reject`)} disabled={busy}>Reject</Button>
                    ) : null}
                    {!["APPLIED", "SHORTLISTED", "OFFER_DRAFT", "OFFER_APPROVED", "OFFER_ACCEPTED"].includes(candidateStatus) ? (
                      <p className="text-sm text-muted-foreground">No further actions for this candidate.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : candidates.length ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Select a candidate to see their progress and next steps.</p>
          ) : null}
        </> : (
          <EmptyState icon={<BriefcaseBusiness className="size-5" />} title="Select a hiring request" text="Its details, candidates and next steps appear here." />
        )}
      </div>
    </div>

    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null) }}>
      <DialogPopup className="sm:max-w-[640px]">
        <DialogHeader><DialogTitle>{mode === "request" ? "New recruitment request" : mode === "candidate" ? "New applicant" : mode === "interview" ? "Schedule interview" : mode === "score" ? "Panel score" : mode === "check" ? "Verification check" : mode === "offer" ? "Draft offer" : "Create invitation"}</DialogTitle></DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 py-1 sm:grid-cols-2">
            {mode === "request" ? <>
              <Field title="Position"><FluentSelect ariaLabel="Position" className="w-full" value={form.position_id ?? ""} placeholder="Select" onChange={(next) => { const selected = positions.find((row) => idOf(row) === Number(next)); setForm((current) => ({ ...current, position_id: next, job_title: String(selected?.name ?? current.job_title ?? "") })) }} options={[{ value: "", label: "Select" }, ...positions.map((row) => ({ value: String(idOf(row)), label: value(row, "name") }))]} /></Field>
              <Field title="Manager"><FluentSelect ariaLabel="Manager" className="w-full" value={form.manager_employee_id ?? ""} placeholder="Select" onChange={(next) => set("manager_employee_id", next)} options={[{ value: "", label: "Select" }, ...employees.map((row) => ({ value: String(idOf(row)), label: label(row) }))]} /></Field>
              <Field title="Vacancies" required><Input required min="1" type="number" value={form.vacancies ?? "1"} onChange={(event) => set("vacancies", event.target.value)} /></Field>
              <Field title="Monthly budget (TZS)" required><Input required min="1" type="number" value={form.budget_amount ?? ""} onChange={(event) => set("budget_amount", event.target.value)} /></Field>
              <Field title="Job title" required><Input required value={form.job_title ?? ""} onChange={(event) => set("job_title", event.target.value)} /></Field>
              <Field title="Posting closes"><DateInput value={form.closes_on ?? ""} onChange={(event) => set("closes_on", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field title="Job description" required><Textarea required rows={5} formatting={false} value={form.job_description ?? ""} onChange={(event) => set("job_description", event.target.value)} /></Field></div>
            </> : null}
            {mode === "candidate" ? <>
              {(["first_name", "last_name", "email", "phone"] as const).map((key) => <Field key={key} title={key.replaceAll("_", " ")} required>{key === "phone" ? <PhoneInput aria-label="Phone" value={form[key] ?? ""} onChange={(next) => set(key, next)} /> : <Input required type={key === "email" ? "email" : "text"} value={form[key] ?? ""} onChange={(event) => set(key, event.target.value)} />}</Field>)}
              <Field title="Gender"><FluentSelect ariaLabel="Gender" className="w-full" value={form.gender ?? ""} placeholder="Select" onChange={(next) => set("gender", next)} options={[{ value: "", label: "Select" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} /></Field>
            </> : null}
            {mode === "interview" ? <>
              <Field title="Scheduled at" required><DateTimeInput required aria-label="Scheduled at" value={form.scheduled_at ?? ""} onChange={(event) => set("scheduled_at", event.target.value)} /></Field>
              <Field title="Location"><Input required value={form.location ?? ""} onChange={(event) => set("location", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field title="Panel"><Dropdown multiselect aria-label="Panel" className="w-full" placeholder="Select panel" selectedOptions={(form.panel_ids ?? "").split(",").filter(Boolean)} onOptionSelect={(_event, data) => set("panel_ids", (data.selectedOptions ?? []).join(","))}>{users.map((row) => <Option key={idOf(row)} value={String(idOf(row))} text={label(row)}>{label(row)}</Option>)}</Dropdown></Field></div>
            </> : null}
            {mode === "score" ? <><Field title="Score / 100" required><Input required min="0" max="100" type="number" value={form.score ?? ""} onChange={(event) => set("score", event.target.value)} /></Field><div className="sm:col-span-2"><Field title="Comments" required><Textarea required rows={3} formatting={false} value={form.comments ?? ""} onChange={(event) => set("comments", event.target.value)} /></Field></div></> : null}
            {mode === "check" ? <><Field title="Check"><FluentSelect ariaLabel="Check" className="w-full" value={form.type ?? ""} placeholder="Select" onChange={(next) => set("type", next)} options={[{ value: "", label: "Select" }, { value: "REFERENCE", label: "Reference" }, { value: "CERTIFICATE", label: "Certificate" }, { value: "NIDA", label: "NIDA" }]} /></Field><Field title="Result"><FluentSelect ariaLabel="Result" className="w-full" value={form.result ?? ""} placeholder="Select" onChange={(next) => set("result", next)} options={[{ value: "", label: "Select" }, { value: "PASS", label: "Pass" }, { value: "FAIL", label: "Fail" }]} /></Field><div className="sm:col-span-2"><Field title="Evidence note" required><Textarea required rows={3} formatting={false} value={form.evidence_note ?? ""} onChange={(event) => set("evidence_note", event.target.value)} /></Field></div></> : null}
            {mode === "offer" ? <><Field title="Monthly salary (TZS)"><Input required min="1" type="number" value={form.salary ?? ""} onChange={(event) => set("salary", event.target.value)} /></Field><Field title="Start date"><DateInput required value={form.start_date ?? ""} onChange={(event) => set("start_date", event.target.value)} /></Field></> : null}
            {mode === "convert" ? <div className="sm:col-span-2"><Field title="Onboarding workflow"><FluentSelect ariaLabel="Onboarding workflow" className="w-full" value={form.onboarding_workflow_id ?? ""} placeholder="Select" onChange={(next) => set("onboarding_workflow_id", next)} options={[{ value: "", label: "Select" }, ...workflows.map((row) => ({ value: String(idOf(row)), label: value(row, "name") }))]} /></Field></div> : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null} Save</Button></DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  </div>
}

const STATUS_TONES: Record<string, string> = {
  POSTED: "bg-primary/10 text-primary",
  APPROVED: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  SHORTLISTED: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  OFFER_DRAFT: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  OFFER_APPROVED: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  OFFER_SENT: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  OFFER_ACCEPTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  CONVERTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  HIRED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  CLOSED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
}

function statusLabel(raw: string) {
  const text = raw.replaceAll("_", " ").toLowerCase()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown"
}

/** Coloured status pill used for requests and candidates. */
function StatusTag({ value: raw }: { value: string }) {
  const tone = raw.startsWith("PENDING_")
    ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    : STATUS_TONES[raw] ?? "bg-muted text-muted-foreground"
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", tone)}>{statusLabel(raw)}</span>
}

const CANDIDATE_STAGES = [
  { label: "Applied", statuses: ["APPLIED"] },
  { label: "Shortlisted", statuses: ["SHORTLISTED"] },
  { label: "Offer", statuses: ["OFFER_DRAFT", "OFFER_APPROVED", "OFFER_SENT"] },
  { label: "Accepted", statuses: ["OFFER_ACCEPTED"] },
  { label: "Invited", statuses: ["CONVERTED", "HIRED", "INVITED"] },
]

/** Hiring progress for one candidate; a rejected candidate shows where it stopped. */
function CandidateProgress({ status: raw }: { status: string }) {
  const rejected = raw === "REJECTED"
  const current = CANDIDATE_STAGES.findIndex((stage) => stage.statuses.includes(raw))
  return (
    <div>
      <ol className="grid grid-cols-5 gap-1" aria-label="Hiring progress">
        {CANDIDATE_STAGES.map((stage, index) => {
          const done = current > index
          const active = current === index
          return (
            <li key={stage.label} className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-current={active ? "step" : undefined}>
              <span className={cn("h-1.5 w-full rounded-full", done || active ? (rejected ? "bg-rose-400" : "bg-primary") : "bg-muted")} />
              <span className={cn("truncate text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{stage.label}</span>
            </li>
          )
        })}
      </ol>
      {rejected ? <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">This candidate was rejected.</p> : null}
    </div>
  )
}

function Fact({ label: title, value: text }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{title}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{text || "—"}</dd>
    </div>
  )
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">{icon}</span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{text}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

/** Outlined button that opens a file picker (CV and offer letter uploads). */
function UploadButton({ label: text, accept, onFile }: { label: string; accept: string; onFile: (file?: File) => void }) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--hrms-control-radius)] border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-within:outline-2 focus-within:outline-primary">
      <Upload className="size-4" aria-hidden="true" />
      {text}
      <input type="file" className="sr-only" accept={accept} onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = "" }} />
    </label>
  )
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"
}
