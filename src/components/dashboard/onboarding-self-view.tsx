"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckIcon, Loader2Icon, PaperclipIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  CycleRail,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  asRecord,
  asRecordArray,
  formatDate,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
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
    void load()
    // First load only; later refresh is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <section className="space-y-6">
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
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {requests.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-border/80 pb-px">
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
        <motion.div key={rowId(selected) || "empty"} className="space-y-6" {...motionProps} transition={{ duration: 0.22 }}>
          {!selected && !loading ? (
            <p className="text-sm text-muted-foreground">
              No onboarding request is assigned to you yet. If you just joined, give HR a moment — or refresh.
            </p>
          ) : null}

          {selected ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip value={statusOf(selected)} />
                    <span className="text-xs text-muted-foreground">
                      Started {formatDate(selected.started_at ?? selected.startedAt ?? selected.created_at ?? selected.createdAt)}
                    </span>
                  </div>
                  {percent !== null ? (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full bg-primary"
                          initial={reduceMotion ? false : { width: 0 }}
                          animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                          transition={{ duration: 0.45 }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <CycleRail steps={STEPS} current={statusOf(selected)} />

              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-semibold">Your tasks</h2>
                    <p className="text-xs text-muted-foreground">
                      {tasks.filter((task) => /complete|done/i.test(readString(task, ["status"]))).length}/{tasks.length} done
                    </p>
                  </div>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks have been assigned to you on this request.</p>
                  ) : (
                    <ul className="divide-y divide-border/80">
                      {tasks.map((task) => {
                        const id = rowId(task)
                        const done = /complete|done|verified/i.test(readString(task, ["status"]))
                        return (
                          <li key={id || readString(task, ["title", "name"])} className="flex items-center gap-3 py-3">
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
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {readString(task, ["title", "name", "task_name"], `Task #${id}`)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {prettify(readString(task, ["status"], "pending"))}
                                {readString(task, ["due_date", "dueDate"])
                                  ? ` · due ${formatDate(task.due_date ?? task.dueDate)}`
                                  : ""}
                              </p>
                            </div>
                            {!done ? (
                              <button
                                type="button"
                                className={secondaryButtonClass}
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

                <div className="min-w-0 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold">Documents</h2>
                    <button
                      type="button"
                      className={secondaryButtonClass}
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
                    <p className="text-sm text-muted-foreground">No files on this request yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/80">
                      {documents.map((doc) => (
                        <li key={rowId(doc) || readString(doc, ["name", "file_name"])} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="truncate text-sm">
                            {readString(doc, ["name", "file_name", "original_name", "document_type"], "Document")}
                          </span>
                          <StatusChip value={readString(doc, ["status", "verification_status"], "UPLOADED")} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {needsAck(selected) ? (
                <div className="space-y-3 border-t border-border/80 pt-4">
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
          ) : null}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
