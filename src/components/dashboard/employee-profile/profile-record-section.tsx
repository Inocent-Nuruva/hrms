"use client"

import * as React from "react"
import {
  TriangleAlertIcon,
  DownloadIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
  UnlinkIcon,
  UserRoundXIcon,
} from "lucide-react"
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
import { ProfileSidePanel } from "@/components/dashboard/employee-profile/profile-side-panel"
import { FormField } from "@/components/ui/form-field"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import {
  ProfileAddButton,
  ProfileRecordCollection,
  ProfileRecordEmpty,
  ProfileSectionHeader,
  RECORD_ACTION_CLASS,
  ExpiryTag,
  RecordBadges,
  RecordFieldGrid,
  SectionGlyph,
  splitRecordFields,
  useProfileRecordView,
} from "@/components/dashboard/employee-profile/profile-record-views"
import { cn } from "@/lib/utils"
import {
  readStoredToken,
  readString,
  recordPreview,
  renderRecordFields,
  readNumber,
  sectionTitleToApiSection,
  sectionTitleToRouteKey,
  renderEntryInput,
  sectionSchema,
  editableEntries,
  isRequiredRecordField,
  validateRecordForm,
} from "@/components/dashboard/employee-profile/profile-shared"

export function Section({
  title,
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
  expected = false,
}: {
  title: string
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
  /** The HR file should have at least one record here; empty shows "Needs attention". */
  expected?: boolean
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
  // Inline Add/Edit validation messages, keyed by field.
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const clearFormError = (key: string) =>
    setFormErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      if (!Object.keys(next).length) setMutationError(null)
      return next
    })
  const [submitting, setSubmitting] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState("")
  const [viewingRecord, setViewingRecord] = React.useState<AdminRecord | null>(null)
  const [recordView, setRecordView] = useProfileRecordView()
  const token = readStoredToken()
  const apiSection = sectionTitleToApiSection(title)
  const isDocumentsSection = title.toLowerCase() === "documents"
  const isContactsSection = title.toLowerCase() === "contacts"
  const routeKey = sectionTitleToRouteKey(title)
  const isHighlighted = requestedRouteKey === routeKey
  // The server needs employees:update for every profile record change, so
  // the buttons only show for people who have it.
  const actor = useDashboardActor()
  const canManageRecords = actor.ready && canPerformPermission(actor.permissionLabels, "employees:update")
  const supportsMutations = Boolean((apiSection || isDocumentsSection) && employeeId && canManageRecords)
  const supportsAdd = supportsMutations
  const supportsDelete = supportsMutations
  const supportsEdit = Boolean(apiSection && !isDocumentsSection)

  React.useEffect(() => {
    setFormErrors({})
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
    setFormErrors({})
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

  const submitAddRecord = async () => {
    if (!employeeId || !token || templateEntries.length === 0) {
      return
    }
    const addValues = Object.fromEntries(templateEntries.map((entry) => [entry.key, addForm[entry.key] ?? entry.value]))
    const addErrors = validateRecordForm(title, templateEntries, addValues)
    if (Object.keys(addErrors).length) {
      setFormErrors(addErrors)
      setMutationError("Please fix the highlighted fields.")
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
  }

  const downloadDocument = (item: AdminRecord) => {
    const itemId = readNumber(item.id)
    if (!employeeId || !token) return
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
        setMutationError(errorObject instanceof Error ? errorObject.message : "Could not download this file.")
      })
      .finally(() => setDownloadingId(""))
  }

  const renderDocumentLink = (item: AdminRecord) => {
    if (!isDocumentsSection) return null
    const documentUrl = readString(item, ["file_url"])
    if (documentUrl === "-") return null
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
  }

  // View / Edit / Delete (plus Download and linked-account actions) for one
  // record; the same buttons appear in card and list view.
  const renderRecordActions = (item: AdminRecord, index: number) => {
    const hasId = readNumber(item.id) !== null
    const label = `${title} record ${index + 1}`
    return (
      <div className="flex flex-wrap items-center justify-end gap-0.5">
        <button
          type="button"
          aria-label={`View ${label}`}
          title="View"
          className={RECORD_ACTION_CLASS}
          onClick={() => setViewingRecord(item)}
        >
          <EyeIcon className="size-4" />
          <span className="hidden sm:inline">View</span>
        </button>
        {item.__linked_account === true && item.__can_manage_linked_account === true && canManageRecords && employeeId && token ? (
          <>
            <button
              type="button"
              aria-label="Unlink user account from employee"
              title="Unlink"
              className={RECORD_ACTION_CLASS}
              onClick={() => setLinkedAccountAction("unlink")}
            >
              <UnlinkIcon className="size-4" />
              <span className="hidden sm:inline">Unlink</span>
            </button>
            <button
              type="button"
              aria-label="Delete linked account access"
              title="Delete access"
              className={cn(RECORD_ACTION_CLASS, "text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30")}
              onClick={() => setLinkedAccountAction("remove")}
            >
              <UserRoundXIcon className="size-4" />
              <span className="hidden sm:inline">Delete access</span>
            </button>
          </>
        ) : null}
        {isDocumentsSection && employeeId && token ? (
          <button
            type="button"
            aria-label={`Download ${label}`}
            title="Download"
            className={RECORD_ACTION_CLASS}
            disabled={downloadingId === String(readNumber(item.id) ?? index)}
            onClick={() => downloadDocument(item)}
          >
            <DownloadIcon className="size-4" />
          </button>
        ) : null}
        {supportsEdit && hasId ? (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            title="Edit"
            className={RECORD_ACTION_CLASS}
            onClick={() => setEditingRecord({ item, index })}
          >
            <PencilIcon className="size-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        ) : null}
        {supportsDelete && hasId ? (
          <button
            type="button"
            aria-label={`${isContactsSection ? "Remove" : "Delete"} ${label}`}
            title={isContactsSection ? "Remove" : "Delete"}
            className={cn(RECORD_ACTION_CLASS, "hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30")}
            onClick={() => setDeletingRecord({ item, index })}
          >
            <Trash2Icon className="size-4" />
          </button>
        ) : null}
      </div>
    )
  }

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
        <ProfileSectionHeader
          title={title}
          count={items.length}
          view={recordView}
          onViewChange={setRecordView}
          highlighted={isHighlighted || (expected && items.length === 0)}
          actions={supportsAdd ? <ProfileAddButton onClick={() => setAddingRecord(true)} /> : null}
        />
        {mutationError && !addingRecord && !deletingRecord && !editingRecord ? (
          <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {mutationError}
          </p>
        ) : null}
        {items.length === 0 ? (
          <ProfileRecordEmpty
            title={title}
            message={supportsAdd ? `Add the first ${title.toLowerCase()} record for this employee.` : undefined}
            actionLabel={supportsAdd ? `Add ${title.toLowerCase()}` : undefined}
            onAction={supportsAdd ? () => setAddingRecord(true) : undefined}
          />
        ) : (
          <ProfileRecordCollection
            title={title}
            view={recordView}
            records={items.map((item, index) => {
              const fields = splitRecordFields(renderRecordFields(item, title))
              return {
                key: `${title}-${index}`,
                heading: recordPreview(item),
                badges: (
                  <RecordBadges isPrimary={fields.isPrimary} verified={fields.verified} inline>
                    {recordExpiryDate(item) ? <ExpiryTag date={recordExpiryDate(item)} /> : null}
                  </RecordBadges>
                ),
                fields: fields.details,
                meta: fields.updatedAt ? `Updated ${fields.updatedAt}` : null,
                actions: renderRecordActions(item, index),
                extra: renderDocumentLink(item),
              }
            })}
          />
        )}
      </div>

      <ProfileSidePanel
        open={viewingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setViewingRecord(null)
        }}
        title={viewingRecord ? recordPreview(viewingRecord) : title}
        description={`${title} record details`}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              onClick={() => setViewingRecord(null)}
            >
              Close
            </button>
            {viewingRecord && supportsEdit && readNumber(viewingRecord.id) !== null ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white"
                onClick={() => {
                  const record = viewingRecord
                  const index = items.indexOf(record)
                  setViewingRecord(null)
                  setEditingRecord({ item: record, index: index < 0 ? 0 : index })
                }}
              >
                <PencilIcon className="size-4" /> Edit
              </button>
            ) : null}
          </>
        }
      >
        {viewingRecord ? (
          (() => {
            const fields = splitRecordFields(renderRecordFields(viewingRecord, title))
            return (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SectionGlyph title={title} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-foreground">{recordPreview(viewingRecord)}</p>
                    <RecordBadges isPrimary={fields.isPrimary} verified={fields.verified}>
                      {recordExpiryDate(viewingRecord) ? <ExpiryTag date={recordExpiryDate(viewingRecord)} /> : null}
                    </RecordBadges>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  {fields.all.length ? (
                    <RecordFieldGrid fields={fields.all} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No details recorded.</p>
                  )}
                </div>
                {renderDocumentLink(viewingRecord)}
              </div>
            )
          })()
        ) : null}
      </ProfileSidePanel>

      <ProfileSidePanel
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setEditingRecord(null)
            setMutationError(null)
          }
        }}
        title={`Edit ${title} record`}
        description={`Update the selected ${title.toLowerCase()} information for this employee.`}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => {
                setEditingRecord(null)
                setMutationError(null)
              }}
            >
              Cancel
            </button>
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
                const editEntries = editableEntries(editingRecord.item, title)
                const editValues = Object.fromEntries(editEntries.map((entry) => [entry.key, editForm[entry.key] ?? entry.value]))
                const editErrors = validateRecordForm(title, editEntries, editValues)
                if (Object.keys(editErrors).length) {
                  setFormErrors(editErrors)
                  setMutationError("Please fix the highlighted fields.")
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
              {submitting ? "Saving..." : "Save changes"}
            </button>
          </>
        }
      >
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {editingRecord
            ? editableEntries(editingRecord.item, title).map((entry) => (
                <RecordFormField
                  key={entry.key}
                  label={entry.label}
                  required={isRequiredRecordField(title, entry.key)}
                  error={formErrors[entry.key]}
                  wide={entry.key === "responsibilities_description" || entry.key === "notes"}
                >
                  {renderEntryInput({
                    entry,
                    value: editForm[entry.key] ?? entry.value,
                    onChange: (value) => {
                      setEditForm((current) => ({ ...current, [entry.key]: value }))
                      clearFormError(entry.key)
                    },
                  })}
                </RecordFormField>
              ))
            : null}
        </div>
        {mutationError ? (
          <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {mutationError}
          </p>
        ) : null}
      </ProfileSidePanel>

      <AlertDialog
        open={linkedAccountAction !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setLinkedAccountAction(null)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="!w-[min(30rem,calc(100vw-2rem))]">
          <AlertDialogHeader className="flex-row items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              <TriangleAlertIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
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
            </div>
          </AlertDialogHeader>
          {mutationError ? (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{mutationError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="!h-9 !min-w-0 !rounded-md !px-3 !text-sm !font-medium">Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !employeeId || !token}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium !text-white disabled:opacity-50",
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
        <AlertDialogContent className="!w-[min(30rem,calc(100vw-2rem))]">
          <AlertDialogHeader className="flex-row items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              <TriangleAlertIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
            <AlertDialogTitle>{isContactsSection ? "Remove contact" : "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isContactsSection
                ? "The contact row will remain for audit history, but its email and phone values will be cleared. For an exited employee, matching login contact values will also be released for reuse."
                : `Are you sure you want to delete this ${title.toLowerCase()} record? This action cannot be undone.`}
            </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="!h-9 !min-w-0 !rounded-md !px-3 !text-sm !font-medium">Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={!supportsDelete || submitting}
              className="inline-flex h-9 items-center rounded-md bg-rose-600 px-3 text-sm font-medium !text-white hover:bg-rose-700 disabled:opacity-50"
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

      <ProfileSidePanel
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setAddingRecord(false)
            setMutationError(null)
          }
        }}
        title={`Add ${title} record`}
        description={`Fill in the details to create a new ${title.toLowerCase()} record.`}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={() => {
                setAddingRecord(false)
                setMutationError(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !supportsAdd || templateEntries.length === 0}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitAddRecord()}
            >
              {submitting ? "Adding..." : "Add record"}
            </button>
          </>
        }
      >
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            {templateEntries.length === 0 ? (
              <p className="text-sm text-slate-500 md:col-span-2">
                Add form is not yet configured for this section.
              </p>
            ) : (
              templateEntries.map((entry) => (
                <RecordFormField
                  key={`add-${title}-${entry.key}`}
                  label={entry.label}
                  required={isRequiredRecordField(title, entry.key)}
                  error={formErrors[entry.key]}
                  wide={entry.key === "responsibilities_description" || entry.key === "notes"}
                >
                  {renderEntryInput({
                    entry,
                    value: addForm[entry.key] ?? entry.value,
                    onChange: (nextValue) => {
                      setAddForm((prev) => ({ ...prev, [entry.key]: nextValue }))
                      clearFormError(entry.key)
                    },
                  })}
                </RecordFormField>
              ))
            )}
            {isDocumentsSection ? (
              <FormField label="Attachment" htmlFor="profile-document-file" required className="sm:col-span-2">
                <FileDropzone
                  id="profile-document-file"
                  file={documentUploadFile}
                  onFileChange={setDocumentUploadFile}
                  hint="PDF, image or office document"
                />
              </FormField>
            ) : null}
          </div>
          {isDocumentsSection && !documentUploadFile ? (
            <p className="mt-4 text-sm text-amber-700">Choose a file before adding this document.</p>
          ) : null}
          {mutationError ? (
            <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {mutationError}
            </p>
          ) : null}
      </ProfileSidePanel>
    </>
  )
}


/** Shared FormField, spanning both columns for long text fields. */
function RecordFormField({
  label,
  required,
  error,
  wide,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <FormField label={label} required={required} error={error} className={wide ? "sm:col-span-2" : undefined}>
      {children}
    </FormField>
  )
}

/** Expiry date of an ID, permit, certificate or document, if it has one. */
function recordExpiryDate(item: AdminRecord): string | null {
  const direct = item.expiry_date ?? item.expiryDate ?? item.expires_at
  if (typeof direct === "string" && direct) return direct
  const metadata = item.metadata as { expiry_date?: unknown } | null | undefined
  return typeof metadata?.expiry_date === "string" && metadata.expiry_date ? metadata.expiry_date : null
}
