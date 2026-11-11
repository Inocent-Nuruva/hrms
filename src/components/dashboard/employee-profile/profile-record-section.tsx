"use client"

import * as React from "react"
import {
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UnlinkIcon,
  UserRoundXIcon,
} from "lucide-react"
import { CountryFlag } from "@/components/country-flag"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  createEmployeeDocument,
  createEmployeeSectionItem,
  deleteEmployeeDocument,
  deleteEmployeeSectionItem,
  downloadEmployeeDocument,
  fileToBase64UploadDto,
  patchEmployeeSectionItem,
  removeEmployeeLinkedAccount,
  unlinkEmployeeCompanyUser,
  type AdminRecord,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import {
  readStoredToken,
  readString,
  recordPreview,
  renderRecordFields,
  readNumber,
  sectionTitleToApiSection,
  sectionTitleToRouteKey,
  findCountryOption,
  formatFileSize,
  renderEntryInput,
  sectionSchema,
  editableEntries,
} from "@/components/dashboard/employee-profile/profile-shared"

export function Section({
  title,
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  title: string
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const [editingRecord, setEditingRecord] = React.useState<{ item: AdminRecord; index: number } | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<{ item: AdminRecord; index: number } | null>(null)
  const [linkedAccountAction, setLinkedAccountAction] = React.useState<"unlink" | "remove" | null>(null)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editForm, setEditForm] = React.useState<Record<string, string>>({})
  const [addForm, setAddForm] = React.useState<Record<string, string>>({})
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null)
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState("")
  const token = readStoredToken()
  const apiSection = sectionTitleToApiSection(title)
  const isDocumentsSection = title.toLowerCase() === "documents"
  const isContactsSection = title.toLowerCase() === "contacts"
  const routeKey = sectionTitleToRouteKey(title)
  const isHighlighted = requestedRouteKey === routeKey
  const supportsMutations = Boolean((apiSection || isDocumentsSection) && employeeId)
  const supportsAdd = supportsMutations
  const supportsDelete = supportsMutations
  const supportsEdit = Boolean(apiSection && !isDocumentsSection)

  React.useEffect(() => {
    if (!editingRecord) {
      setEditForm({})
      return
    }
    const initial = Object.fromEntries(
      editableEntries(editingRecord.item, title).map((entry) => [entry.key, entry.value])
    )
    setEditForm(initial)
  }, [editingRecord, title])

  const templateEntries = React.useMemo(() => {
    return sectionSchema(title)
  }, [title])

  React.useEffect(() => {
    if (!addingRecord) {
      setAddForm({})
      setDocumentUploadFile(null)
      return
    }
    const initial = Object.fromEntries(templateEntries.map((entry) => [entry.key, entry.value]))
    setAddForm(initial)
  }, [addingRecord, templateEntries])

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label={`${title} section`}
        className={cn(
          "scroll-mt-24 outline-none",
          isHighlighted && "ring-2 ring-primary/30"
        )}
      >
        {supportsAdd || items.length === 0 || isHighlighted ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {items.length === 0 ? (
              <span className="text-xs font-medium text-primary/70">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="bg-primary/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Needs attention
              </span>
            ) : null}
          </div>
          {supportsAdd ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>
        ) : null}
        {mutationError && !addingRecord && !deletingRecord && !editingRecord ? (
          <p className="mb-2 text-sm text-rose-600">{mutationError}</p>
        ) : null}
        {items.length === 0 ? (
          <p className="border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No data available.
          </p>
        ) : (
          <div>
            {items.map((item, index) => (
              <div
                key={`${title}-${index}`}
                className="border-t border-border py-3 first:border-t-0 first:pt-0"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-foreground">{recordPreview(item)}</p>
                    {isDocumentsSection ? (
                      (() => {
                        const documentUrl = readString(item, ["file_url"])
                        if (documentUrl === "-") {
                          return null
                        }
                        return (
                          <a
                            href={documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                          >
                            Open attachment
                          </a>
                        )
                      })()
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.__linked_account === true &&
                    item.__can_manage_linked_account === true &&
                    employeeId &&
                    token ? (
                      <>
                        <button
                          type="button"
                          aria-label="Unlink user account from employee"
                          className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => setLinkedAccountAction("unlink")}
                        >
                          <UnlinkIcon className="size-4" /> Unlink
                        </button>
                        <button
                          type="button"
                          aria-label="Delete linked account access"
                          className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                          onClick={() => setLinkedAccountAction("remove")}
                        >
                          <UserRoundXIcon className="size-4" /> Delete access
                        </button>
                      </>
                    ) : null}
                    {isDocumentsSection && employeeId && token ? (
                      <button
                        type="button"
                        aria-label={`Download ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                        disabled={downloadingId === String(readNumber(item.id) ?? index)}
                        onClick={() => {
                          const itemId = readNumber(item.id)
                          if (itemId === null) {
                            setMutationError("This file does not have an id to download.")
                            return
                          }
                          setDownloadingId(String(itemId))
                          void downloadEmployeeDocument(token, employeeId, itemId)
                            .then((result) => {
                              const url = URL.createObjectURL(result.blob)
                              const link = document.createElement("a")
                              link.href = url
                              link.download = result.filename
                              link.click()
                              URL.revokeObjectURL(url)
                            })
                            .catch((errorObject) => {
                              setMutationError(
                                errorObject instanceof Error
                                  ? errorObject.message
                                  : "Could not download this file.",
                              )
                            })
                            .finally(() => setDownloadingId(""))
                        }}
                      >
                        <DownloadIcon className="size-4" />
                      </button>
                    ) : null}
                    {supportsEdit && readNumber(item.id) !== null ? (
                      <button
                        type="button"
                        aria-label={`Edit ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord({ item, index })}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                    ) : null}
                    {supportsDelete && readNumber(item.id) !== null ? (
                      <button
                        type="button"
                        aria-label={`${isContactsSection ? "Remove" : "Delete"} ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord({ item, index })}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  {renderRecordFields(item, title)
                    .filter((entry) => entry.value.trim() !== "" && entry.value !== "-" && entry.value !== "Available")
                    .map((entry) => (
                      <div key={`${title}-${index}-${entry.label}`} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {entry.label}
                        </p>
                        {entry.label.toLowerCase().includes("country") ? (
                          <span className="inline-flex items-center gap-1 break-words text-foreground">
                            {(() => {
                              const option = findCountryOption(entry.value)
                              if (!option) {
                                return null
                              }
                              return (
                                <CountryFlag
                                  code={option.code}
                                  className="h-3 w-4 rounded-sm border border-border"
                                />
                              )
                            })()}
                            <span>{entry.value}</span>
                          </span>
                        ) : (
                          <p className="break-words text-foreground">{entry.value}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit {title} Record</AlertDialogTitle>
            <AlertDialogDescription>
              Update the selected {title.toLowerCase()} information for this employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {editingRecord
              ? editableEntries(editingRecord.item, title).map((entry) => (
                  <div key={entry.key} className={entry.key === "responsibilities_description" || entry.key === "notes" ? "sm:col-span-2" : ""}>
                    {renderEntryInput({
                      entry,
                      value: editForm[entry.key] ?? entry.value,
                      onChange: (value) => {
                        setEditForm((current) => ({ ...current, [entry.key]: value }))
                      },
                    })}
                  </div>
                ))
              : null}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Close</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !editingRecord || !supportsEdit}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                if (!editingRecord || !apiSection || !employeeId || !token) {
                  return
                }
                const itemId = readNumber(editingRecord.item.id)
                if (itemId === null) {
                  setMutationError("Missing record id; cannot update this item.")
                  return
                }
                const payload: AdminRecord = {}
                for (const entry of editableEntries(editingRecord.item, title)) {
                  const raw = editForm[entry.key] ?? entry.value
                  payload[entry.key] = entry.kind === "boolean" ? raw === "true" : raw
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (!apiSection) {
                    setMutationError("Edit is not supported for this section.")
                    return
                  }
                  await patchEmployeeSectionItem(token, employeeId, apiSection, itemId, payload)
                  setEditingRecord(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to update record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={linkedAccountAction !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setLinkedAccountAction(null)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {linkedAccountAction === "remove"
                ? "Delete linked account access?"
                : "Unlink this user account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {linkedAccountAction === "remove"
                ? "The login will be detached from this employee and its company access will be deactivated. The employee profile and audit history will be retained."
                : "The login will be detached from this employee. The user account will remain available as a separate company account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? (
            <p className="text-sm text-rose-600">{mutationError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !employeeId || !token}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50",
                linkedAccountAction === "remove"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-primary",
              )}
              onClick={async () => {
                if (!linkedAccountAction || !employeeId || !token) return
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (linkedAccountAction === "remove") {
                    await removeEmployeeLinkedAccount(token, employeeId)
                  } else {
                    await unlinkEmployeeCompanyUser(token, employeeId)
                  }
                  setLinkedAccountAction(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(
                    errorObject instanceof Error
                      ? errorObject.message
                      : "Failed to update the linked account.",
                  )
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting
                ? "Working..."
                : linkedAccountAction === "remove"
                  ? "Delete access"
                  : "Unlink account"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRecord(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{isContactsSection ? "Remove contact" : "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isContactsSection
                ? "The contact row will remain for audit history, but its email and phone values will be cleared. For an exited employee, matching login contact values will also be released for reuse."
                : `Are you sure you want to delete this ${title.toLowerCase()} record? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={!supportsDelete || submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
              onClick={async () => {
                if (!deletingRecord || !employeeId || !token) {
                  return
                }
                const itemId = readNumber(deletingRecord.item.id)
                if (itemId === null) {
                  setMutationError("Missing record id; cannot delete this item.")
                  return
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (isDocumentsSection) {
                    await deleteEmployeeDocument(token, employeeId, itemId)
                  } else if (apiSection) {
                    await deleteEmployeeSectionItem(token, employeeId, apiSection, itemId)
                  } else {
                    setMutationError("Delete is not supported for this section.")
                    return
                  }
                  setDeletingRecord(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to delete record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? (isContactsSection ? "Removing..." : "Deleting...") : isContactsSection ? "Remove contact" : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open) {
            setAddingRecord(false)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Add {title} Record</AlertDialogTitle>
            <AlertDialogDescription>
              Fill in the details to create a new {title.toLowerCase()} record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {templateEntries.length === 0 ? (
              <p className="text-sm text-slate-500 md:col-span-2">
                Add form is not yet configured for this section.
              </p>
            ) : (
              templateEntries.map((entry) => (
                <label key={`add-${title}-${entry.key}`} className="grid min-w-0 gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</span>
                  {renderEntryInput({
                    entry,
                    value: addForm[entry.key] ?? entry.value,
                    onChange: (nextValue) => setAddForm((prev) => ({ ...prev, [entry.key]: nextValue })),
                  })}
                </label>
              ))
            )}
            {isDocumentsSection ? (
              <label className="grid min-w-0 gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Attachment
                </span>
                <input
                  type="file"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setDocumentUploadFile(file)
                  }}
                />
                <p className="text-xs text-slate-500">
                  {documentUploadFile
                    ? `${documentUploadFile.name} · ${formatFileSize(documentUploadFile.size)}`
                    : "Choose the document file to upload."}
                </p>
              </label>
            ) : null}
          </div>
          {isDocumentsSection && !documentUploadFile ? (
            <p className="text-sm text-amber-700">Choose a file before adding this document.</p>
          ) : null}
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !supportsAdd || templateEntries.length === 0}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                if (!employeeId || !token || templateEntries.length === 0) {
                  return
                }
                const payload: AdminRecord = {}
                for (const entry of templateEntries) {
                  const raw = addForm[entry.key] ?? entry.value
                  if (!raw.trim() && entry.kind !== "boolean") {
                    continue
                  }
                  payload[entry.key] = entry.kind === "boolean" ? raw === "true" : raw
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (isDocumentsSection) {
                    if (!documentUploadFile) {
                      setMutationError("Choose a file before adding this document.")
                      return
                    }
                    payload.file = await fileToBase64UploadDto(documentUploadFile)
                    await createEmployeeDocument(token, employeeId, payload)
                  } else if (apiSection) {
                    await createEmployeeSectionItem(token, employeeId, apiSection, payload)
                  } else {
                    setMutationError("Add is not supported for this section.")
                    return
                  }
                  setAddingRecord(false)
                  setDocumentUploadFile(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to add record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
