"use client"

import * as React from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { useRecordForm, type RecordFormField } from "@/components/dashboard/profile-records/record-form-dialog"
import { adminRequest, buildUrl, fileToBase64UploadDto, type AdminRecord } from "@/lib/admin-api"
import { toast } from "@/components/ui/fluent-toast-store"

// Employee's own documents. The server resolves the employee from the session
// and only lists that employee's documents; edit/delete are allowed only on
// documents the employee uploaded (`can_modify`). HR-added documents are
// read-only here.

// Same fields and inputs as HR's document form: "type" renders the document
// type select and "expiry_date" the date picker (via renderEntryInput). The
// expiry date is stored in the document's metadata.
const DOCUMENT_FIELDS: RecordFormField[] = [
  { name: "title", label: "Title", required: true },
  { name: "type", label: "Document type", required: true },
  { name: "expiry_date", label: "Expiry date" },
  { name: "notes", label: "Notes" },
]

const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.doc,.docx"

function expiryOf(record: AdminRecord) {
  const metadata = record.metadata as { expiry_date?: unknown } | null | undefined
  const value = metadata?.expiry_date
  return typeof value === "string" && value ? value.slice(0, 10) : ""
}

function documentPayload(values: Record<string, string>, editing: boolean): AdminRecord {
  const { expiry_date: expiry = "", ...rest } = values
  const out = cleanForm(rest, editing)
  if (editing) out.expiry_date = expiry.trim()
  else if (expiry.trim()) out.metadata = { expiry_date: expiry.trim() }
  return out
}

function unwrapList(payload: unknown): AdminRecord[] {
  if (Array.isArray(payload)) return payload as AdminRecord[]
  const inner = (payload as { data?: unknown } | null)?.data
  return Array.isArray(inner) ? (inner as AdminRecord[]) : []
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again."
}

function cleanForm(values: Record<string, string>, editing: boolean): AdminRecord {
  const out: AdminRecord = {}
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim()
    if (value) out[key] = value
    else if (editing) out[key] = ""
  }
  return out
}

function listMyDocuments(token: string) {
  return adminRequest<unknown>(`/api/employees/me/documents`, { token }).then(unwrapList)
}

async function uploadMyDocument(token: string, file: File, meta: AdminRecord) {
  return adminRequest<unknown>(`/api/employees/me/documents`, {
    method: "POST",
    token,
    body: { ...meta, file: await fileToBase64UploadDto(file) },
  })
}

function updateMyDocument(token: string, id: number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/employees/me/documents/${id}`, { method: "PATCH", token, body: data })
}

function deleteMyDocument(token: string, id: number) {
  return adminRequest<unknown>(`/api/employees/me/documents/${id}`, { method: "DELETE", token })
}

async function downloadMyDocument(token: string, id: number, fileName: string) {
  const response = await fetch(buildUrl(`/api/employees/me/documents/${id}/download`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Could not download this document.")
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function MyDocumentsSection({ token }: { token: string }) {
  const [documents, setDocuments] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const form = useRecordForm()

  const load = React.useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setDocuments(await listMyDocuments(token))
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void load()
  }, [load])

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await work()
      toast.success(success)
      await load()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async () => {
    const result = await form.open(DOCUMENT_FIELDS, {
      title: "Add Documents Record",
      description: "Fill in the details and choose the file to upload.",
      confirmLabel: "Upload",
      file: { label: "Attachment", accept: ACCEPTED_FILES, hint: "PDF, image or Word file." },
    })
    if (!result?.file) return
    const file = result.file
    await run(() => uploadMyDocument(token, file, documentPayload(result.values, false)), "Document uploaded.")
  }

  const handleEdit = async (record: AdminRecord, id: number) => {
    const result = await form.open(
      DOCUMENT_FIELDS.map((field) => ({
        ...field,
        defaultValue: field.name === "expiry_date" ? expiryOf(record) : String(record[field.name] ?? ""),
      })),
      { title: "Edit Documents Record", description: "Update the details of this document.", confirmLabel: "Save" },
    )
    if (!result) return
    await run(() => updateMyDocument(token, id, documentPayload(result.values, true)), "Document updated.")
  }

  const handleDelete = async (record: AdminRecord, id: number) => {
    const ok = await fluentConfirm(`"${String(record.title ?? "This document")}" will be removed from your profile.`, {
      title: "Delete document?",
      confirmLabel: "Delete",
    })
    if (!ok) return
    await run(() => deleteMyDocument(token, id), "Document removed.")
  }

  return (
    <div className="space-y-2">
      {form.dialog}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Documents ({documents.length})</p>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !token}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          Add
        </button>
      </div>
      {loading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>
      ) : documents.length ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {documents.map((record) => {
            const id = Number(record.id)
            if (!Number.isFinite(id) || id <= 0) return null
            const name = String(record.title ?? record.original_file_name ?? "Document")
            const meta = [
              record.type ? String(record.type).replace(/_/g, " ") : null,
              expiryOf(record) ? `Expires ${new Date(expiryOf(record)).toLocaleDateString()}` : null,
              record.uploaded_at ? new Date(String(record.uploaded_at)).toLocaleDateString() : null,
              record.can_modify ? null : "Added by HR",
            ].filter(Boolean)
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    title="Download"
                    className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                    onClick={() =>
                      void downloadMyDocument(token, id, String(record.original_file_name ?? name)).catch((error) =>
                        toast.error(errorText(error)),
                      )
                    }
                  >
                    {name}
                  </button>
                  <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>
                </div>
                {record.can_modify ? (
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit document"
                      title="Edit"
                      disabled={busy}
                      onClick={() => void handleEdit(record, id)}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete document"
                      title="Delete"
                      disabled={busy}
                      onClick={() => void handleDelete(record, id)}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">No documents yet.</p>
      )}
    </div>
  )
}
