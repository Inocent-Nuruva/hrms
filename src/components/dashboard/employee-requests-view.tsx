"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react"
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { CheckmarkCircle20Filled } from "@fluentui/react-icons"
import { toast } from "@/components/ui/fluent-toast-store"

import {
  CompactStatStrip,
  StatusChip,
  actionButtonClass,
  formatDate,
  inputClass,
  optionLabel,
  pageBleedClass,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  cancelMyProfileChangeRequest,
  createMyProfileChangeRequest,
  deleteMyProfileChangeRequest,
  downloadMyDocument,
  fileToBase64UploadDto,
  getMyProfileChangeRequest,
  listMyDocuments,
  listMyProfileChangeRequestHistory,
  listMyProfileChangeRequests,
  listMyRequests,
  previewMyProfileChangeRequestFile,
  submitMyProfileChangeRequest,
  submitMyResignation,
  uploadMyDocument,
  uploadMyProfileChangePhoto,
  validateMyProfileChangeRequest,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { RequestActionInbox } from "./request-action-inbox"
import { listAllMyActionItems } from "@/lib/admin-api"
import { isOpenAction } from "./request-inbox-utils"

export type RequestsSelfTab = "actions" | "timeline" | "documents" | "profile-changes" | "resignation"

const TAB_COPY: Record<
  RequestsSelfTab,
  { title: string; description: string; empty: string; table: string }
> = {
  actions: {
    title: "Waiting on you",
    description: "Approvals, tasks, and follow-ups that need your attention.",
    empty: "Nothing is waiting on you right now.",
    table: "Your to-do list",
  },
  timeline: {
    title: "Request history",
    description: "Leave, documents, profile updates, and other requests you have sent.",
    empty: "You have not sent any requests yet.",
    table: "Your requests",
  },
  documents: {
    title: "My documents",
    description: "Keep copies of your ID, certificates, and other files HR may need.",
    empty: "No documents uploaded yet.",
    table: "Uploaded files",
  },
  "profile-changes": {
    title: "Update my details",
    description: "Ask HR to change your name, phone, address, or emergency contact.",
    empty: "You have not asked HR to change your details yet.",
    table: "Change requests",
  },
  resignation: {
    title: "Leave the company",
    description: "Tell HR your last working day. Someone will review this before it is final.",
    empty: "",
    table: "",
  },
}

const DOCUMENT_TYPES = [
  { value: "", label: "General" },
  { value: "ID", label: "National ID / passport" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "CONTRACT", label: "Contract" },
  { value: "CV", label: "CV / resume" },
  { value: "OTHER", label: "Other" },
] as const

const PROFILE_CHANGE_FIELDS: Record<string, Array<{ key: string; label: string; type?: string }>> = {
  PERSONAL_INFORMATION: [
    { key: "first_name", label: "First name" },
    { key: "middle_name", label: "Middle name" },
    { key: "last_name", label: "Last name" },
    { key: "date_of_birth", label: "Date of birth", type: "date" },
    { key: "gender", label: "Gender" },
    { key: "nationality", label: "Nationality" },
  ],
  CONTACT_INFORMATION: [
    { key: "phone", label: "Phone" },
    { key: "alternative_phone", label: "Other phone" },
    { key: "email", label: "Email", type: "email" },
  ],
  ADDRESS_INFORMATION: [
    { key: "address_line_1", label: "Address" },
    { key: "city", label: "City" },
    { key: "region", label: "Region" },
    { key: "postal_code", label: "Postal code" },
    { key: "country", label: "Country" },
  ],
  EMERGENCY_CONTACT: [
    { key: "name", label: "Contact name" },
    { key: "relationship", label: "Relationship" },
    { key: "phone", label: "Phone" },
  ],
  PROFILE_PHOTO: [],
  OTHER_PROFILE_INFORMATION: [
    { key: "field", label: "What to change" },
    { key: "value", label: "New value" },
  ],
}

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function profileChangeFiles(row: AdminRecord | null) {
  if (!row) return [] as Array<{ id: string; name: string }>
  const candidates = [row.files, row.pendingFiles, row.pending_files, row.attachments, row.file]
  const files: Array<{ id: string; name: string }> = []
  for (const candidate of candidates) {
    const list = Array.isArray(candidate) ? candidate : candidate ? [candidate] : []
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const record = item as AdminRecord
      const id = rowId(record)
      if (!id) continue
      files.push({
        id,
        name: readString(record, ["fileName", "file_name", "name", "originalName"], `File ${id}`),
      })
    }
  }
  return files
}

function collectChangePayload(requestType: string, form: Record<string, string>) {
  if (requestType === "OTHER_PROFILE_INFORMATION") {
    const field = form.field?.trim()
    const value = form.value?.trim()
    if (!field || !value) return {}
    return { [field]: value }
  }
  const payload: Record<string, string> = {}
  for (const field of PROFILE_CHANGE_FIELDS[requestType] ?? []) {
    const value = form[field.key]?.trim()
    if (value) payload[field.key] = value
  }
  return payload
}

export function EmployeeRequestsView({ activeTab }: { activeTab: RequestsSelfTab }) {
  const leaveIfForbidden = useLeaveIfForbidden()
  const copy = TAB_COPY[activeTab]
  const [actions, setActions] = React.useState<AdminRecord[]>([])
  const [timeline, setTimeline] = React.useState<AdminRecord[]>([])
  const [documents, setDocuments] = React.useState<AdminRecord[]>([])
  const [changes, setChanges] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"document" | "change" | "resign">("document")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [file, setFile] = React.useState<File | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyRows, setHistoryRows] = React.useState<AdminRecord[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Please log in again to see your requests.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const tasks: Array<Promise<unknown>> = []
    if (activeTab === "actions") {
      tasks.push(
        listAllMyActionItems(token)
          .then(setActions)
          .catch((errorObject) => {
            setActions([])
            throw errorObject
          }),
      )
    }
    if (activeTab === "timeline") {
      tasks.push(
        listMyRequests(token, { limit: 50 })
          .then(setTimeline)
          .catch((errorObject) => {
            setTimeline([])
            throw errorObject
          }),
      )
    }
    if (activeTab === "documents") {
      tasks.push(
        listMyDocuments(token)
          .then(setDocuments)
          .catch((errorObject) => {
            setDocuments([])
            throw errorObject
          }),
      )
    }
    if (activeTab === "profile-changes") {
      tasks.push(
        listMyProfileChangeRequests(token, { limit: 50 })
          .then(setChanges)
          .catch((errorObject) => {
            setChanges([])
            throw errorObject
          }),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load this page.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden])

  React.useEffect(() => {
    setMounted(true)
    void load()
  }, [load])

  function openCreate(mode: "document" | "change" | "resign") {
    setCreateMode(mode)
    setForm(mode === "change" ? { request_type: "CONTACT_INFORMATION" } : {})
    setFile(null)
    setFormError(null)
    setCreateOpen(true)
  }

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "document") {
        if (!form.title || !file) throw new Error("Add a title and choose a file.")
        await uploadMyDocument(token, {
          title: form.title,
          description: form.description || undefined,
          document_type_code: form.document_type_code || undefined,
          expiry_date: form.expiry_date || undefined,
          file: await fileToBase64UploadDto(file),
        })
        toast.success("Document uploaded.")
      } else if (createMode === "change") {
        const requestType = form.request_type || "CONTACT_INFORMATION"
        if (requestType === "PROFILE_PHOTO") {
          if (!file) throw new Error("Choose a photo to send for HR approval.")
          await uploadMyProfileChangePhoto(token, file)
          toast.success("Photo sent to HR for review.")
        } else {
          const changesPayload = collectChangePayload(requestType, form)
          if (Object.keys(changesPayload).length === 0) {
            throw new Error("Fill in at least one new value.")
          }
          const payload = {
            request_type: requestType,
            changes: changesPayload,
            reason: form.reason || undefined,
          }
          await validateMyProfileChangeRequest(token, payload)
          await createMyProfileChangeRequest(token, payload)
          toast.success("Sent to HR for review.")
        }
      } else {
        if (!form.last_working_date || !form.reason) {
          throw new Error("Last working day and a short reason are required.")
        }
        await submitMyResignation(token, {
          last_working_date: form.last_working_date,
          reason: form.reason,
          notice_date: form.notice_date || undefined,
        })
        toast.success("Resignation sent to HR.")
      }
      setCreateOpen(false)
      setFile(null)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const pendingActions = actions.filter(isOpenAction).length
  const doneActions = actions.filter((row) => readString(row, ["status"]).toUpperCase() === "COMPLETED").length

  const rows =
    activeTab === "timeline"
        ? timeline
        : activeTab === "documents"
          ? documents
          : changes

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "documents") {
      return [
        { key: "title", label: "Document", render: (row) => optionLabel(row) },
        {
          key: "type",
          label: "Type",
          render: (row) =>
            prettify(readString(row, ["documentTypeCode", "document_type_code", "type"], "General")),
        },
        { key: "expiry", label: "Expires", render: (row) => formatDate(row.expiryDate ?? row.expiry_date) },
        {
          key: "actions",
          label: "",
          render: (row) => {
            const id = rowId(row)
            return (
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === id}
                onClick={() => {
                  const token = readStoredToken()
                  if (!token || !id) return
                  setBusyId(id)
                  void downloadMyDocument(token, id)
                    .then((result) => downloadBlob(result.blob, result.filename))
                    .catch((errorObject) =>
                      toast.error(errorObject instanceof Error ? errorObject.message : "Could not download."),
                    )
                    .finally(() => setBusyId(""))
                }}
              >
                Download
              </button>
            )
          },
        },
      ]
    }
    if (activeTab === "profile-changes") {
      return [
        {
          key: "type",
          label: "What you asked to change",
          render: (row) => prettify(readString(row, ["requestType", "request_type"], "Details")),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} />,
        },
        { key: "reason", label: "Why", render: (row) => readString(row, ["reason"], "—") },
        {
          key: "actions",
          label: "",
          render: (row) => {
            const id = rowId(row)
            const status = readString(row, ["status"]).toUpperCase()
            return (
              <div className="flex flex-wrap gap-1">
                {["DRAFT", "CORRECTION_REQUIRED"].includes(status) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `sub-${id}`}
                    onClick={() => {
                      const token = readStoredToken()
                      if (!token || !id) return
                      setBusyId(`sub-${id}`)
                      void submitMyProfileChangeRequest(token, id)
                        .then(() => {
                          toast.success("Sent to HR.")
                          return load()
                        })
                        .catch((errorObject) =>
                          toast.error(errorObject instanceof Error ? errorObject.message : "Could not send."),
                        )
                        .finally(() => setBusyId(""))
                    }}
                  >
                    Send to HR
                  </button>
                ) : null}
                {["DRAFT", "SUBMITTED", "IN_REVIEW"].includes(status) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `can-${id}`}
                    onClick={() => {
                      const token = readStoredToken()
                      if (!token || !id) return
                      setBusyId(`can-${id}`)
                      void cancelMyProfileChangeRequest(token, id)
                        .then(() => {
                          toast.success("Cancelled.")
                          return load()
                        })
                        .catch((errorObject) =>
                          toast.error(errorObject instanceof Error ? errorObject.message : "Could not cancel."),
                        )
                        .finally(() => setBusyId(""))
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
                {status === "DRAFT" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `del-${id}`}
                    onClick={() => {
                      const token = readStoredToken()
                      if (!token || !id) return
                      setBusyId(`del-${id}`)
                      void deleteMyProfileChangeRequest(token, id)
                        .then(() => {
                          toast.success("Deleted.")
                          return load()
                        })
                        .catch((errorObject) =>
                          toast.error(errorObject instanceof Error ? errorObject.message : "Could not delete."),
                        )
                        .finally(() => setBusyId(""))
                    }}
                  >
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `hist-${id}`}
                  onClick={() => {
                    const token = readStoredToken()
                    if (!token || !id) return
                    setBusyId(`hist-${id}`)
                    setHistoryOpen(true)
                    setHistoryLoading(true)
                    void listMyProfileChangeRequestHistory(token, id)
                      .then(setHistoryRows)
                      .catch((errorObject) => {
                        setHistoryRows([])
                        toast.error(errorObject instanceof Error ? errorObject.message : "Could not load history.")
                      })
                      .finally(() => {
                        setHistoryLoading(false)
                        setBusyId("")
                      })
                  }}
                >
                  History
                </button>
                {profileChangeFiles(row).map((fileItem) => (
                  <button
                    key={fileItem.id}
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `file-${fileItem.id}`}
                    onClick={() => {
                      const token = readStoredToken()
                      if (!token || !id) return
                      setBusyId(`file-${fileItem.id}`)
                      void previewMyProfileChangeRequestFile(token, id, fileItem.id)
                        .then((result) => downloadBlob(result.blob, result.filename))
                        .catch((errorObject) =>
                          toast.error(errorObject instanceof Error ? errorObject.message : "Could not open file."),
                        )
                        .finally(() => setBusyId(""))
                    }}
                  >
                    {fileItem.name}
                  </button>
                ))}
              </div>
            )
          },
        },
      ]
    }
    if (activeTab === "timeline") {
      return [
        {
          key: "item",
          label: "Request",
          render: (row) =>
            readString(row, ["title", "summary", "name", "requestType", "request_type"], `Request #${rowId(row)}`),
        },
        {
          key: "kind",
          label: "Type",
          render: (row) =>
            prettify(readString(row, ["sourceModule", "source_module", "module", "type", "kind"], "Request")),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} />,
        },
        {
          key: "when",
          label: "Updated",
          render: (row) => formatDate(row.updatedAt ?? row.updated_at ?? row.createdAt ?? row.created_at),
        },
      ]
    }
    return [
      {
        key: "item",
        label: "What to do",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium">
              {readString(row, ["title", "summary", "name", "module"], `Task #${rowId(row)}`)}
            </p>
            {readString(row, ["description"], "") ? (
              <p className="mt-0.5 max-w-xl whitespace-normal text-xs text-muted-foreground">
                {readString(row, ["description"], "")}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "module",
        label: "From",
        render: (row) => prettify(readString(row, ["sourceModule", "source_module", "module"], "HR")),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => {
          const status = readString(row, ["status"], "OPEN")
          const waiting = row.is_actionable === false && ["OPEN", "PENDING", "TODO", "ACTION_REQUIRED"].includes(status.toUpperCase())
          return <StatusChip value={waiting ? "Waiting" : status} />
        },
      },
      {
        key: "when",
        label: "Due",
        render: (row) => formatDate(row.dueAt ?? row.due_at ?? row.updatedAt ?? row.updated_at),
      },
    ]
  }, [activeTab, busyId, load])

  const changeFields = PROFILE_CHANGE_FIELDS[form.request_type || "CONTACT_INFORMATION"] ?? []
  const summaryItems =
    activeTab === "timeline"
        ? [
            { label: "Requests sent", value: loading ? "…" : String(timeline.length) },
            { label: "Open", value: loading ? "…" : "—" },
            { label: "Updated", value: loading ? "…" : "—" },
          ]
        : activeTab === "documents"
          ? [
              { label: "Files uploaded", value: loading ? "…" : String(documents.length) },
              { label: "Ready", value: loading ? "…" : String(documents.length) },
              { label: "Pending", value: "—" },
            ]
          : activeTab === "profile-changes"
            ? [
                { label: "Change requests", value: loading ? "…" : String(changes.length) },
                { label: "Waiting", value: loading ? "…" : "—" },
                { label: "Reviewed", value: "—" },
              ]
            : [
                { label: "Notice", value: "HR review" },
                { label: "Ends employment", value: "After offboarding" },
                { label: "Start here", value: "Send to HR" },
              ]

  return (
    <section className="w-full min-w-0 space-y-4">
      <header
        className={cn(
          "flex min-w-0 flex-col gap-3 border-b border-border bg-background px-3 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-4",
          pageBleedClass,
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            My requests
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
              {copy.title}
              {activeTab === "actions" ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  {loading ? "…" : pendingActions}
                </span>
              ) : null}
            </h1>
            {activeTab === "actions" ? (
              <span className="flex items-center gap-1.5 text-xs tabular-nums">
                {loading ? (
                  <span className="text-muted-foreground">Updating…</span>
                ) : (
                  <>
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      {doneActions} completed
                    </span>
                  </>
                )}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
            Refresh
          </button>
          {activeTab === "documents" ? (
            <button type="button" className={primaryButtonClass} onClick={() => openCreate("document")}>
              <PlusIcon className="size-4" /> Upload a file
            </button>
          ) : null}
          {activeTab === "profile-changes" ? (
            <button type="button" className={primaryButtonClass} onClick={() => openCreate("change")}>
              <PlusIcon className="size-4" /> Ask HR to update
            </button>
          ) : null}
        </div>
      </header>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {activeTab !== "actions" ? (
        <CompactStatStrip items={summaryItems} />
      ) : null}

      {activeTab === "actions" ? (
        <RequestActionInbox actions={actions} loading={loading} onRefresh={load} />
      ) : activeTab === "resignation" ? (
        <div className={cn("space-y-4 border-y border-border bg-card px-4 py-5 sm:border-x sm:px-5", pageBleedClass)}>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Send a resignation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This notifies HR. It does not end your employment until they complete offboarding.
            </p>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Last working day</span>
            <DateInput

              className={inputClass}
              value={form.last_working_date ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, last_working_date: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Notice date (optional)</span>
            <DateInput

              className={inputClass}
              value={form.notice_date ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, notice_date: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason</span>
            <Textarea
              className={textareaClass}
              value={form.reason ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="A short note for HR"
            />
          </label>
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setCreateMode("resign")
              void onSave()
            }}
            disabled={saving}
          >
            {saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : "Send to HR"}
          </button>
        </div>
      ) : (
        <div className={cn("overflow-hidden border-y border-border bg-card sm:border-x", pageBleedClass)}>
          <ResizableTable
            title={copy.table}
            data={rows}
            columns={columns}
            loading={loading}
            itemsPerPage={20}
            showExport={false}
            storageKey={`me-requests-${activeTab}`}
            emptyContent={
              <div className="flex flex-col items-center py-6 text-center">
                <div className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckmarkCircle20Filled className="size-5" aria-hidden />
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {copy.empty}
                </p>
                <p className="mt-0.5 max-w-sm text-xs text-muted-foreground">
                  New requests will appear here when available.
                </p>
              </div>
            }
            onRowSelect={(_, row) => {
              if (!row) return
              setDetail(row)
              const token = readStoredToken()
              const id = rowId(row)
              if (token && id && activeTab === "profile-changes") {
                void getMyProfileChangeRequest(token, id)
                  .then((record) => record && setDetail(record))
                  .catch(() => undefined)
              }
            }}
          />
        </div>
      )}

      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={optionLabel(detail)}
        row={detail}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {createMode === "document"
                ? "Upload a document"
                : createMode === "change"
                  ? "Ask HR to update your details"
                  : "Send a resignation"}
            </DialogTitle>
            <DialogDescription>
              {createMode === "document"
                ? "Give the file a clear name so HR can find it later."
                : createMode === "change"
                  ? "Fill in only the fields that should change. HR will review before anything is updated."
                  : "Tell HR your last working day."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "document" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Title</span>
                  <input
                    className={inputClass}
                    value={form.title ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. National ID"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    className="w-full"
                    value={form.document_type_code ?? ""}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, document_type_code: value }))
                    }
                    options={DOCUMENT_TYPES.map((type) => ({ value: type.value, label: type.label }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Expires (optional)</span>
                  <DateInput

                    className={inputClass}
                    value={form.expiry_date ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, expiry_date: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Notes (optional)</span>
                  <Textarea
                    className={textareaClass}
                    value={form.description ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">File</span>
                  <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
              </>
            ) : null}
            {createMode === "change" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">What should change</span>
                  <FluentSelect
                    ariaLabel="What should change"
                    className="w-full"
                    value={form.request_type ?? "CONTACT_INFORMATION"}
                    onChange={(value) =>
                      setForm((current) => ({ request_type: value, reason: current.reason ?? "" }))
                    }
                    options={[
                      { value: "CONTACT_INFORMATION", label: "Phone or email" },
                      { value: "PERSONAL_INFORMATION", label: "Name or personal details" },
                      { value: "ADDRESS_INFORMATION", label: "Address" },
                      { value: "EMERGENCY_CONTACT", label: "Emergency contact" },
                      { value: "PROFILE_PHOTO", label: "Profile photo" },
                      { value: "OTHER_PROFILE_INFORMATION", label: "Something else" },
                    ]}
                  />
                </label>
                {form.request_type === "PROFILE_PHOTO" ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  changeFields.map((field) => (
                    <label key={field.key} className="grid gap-1.5 text-sm">
                      <span className="font-medium">{field.label}</span>
                      <input
                        type={field.type ?? "text"}
                        className={inputClass}
                        value={form[field.key] ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    </label>
                  ))
                )}
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Why (optional)</span>
                  <Textarea
                    className={textareaClass}
                    value={form.reason ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="A short note for HR"
                  />
                </label>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>
              {saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : createMode === "change" ? "Send to HR" : "Upload"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Request history</DialogTitle>
            <DialogDescription>Audit events for this profile change request.</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto">
              {historyRows.map((row, index) => (
                <div key={rowId(row) || index} className="border-b border-border py-2 text-sm last:border-0">
                  <p className="font-medium">
                    {prettify(readString(row, ["action", "event", "status", "type"], "Update"))}
                  </p>
                  <p className="text-muted-foreground">
                    {readString(row, ["comment", "note", "message"], formatDate(row.createdAt ?? row.created_at))}
                  </p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
