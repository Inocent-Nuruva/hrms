"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FluentSelect } from "@/components/ui/fluent-select"
import { formatFileSize, renderEntryInput } from "@/components/dashboard/employee-profile/profile-shared"
import { cn } from "@/lib/utils"

// Employee-side add/edit form that matches the HR "Add record" dialog on the
// employee profile: same AlertDialog, two-column grid, uppercase labels and the
// same inputs (selects, date pickers, country/phone pickers) via renderEntryInput.

export type RecordFormField = {
  name: string
  label: string
  required?: boolean
  hint?: string
  defaultValue?: string
  /** Renders a select with these choices instead of the default input. */
  options?: Array<{ value: string; label: string }>
  /** Spans both columns (long text). */
  wide?: boolean
}

export type RecordFormOptions = {
  title: string
  description?: string
  confirmLabel?: string
  /** Adds a required file picker; the chosen file is returned with the values. */
  file?: { label?: string; accept?: string; hint?: string }
  /** Adds an optional "Reason for HR" box (sensitive records). */
  reasonLabel?: string
}

export type RecordFormResult = {
  values: Record<string, string>
  file: File | null
  reason: string
}

type OpenRequest = {
  fields: RecordFormField[]
  options: RecordFormOptions
  resolve: (result: RecordFormResult | null) => void
}

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wide text-slate-500"
const WIDE_KEYS = new Set(["notes", "responsibilities_description", "address"])

function RecordFormDialog({ request, onDone }: { request: OpenRequest; onDone: (result: RecordFormResult | null) => void }) {
  const { fields, options } = request
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""])),
  )
  const [file, setFile] = React.useState<File | null>(null)
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const submit = () => {
    const missing = fields.find((field) => field.required && !(values[field.name] ?? "").trim())
    if (missing) {
      setError(`${missing.label} is required.`)
      return
    }
    if (options.file && !file) {
      setError("Choose a file to upload.")
      return
    }
    onDone({ values, file, reason: reason.trim() })
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onDone(null)}>
      <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description ? <AlertDialogDescription>{options.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => {
            const value = values[field.name] ?? ""
            const onChange = (next: string) => {
              setValues((current) => ({ ...current, [field.name]: next }))
              setError(null)
            }
            return (
              <label
                key={field.name}
                className={cn("grid min-w-0 gap-1", (field.wide || WIDE_KEYS.has(field.name)) && "md:col-span-2")}
              >
                <span className={LABEL_CLASS}>
                  {field.label}
                  {field.required ? <span className="text-rose-600"> *</span> : <span className="normal-case font-normal"> (optional)</span>}
                </span>
                {field.options ? (
                  <FluentSelect
                    ariaLabel={field.label}
                    className="w-full"
                    value={value}
                    placeholder={`Select ${field.label.toLowerCase()}`}
                    onChange={onChange}
                    options={[{ value: "", label: `Select ${field.label.toLowerCase()}` }, ...field.options]}
                  />
                ) : (
                  renderEntryInput({
                    entry: { key: field.name, label: field.label, value: field.defaultValue ?? "", kind: "text" },
                    value,
                    onChange,
                  })
                )}
                {field.hint ? <span className="text-xs text-slate-500">{field.hint}</span> : null}
              </label>
            )
          })}
          {options.file ? (
            <label className="grid min-w-0 gap-1 md:col-span-2">
              <span className={LABEL_CLASS}>
                {options.file.label ?? "Attachment"}
                <span className="text-rose-600"> *</span>
              </span>
              <input
                type="file"
                accept={options.file.accept}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setError(null)
                }}
              />
              <p className="text-xs text-slate-500">
                {file ? `${file.name} · ${formatFileSize(file.size)}` : options.file.hint ?? "Choose the document file to upload."}
              </p>
            </label>
          ) : null}
          {options.reasonLabel ? (
            <label className="grid min-w-0 gap-1 md:col-span-2">
              <span className={LABEL_CLASS}>
                {options.reasonLabel}
                <span className="normal-case font-normal"> (optional)</span>
              </span>
              {renderEntryInput({
                entry: { key: "notes", label: options.reasonLabel, value: "", kind: "text" },
                value: reason,
                onChange: setReason,
              })}
            </label>
          ) : null}
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
            onClick={submit}
          >
            {options.confirmLabel ?? "Save"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Promise-based opener for the HR-style record form.
 * Render `dialog` somewhere in the component, then `await open(fields, options)`.
 */
export function useRecordForm() {
  const [request, setRequest] = React.useState<OpenRequest | null>(null)

  const open = React.useCallback(
    (fields: RecordFormField[], options: RecordFormOptions) =>
      new Promise<RecordFormResult | null>((resolve) => setRequest({ fields, options, resolve })),
    [],
  )

  const dialog = request ? (
    <RecordFormDialog
      request={request}
      onDone={(result) => {
        request.resolve(result)
        setRequest(null)
      }}
    />
  ) : null

  return { open, dialog }
}
