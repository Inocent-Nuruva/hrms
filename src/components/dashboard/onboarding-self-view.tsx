"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckIcon, Loader2Icon, PaperclipIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

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
  uploadOnboardingDocument,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"

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
  return !acknowledged && ["SUBMITTED", "IN_PROGRESS", "PENDING_ACKNOWLEDGEMENT", "ACKNOWLEDGEMENT_PENDING"].includes(status)
}

export function OnboardingSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const reduceMotion = useReducedMotion()
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [progress, setProgress] = React.useState<AdminRecord | null>(null)
  const [tasks, setTasks] = React.useState<AdminRecord[]>([])
  const [documents, setDocuments] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState("")
  const [ackNote, setAckNote] = React.useState("I have read and accept the onboarding terms.")
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
        return
      }
      const [progressResult, taskResult, documentResult] = await Promise.allSettled([
        getOnboardingProgress(access, nextId),
        listOnboardingTasks(access, nextId),
        listOnboardingDocuments(access, nextId),
      ])
      const request = rows.find((row) => rowId(row) === nextId) ?? null
      setProgress(progressResult.status === "fulfilled" ? progressResult.value : asRecord(request?.progress) ?? request)
      setTasks(
        taskResult.status === "fulfilled"
          ? taskResult.value
          : asRecordArray(request?.tasks ?? request?.items),
      )
      setDocuments(
        documentResult.status === "fulfilled"
          ? documentResult.value
          : asRecordArray(request?.documents),
      )
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
  }, [])

  React.useEffect(() => {
    if (!selectedId) return
    const access = token()
    if (!access) return
    void Promise.allSettled([
      getOnboardingProgress(access, selectedId).then(setProgress).catch(() => undefined),
      listOnboardingTasks(access, selectedId).then(setTasks).catch(() => undefined),
      listOnboardingDocuments(access, selectedId).then(setDocuments).catch(() => undefined),
    ])
  }, [selectedId])

  const motionProps = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } }

  const percent = readNumber(progress ?? selected, [
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
      await acknowledgeOnboardingRequest(access, id, {
        accepted: true,
        acknowledgement_version: "v1",
      })
      toast.success("Onboarding acknowledged.")
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
      await completeOnboardingTask(access, requestId, taskId, {
        completion_notes: "Completed by employee",
      })
      toast.success("Task marked complete.")
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
      await uploadOnboardingDocument(access, requestId, {
        ...payload,
        document_type: "SUPPORTING",
        name: file.name,
      })
      toast.success("Document uploaded.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not upload the document.")
    } finally {
      setBusy("")
    }
  }

  const doneCount = tasks.filter((task) => /complete|done|verified/i.test(readString(task, ["status"]))).length

  return (
    <section className="w-full min-w-0 space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My onboarding"
        title={selected ? readString(selected, ["title", "workflow_name", "workflowName"], "Your joining checklist") : "Nothing to complete"}
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
            {mounted && loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
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
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {readString(row, ["title", "workflow_name", "request_no"], `Request #${id}`)}
              </button>
            )
          })}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div key={rowId(selected) || "empty"} className="w-full min-w-0 space-y-4" {...motionProps} transition={{ duration: 0.22 }}>
          {selected ? (
            <>
              <CompactStatStrip
                items={[
                  { label: "Status", value: loading ? "…" : prettify(statusOf(selected)) },
                  { label: "Tasks done", value: loading ? "…" : `${doneCount}/${tasks.length}` },
                  {
                    label: "Progress",
                    value: loading ? "…" : percent !== null ? `${Math.round(percent)}%` : "—",
                  },
                ]}
              />

              <CycleRail steps={STEPS} current={statusOf(selected)} />

              <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Your tasks</p>
                    <p className="text-xs text-muted-foreground">
                      Started {formatDate(selected.started_at ?? selected.startedAt ?? selected.created_at ?? selected.createdAt)}
                    </p>
                  </div>
                  <StatusChip value={statusOf(selected)} />
                </div>
                {tasks.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No tasks have been assigned to you on this request.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {tasks.map((task) => {
                      const id = rowId(task)
                      const done = /complete|done|verified/i.test(readString(task, ["status"]))
                      return (
                        <li key={id || readString(task, ["title", "name"])} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border",
                                done
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                                  : "border-border text-muted-foreground",
                              )}
                            >
                              {done ? <CheckIcon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
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
                          {!done ? (
                            <button
                              type="button"
                              className={actionButtonClass}
                              disabled={busy === `task-${id}`}
                              onClick={() => void completeTask(task)}
                            >
                              {busy === `task-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Done"}
                            </button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Documents</p>
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busy === "upload"}
                    onClick={() => fileRef.current?.click()}
                  >
                    {busy === "upload" ? <Loader2Icon className="size-3.5 animate-spin" /> : <PaperclipIcon className="size-3.5" />}
                    Attach
                  </button>
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
                      <li key={rowId(doc) || readString(doc, ["name", "file_name"])} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="truncate text-sm font-medium text-foreground">
                          {readString(doc, ["name", "file_name", "original_name", "document_type"], "Document")}
                        </span>
                        <StatusChip value={readString(doc, ["status", "verification_status"], "UPLOADED")} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {needsAck(selected) ? (
                <div className="w-full space-y-3 overflow-hidden rounded-xl border border-border bg-card px-4 py-4">
                  <h2 className="text-sm font-semibold">Acknowledge</h2>
                  <textarea
                    className={textareaClass}
                    value={ackNote}
                    onChange={(event) => setAckNote(event.target.value)}
                    rows={3}
                  />
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={busy === "ack" || !ackNote.trim()}
                    onClick={() => void acknowledge()}
                  >
                    {busy === "ack" ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    I accept
                  </button>
                </div>
              ) : null}
            </>
          ) : loading ? (
            <div className="flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
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
