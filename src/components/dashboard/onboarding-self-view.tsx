"use client"
import { onboardingActionMessage } from "@/lib/onboarding-action-feedback"
import { OnboardingEmployeeMessages } from "./onboarding-workspace-collaboration"
import { Card, CardHeader, Text, Button as FluentButton } from "@fluentui/react-components"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckIcon, FileTextIcon, PaperclipIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import {
  CompactStatStrip,
  CycleRail,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  formatDate,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import {
  acknowledgeOnboardingRequest,
  completeOnboardingTask,
  fileToBase64UploadDto,
  getOnboardingProgress,
  listMyOnboardingRequests,
  listOnboardingDocuments,
  listOnboardingTasks,
  listEmploymentContracts,
  signEmploymentContract,
  submitMyOnboardingDetails,
  uploadMyOnboardingDocument,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"
import { API_BASE_URL } from "@/utils/constants"

const STEPS = ["DRAFT", "SUBMITTED", "IN_PROGRESS", "ACKNOWLEDGED", "COMPLETED"]

function token() {
  return readStoredSessionTokens().accessToken.trim()
}

function statusOf(row: AdminRecord | null) {
  return readString(row, ["status", "request_status", "state"], "DRAFT").toUpperCase()
}

function needsAck(row: AdminRecord | null) {
  if (!row) return false
  const status = statusOf(row)
  const acknowledged = readString(row, [
    "acknowledged_at",
    "acknowledgedAt",
    "employee_acknowledged_at",
    "employeeAcknowledgedAt",
  ])
  return (
    !acknowledged && ["SUBMITTED", "IN_PROGRESS", "PENDING_ACKNOWLEDGEMENT", "ACKNOWLEDGEMENT_PENDING"].includes(status)
  )
}

export function OnboardingSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const reduceMotion = useReducedMotion()
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [progress, setProgress] = React.useState<AdminRecord | null>(null)
  const [tasks, setTasks] = React.useState<AdminRecord[]>([])
  const [taskFilter, setTaskFilter] = React.useState("all")
  const [documents, setDocuments] = React.useState<AdminRecord[]>([])
  const [contracts, setContracts] = React.useState<AdminRecord[]>([])
  const [signedName, setSignedName] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState("")
  const [ackNote, setAckNote] = React.useState("I have read and accept the onboarding terms.")
  const [ackDocumentId, setAckDocumentId] = React.useState("")
  const [documentType, setDocumentType] = React.useState("other")
  const fileRef = React.useRef<HTMLInputElement>(null)

  const selected = requests.find((row) => rowId(row) === selectedId) ?? requests[0] ?? null

  const load = React.useCallback(async () => {
    const access = token()
    if (!access) {
      setError("Authentication required. Please sign in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await listMyOnboardingRequests(access)
      setRequests(rows)
      const nextId = selectedId && rows.some((row) => rowId(row) === selectedId) ? selectedId : rowId(rows[0])
      setSelectedId(nextId)
      if (!nextId) {
        setProgress(null)
        setTasks([])
        setDocuments([])
        setContracts([])
        return
      }
      const employeeId = readNumber(rows.find((row) => rowId(row) === nextId), ["employee_id", "employeeId"])
      const [progressResult, taskResult, documentResult, contractResult] = await Promise.allSettled([
        getOnboardingProgress(access, nextId),
        listOnboardingTasks(access, nextId),
        listOnboardingDocuments(access, nextId),
        employeeId ? listEmploymentContracts(access, employeeId) : Promise.resolve([]),
      ])
      const request = rows.find((row) => rowId(row) === nextId) ?? null
      setProgress(
        progressResult.status === "fulfilled" ? progressResult.value : (asRecord(request?.progress) ?? request)
      )
      setTasks(taskResult.status === "fulfilled" ? taskResult.value : asRecordArray(request?.tasks ?? request?.items))
      setDocuments(documentResult.status === "fulfilled" ? documentResult.value : asRecordArray(request?.documents))
      const availableAckDocs = (documentResult.status === "fulfilled" ? documentResult.value : asRecordArray(request?.documents)).filter((doc) => doc.is_verified === true && readString(doc, ["review_status"]).toLowerCase() === "approved")
      setAckDocumentId((current) => availableAckDocs.some((doc) => String(readNumber(doc, ["id"])) === current) ? current : String(readNumber(availableAckDocs[0] ?? {}, ["id"]) ?? ""))
      setContracts(contractResult.status === "fulfilled" ? contractResult.value : [])
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) return
      setError(errorObject instanceof Error ? errorObject.message : "Could not load your onboarding.")
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden, selectedId])

  React.useEffect(() => {
    setMounted(true)
    void load()
    // First load only; later refresh is explicit.
  }, [load])

  React.useEffect(() => {
    if (!selectedId) return
    const access = token()
    if (!access) return
    let cancelled = false
    let refreshing = false
    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden") return
      refreshing = true
      const [progressResult, taskResult, documentResult] = await Promise.allSettled([
        getOnboardingProgress(access, selectedId),
        listOnboardingTasks(access, selectedId),
        listOnboardingDocuments(access, selectedId),
      ])
      if (!cancelled) {
        if (progressResult.status === "fulfilled") setProgress(progressResult.value)
        if (taskResult.status === "fulfilled") setTasks(taskResult.value)
        if (documentResult.status === "fulfilled") setDocuments(documentResult.value)
      }
      refreshing = false
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [selectedId])

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      }

  const percent = readNumber(progress ?? selected, [
    "progress_percentage",
    "percent_complete",
    "percentComplete",
    "completion_percent",
    "progress_percent",
  ])

  async function acknowledge() {
    const access = token()
    const id = rowId(selected)
    if (!access || !id) return
    setBusy("ack")
    try {
      const requiredVersion = readString(selected, ["acknowledgement_required_version"], "").trim()
      const pickedDocument = documents.find((doc) => String(readNumber(doc, ["id"])) === ackDocumentId)
      const version = requiredVersion || readString(pickedDocument ?? {}, ["version", "updated_at"], "").slice(0, 50)
      if (!version) throw new Error("The acknowledgement version is not configured. Contact HR.")
      if (!requiredVersion && !pickedDocument) throw new Error("Select an approved acknowledgement document first.")
      const result = await acknowledgeOnboardingRequest(access, id, {
        accepted: true,
        acknowledgement_version: version,
        acknowledgement_document_id: requiredVersion ? undefined : Number(ackDocumentId),
      })
      toast.success(onboardingActionMessage(result, "Onboarding acknowledged."))
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not acknowledge.")
    } finally {
      setBusy("")
    }
  }

  async function completeTask(task: AdminRecord) {
    const access = token()
    const requestId = rowId(selected)
    const taskId = rowId(task)
    if (!access || !requestId || !taskId) return
    setBusy(`task-${taskId}`)
    try {
      const result = await completeOnboardingTask(access, requestId, taskId, {
        completion_notes: "Completed by employee",
      })
      toast.success(onboardingActionMessage(result, "Task marked complete."))
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not complete the task.")
    } finally {
      setBusy("")
    }
  }

  async function uploadDocument(file: File) {
    const access = token()
    const requestId = rowId(selected)
    if (!access || !requestId) return
    setBusy("upload")
    try {
      const payload = await fileToBase64UploadDto(file)
      const result = await uploadMyOnboardingDocument(access, requestId, {
        file: payload,
        document_type: documentType,
        title: file.name.replace(/\.[^.]+$/, ""),
      })
      toast.success(onboardingActionMessage(result, "Document uploaded."))
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not upload the document.")
    } finally {
      setBusy("")
    }
  }

  async function openContract(contractId: number) {
    const access = token()
    if (!access) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/employment-contracts/${contractId}/document`, {
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
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Contract download failed")
    }
  }

  async function signContract(contractId: number) {
    const access = token()
    if (!access || !signedName.trim()) return
    setBusy("contract")
    try {
      await signEmploymentContract(access, contractId, signedName.trim())
      setSignedName("")
      toast.success("Contract signed")
      await load()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Contract could not be signed")
    } finally {
      setBusy("")
    }
  }

  async function sendCorrectedDetailsToHr() {
    const access = token()
    const requestId = rowId(selected)
    if (!access || !requestId) return
    setBusy("submit-details")
    try {
      await submitMyOnboardingDetails(access, requestId)
      toast.success("Your updated details were sent to HR for review.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not send your details to HR.")
    } finally {
      setBusy("")
    }
  }

  const doneCount = tasks.filter((task) => /complete|done|verified/i.test(readString(task, ["status"]))).length
  const actionableTasks = tasks.filter((task) => task.is_actionable === true && !/complete|done|verified/i.test(readString(task, ["status"])))
  const waitingTasks = tasks.filter((task) => task.is_actionable !== true && !/complete|done|verified/i.test(readString(task, ["status"])))
  const visibleTasks = taskFilter === "actions" ? actionableTasks : taskFilter === "waiting" ? waitingTasks : taskFilter === "completed" ? tasks.filter((task) => /complete|done|verified/i.test(readString(task, ["status"]))) : tasks
  const employeeDetailsReview = React.useMemo(() => {
    const direct = asRecord(selected?.employee_details_review)
    const metadata = asRecord(selected?.metadata)
    const review = direct ?? asRecord(metadata?.employee_details_review)
    const rawSections = review?.sections
    const sections = Array.isArray(rawSections)
      ? asRecordArray(rawSections)
      : rawSections && typeof rawSections === "object"
        ? Object.entries(rawSections as Record<string, unknown>).map(([key, value]) => ({
            key,
            ...(asRecord(value) ?? {}),
          }))
        : []
    return {
      status: readString(review ?? {}, ["status"], "not_submitted").toLowerCase(),
      sections,
    }
  }, [selected])
  const returnedDetailSections = employeeDetailsReview.sections.filter(
    (section) => readString(section, ["status"]).toLowerCase() === "changes_requested"
  )

  return (
    <section className="w-full min-w-0 space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        variant="dashboard"
        eyebrow="My onboarding"
        title={
          selected
            ? readString(selected, ["title", "workflow_name", "workflowName"], "Your joining checklist")
            : "Nothing to complete"
        }
        description={
          selected
            ? "Acknowledge your offer, finish the tasks assigned to you, and attach anything HR still needs."
            : "When HR starts your onboarding, the checklist and documents will show up here."
        }
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? (
              <FluentLoadingIndicator className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {selected && Number(rowId(selected)) > 0 ? <OnboardingEmployeeMessages key={rowId(selected)} token={token()} requestId={Number(rowId(selected))} /> : null}
      {selected ? <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader header={<Text weight="semibold">Your actions</Text>} description={`${actionableTasks.length} tasks ready for you`} /><p className="text-sm">{needsAck(selected) ? "Acknowledge your onboarding request. " : ""}{contracts.some((contract) => readString(contract, ["status"]).toLowerCase() === "issued") ? "An issued contract is awaiting your review. " : ""}{returnedDetailSections.length ? `${returnedDetailSections.length} sections need correction.` : "Approved sections do not need to be reviewed again."}</p><FluentButton onClick={() => setTaskFilter("actions")}>Show my actionable tasks</FluentButton></Card>
        <Card><CardHeader header={<Text weight="semibold">Waiting on your company or workflow</Text>} description={`${waitingTasks.length} tasks not yet actionable for you`} /><p className="text-sm">Some work belongs to another team or waits for an earlier step. HR manages activation after all mandatory checks pass.</p><FluentButton onClick={() => setTaskFilter("waiting")}>Show waiting tasks</FluentButton></Card>
        <Card><CardHeader header={<Text weight="semibold">Completed</Text>} description={`${doneCount} checklist tasks completed`} /><p className="text-sm">{statusOf(selected) === "COMPLETED" ? "Your onboarding has been finalized. Any optional work remains separate." : "Completed tasks stay here for reference."}</p><FluentButton onClick={() => setTaskFilter("completed")}>Show completed tasks</FluentButton></Card>
      </div> : null}
      {returnedDetailSections.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-sm font-semibold">HR returned some details for correction</p>
          <p className="mt-1 text-xs opacity-80">
            Update the sections below, then submit the registration form again for review.
          </p>
          <div className="mt-3 space-y-2">
            {returnedDetailSections.map((section) => (
              <div
                key={readString(section, ["key"])}
                className="rounded-lg border border-amber-200 bg-white/70 p-3 dark:border-amber-900 dark:bg-black/10"
              >
                <p className="text-sm font-medium">{prettify(readString(section, ["key"], "Details"))}</p>
                <p className="mt-1 text-xs">{readString(section, ["comment"], "HR requested an update.")}</p>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/employees/registration"
            className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Correct my details
          </Link>
          <button
            type="button"
            className="ml-2 mt-3 inline-flex h-9 items-center rounded-md border border-primary px-3 text-sm font-medium text-primary"
            disabled={busy === "submit-details"}
            onClick={() => void sendCorrectedDetailsToHr()}
          >
            {busy === "submit-details" ? "Sending…" : "Send updates to HR"}
          </button>
        </div>
      ) : employeeDetailsReview.status === "submitted" || employeeDetailsReview.status === "in_review" ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          Your employee details are with HR for review. Other work follows the configured workflow.
        </div>
      ) : employeeDetailsReview.status === "approved" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          HR verified your employee details. You do not need to resubmit approved sections.
        </div>
      ) : null}

      {requests.length > 1 ? (
        <div className="flex w-full min-w-0 flex-wrap gap-1 border-b border-border/80 pb-px">
          {requests.map((row) => {
            const id = rowId(row)
            const active = id === rowId(selected)
            return (
              <button
                key={id || readString(row, ["title"])}
                type="button"
                onClick={() => setSelectedId(id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {readString(row, ["title", "workflow_name", "request_no"], `Request #${id}`)}
              </button>
            )
          })}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={rowId(selected) || "empty"}
          className="w-full min-w-0 space-y-4"
          {...motionProps}
          transition={{ duration: 0.22 }}
        >
          {selected ? (
            <>
              <CompactStatStrip
                items={[
                  {
                    label: "Status",
                    value: loading ? "…" : prettify(statusOf(selected)),
                  },
                  {
                    label: "Tasks done",
                    value: loading ? "…" : `${doneCount}/${tasks.length}`,
                  },
                  {
                    label: "Progress",
                    value: loading ? "…" : percent !== null ? `${Math.round(percent)}%` : "—",
                  },
                ]}
              />

              <CycleRail steps={STEPS} current={statusOf(selected)} />

              {contracts.length ? <section className="w-full border-y border-border py-4">
                <h2 className="text-sm font-semibold">Employment contract</h2>
                {contracts.map((contract) => <div key={rowId(contract)} className="mt-3 border-t pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div><p className="font-medium">Version {readString(contract, ["version"], "1")}</p><p className="text-xs text-muted-foreground">{prettify(readString(contract, ["contractType"]))} · {formatDate(contract.startDate)}{contract.endDate ? ` to ${formatDate(contract.endDate)}` : ""}</p></div>
                    <StatusChip value={readString(contract, ["status"])} />
                  </div>
                  {contract.documentId ? <button type="button" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary underline" onClick={() => void openContract(Number(contract.id))}><FileTextIcon className="size-4" /> Review contract</button> : null}
                  {readString(contract, ["status"]) === "ISSUED" && contract.documentId ? <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-56 space-y-1 text-xs text-muted-foreground"><span>Type your full name to sign</span><input className="h-9 w-full rounded-sm border border-border bg-background px-2 text-sm text-foreground" value={signedName} onChange={(event) => setSignedName(event.target.value)} /></label>
                    <button type="button" className={primaryButtonClass} disabled={!signedName.trim() || busy === "contract"} onClick={() => void signContract(Number(contract.id))}>{busy === "contract" ? "Signing..." : "Sign contract"}</button>
                  </div> : null}
                </div>)}
              </section> : null}

              <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Your tasks</p>
                    <p className="text-xs text-muted-foreground">
                      Started{" "}
                      {formatDate(
                        selected.started_at ?? selected.startedAt ?? selected.created_at ?? selected.createdAt
                      )}
                    </p>
                  </div>
                  <StatusChip value={statusOf(selected)} />
                </div>
                {tasks.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No tasks have been assigned to you on this request.
                  </div>
                ) : (
                  <div><FluentButton appearance="subtle" onClick={() => setTaskFilter("all")}>Show all tasks</FluentButton>{!visibleTasks.length ? <p className="p-4 text-sm">No tasks in this group.</p> : null}<ul className="divide-y divide-border/70">
                    {visibleTasks.map((task) => {
                      const id = rowId(task)
                      const done = /complete|done|verified/i.test(readString(task, ["status"]))
                      return (
                        <li
                          key={id || readString(task, ["title", "name"])}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border",
                                done
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                                  : "border-border text-muted-foreground"
                              )}
                            >
                              {done ? (
                                <CheckIcon className="size-3.5" />
                              ) : (
                                <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {readString(task, ["title", "name", "task_name"], `Task #${id}`)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {prettify(readString(task, ["status"], "pending"))}
                                {readString(task, ["due_date", "dueDate"])
                                  ? ` · due ${formatDate(task.due_date ?? task.dueDate)}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          {!done && task.is_actionable === true ? (
                            <button
                              type="button"
                              className={actionButtonClass}
                              disabled={busy === `task-${id}`}
                              onClick={() => void completeTask(task)}
                            >
                              {busy === `task-${id}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : "Done"}
                            </button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul></div>
                )}
              </div>

              <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Documents</p>
                  <div className="flex items-center gap-2">
                  <select
                    aria-label="Document type"
                    className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                  >
                    <option value="other">Other document</option>
                    <option value="identity_document">Identity document</option>
                    <option value="academic_certificate">Academic certificate</option>
                    <option value="professional_certificate">Professional certificate</option>
                    <option value="bank_document">Bank document</option>
                    <option value="medical_certificate">Medical certificate</option>
                  </select>
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busy === "upload"}
                    onClick={() => fileRef.current?.click()}
                  >
                    {busy === "upload" ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      <PaperclipIcon className="size-3.5" />
                    )}
                    Attach
                  </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (file) void uploadDocument(file)
                    }}
                  />
                </div>
                {documents.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No files on this request yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {documents.map((doc) => (
                      <li
                        key={rowId(doc) || readString(doc, ["name", "file_name"])}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {readString(doc, ["name", "file_name", "original_name", "document_type"], "Document")}
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusChip value={readString(doc, ["review_status", "status", "verification_status"], "UPLOADED")} />
                          {readString(doc, ["review_comment"]) ? <span className="max-w-48 truncate text-xs text-destructive" title={readString(doc, ["review_comment"])}>{readString(doc, ["review_comment"])}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {needsAck(selected) ? (
                <div className="w-full space-y-3 overflow-hidden rounded-xl border border-border bg-card px-4 py-4">
                  <h2 className="text-sm font-semibold">Acknowledge</h2>
                  {readString(selected, ["acknowledgement_required_version"]).trim() ? (
                    <p className="text-xs text-muted-foreground">You are acknowledging version {readString(selected, ["acknowledgement_required_version"])}</p>
                  ) : (
                    <label className="grid gap-1 text-xs font-medium">
                      Acknowledgement document version
                      <select className="h-9 rounded border border-border bg-background px-2 text-sm" value={ackDocumentId} onChange={(event) => setAckDocumentId(event.target.value)}>
                        <option value="">Select an approved document</option>
                        {documents.filter((doc) => doc.is_verified === true && readString(doc, ["review_status"]).toLowerCase() === "approved").map((doc) => <option key={String(readNumber(doc, ["id"]))} value={String(readNumber(doc, ["id"]))}>{readString(doc, ["title"], "Acknowledgement document")} · {readString(doc, ["version", "updated_at"], "version unavailable")}</option>)}
                      </select>
                    </label>
                  )}
                  {ackDocumentId ? <p className="text-xs text-muted-foreground">Selected document ID {ackDocumentId}; its exact stored version and hash will be recorded with your acknowledgement.</p> : null}
                  <Textarea
                    className={textareaClass}
                    value={ackNote}
                    onChange={(event) => setAckNote(event.target.value)}
                    rows={3}
                  />
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={busy === "ack" || !ackNote.trim() || (!readString(selected, ["acknowledgement_required_version"]).trim() && !ackDocumentId)}
                    onClick={() => void acknowledge()}
                  >
                    {busy === "ack" ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null}I accept
                  </button>
                </div>
              ) : null}
            </>
          ) : loading ? (
            <div className="flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading your onboarding...
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No onboarding request is assigned to you yet. If you just joined, give HR a moment — or refresh.
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
