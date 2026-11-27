"use client"

import * as React from "react"

import { ProfileSidePanel } from "@/components/dashboard/employee-profile/profile-side-panel"
import { RecordTag } from "@/components/dashboard/employee-profile/profile-record-views"
import { PlaceholderRichText } from "@/components/dashboard/letters/placeholder-picker"
import { RecipientPicker } from "@/components/dashboard/letters/recipient-picker"
import { PdfFrame, errorText, formatLetterDate, useBlobUrl } from "@/components/dashboard/letters/letter-shared"
import { Button } from "@/components/ui/button"
import { FluentSelect } from "@/components/ui/fluent-select"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/fluent-toast-store"
import { listSignatories, type Signatory } from "@/lib/contracts-api"
import {
  activateLetterTemplate,
  createLetterTemplate,
  deactivateLetterTemplate,
  duplicateLetterTemplate,
  getLetterTemplate,
  previewLetterTemplatePdf,
  setDefaultLetterTemplate,
  updateLetterTemplate,
  type LetterCatalogue,
  type LetterRecipient,
  type LetterTemplate,
  type LetterTemplateInput,
  type LetterTemplateVersion,
  type LetterType,
} from "@/lib/letters-api"

type Form = Required<Omit<LetterTemplateInput, "is_default" | "signatory_id">> & { signatory_id: number | null }

function formFrom(template: LetterTemplate | null, type: LetterType | "", catalogue: LetterCatalogue | null): Form {
  const info = catalogue?.letter_types.find((row) => row.type === (template?.letter_type ?? type))
  return {
    letter_type: (template?.letter_type ?? type ?? "CUSTOM") || "CUSTOM",
    name: template?.name ?? "",
    subject: template?.subject ?? "",
    salutation: template?.salutation ?? "Dear {{employee_first_name}},",
    body: template?.body ?? "",
    closing: template?.closing ?? "Yours sincerely,",
    signatory_id: template?.signatory_id ?? null,
    signatory_name: template?.signatory_name ?? "",
    signatory_title: template?.signatory_title ?? "",
    requires_approval: template?.requires_approval ?? info?.default_requires_approval ?? true,
    include_acknowledgement: template?.include_acknowledgement ?? false,
    is_active: template?.is_active ?? true,
  }
}

/** Create / edit a letter template, with preview, versions and lifecycle actions. */
export function LetterTemplateEditor({
  open,
  onOpenChange,
  token,
  catalogue,
  template,
  defaultType,
  canManage,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  catalogue: LetterCatalogue | null
  template: LetterTemplate | null
  defaultType: LetterType | ""
  canManage: boolean
  onSaved: (template: LetterTemplate) => void
}) {
  const [current, setCurrent] = React.useState<LetterTemplate | null>(template)
  const [form, setForm] = React.useState<Form>(() => formFrom(template, defaultType, catalogue))
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [signatories, setSignatories] = React.useState<Signatory[]>([])
  const [versions, setVersions] = React.useState<LetterTemplateVersion[]>([])
  const [previewRecipient, setPreviewRecipient] = React.useState<LetterRecipient | null>(null)
  const [previewUrl, setPreview] = useBlobUrl()
  const [previewLoading, setPreviewLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCurrent(template)
    setForm(formFrom(template, defaultType, catalogue))
    setErrors({})
    setVersions([])
    setPreview(null)
    setPreviewRecipient(null)
    if (template) {
      getLetterTemplate(token, template.id)
        .then((row) => setVersions(row.versions ?? []))
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per opening
  }, [open, template])

  React.useEffect(() => {
    if (!open || !token) return
    listSignatories(token)
      .then((rows) => setSignatories(rows.filter((row) => row.isActive)))
      .catch(() => setSignatories([]))
  }, [open, token])

  const set = (patch: Partial<Form>) => setForm((value) => ({ ...value, ...patch }))
  const readOnly = !canManage

  const save = async () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = "Enter a name."
    if (!form.subject.trim()) next.subject = "Enter a subject."
    if (!form.body.trim()) next.body = "The body cannot be empty."
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const saved = current ? await updateLetterTemplate(token, current.id, form) : await createLetterTemplate(token, form)
      setCurrent(saved)
      toast.success(current ? `Saved as version ${saved.current_version}` : "Template created")
      onSaved(saved)
      getLetterTemplate(token, saved.id).then((row) => setVersions(row.versions ?? [])).catch(() => undefined)
    } catch (cause) {
      toast.error(errorText(cause, "Could not save the template"))
    } finally {
      setBusy(false)
    }
  }

  const act = async (action: () => Promise<LetterTemplate>, message: string, reopen = false) => {
    setBusy(true)
    try {
      const result = await action()
      toast.success(message)
      onSaved(result)
      if (reopen) {
        setCurrent(result)
        setForm(formFrom(result, defaultType, catalogue))
      } else setCurrent(result)
    } catch (cause) {
      toast.error(errorText(cause, "The action failed"))
    } finally {
      setBusy(false)
    }
  }

  const preview = async () => {
    if (!current) return
    setPreviewLoading(true)
    try {
      const { blob } = await previewLetterTemplatePdf(
        token,
        current.id,
        previewRecipient
          ? previewRecipient.kind === "candidate"
            ? { candidate_id: previewRecipient.id }
            : { employee_id: previewRecipient.id }
          : {},
      )
      setPreview(blob)
    } catch (cause) {
      toast.error(errorText(cause, "Preview failed"))
    } finally {
      setPreviewLoading(false)
    }
  }

  const signatoryOptions = [
    { value: "", label: "Type the name below" },
    ...signatories.map((row) => ({ value: String(row.id), label: `${row.displayName} — ${row.jobTitle}` })),
  ]

  const footer = (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      {canManage ? <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : current ? "Save new version" : "Create template"}</Button> : null}
    </div>
  )

  return (
    <ProfileSidePanel
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={current ? current.name : "New letter template"}
      description={
        current ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <RecordTag>Version {current.current_version}</RecordTag>
            {current.is_default ? <RecordTag tone="primary">Default</RecordTag> : null}
            {current.is_active ? <RecordTag tone="success">Active</RecordTag> : <RecordTag>Inactive</RecordTag>}
          </span>
        ) : undefined
      }
      footer={footer}
    >
      <div className="flex flex-col gap-6">
        {current && canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => duplicateLetterTemplate(token, current.id), "Template duplicated", true)}>
              Duplicate
            </Button>
            {current.is_active ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => deactivateLetterTemplate(token, current.id), "Template deactivated")}>
                Deactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => activateLetterTemplate(token, current.id), "Template activated")}>
                Activate
              </Button>
            )}
            {!current.is_default && current.is_active ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => setDefaultLetterTemplate(token, current.id), "Set as default")}>
                Set default
              </Button>
            ) : null}
          </div>
        ) : null}

        <fieldset disabled={readOnly || busy} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor="tpl-name" required error={errors.name}>
            <Input id="tpl-name" value={form.name} onChange={(_event, data) => set({ name: data.value })} />
          </FormField>
          <FormField label="Letter type" required>
            <FluentSelect
              ariaLabel="Letter type"
              value={form.letter_type}
              disabled={Boolean(current) || readOnly}
              options={(catalogue?.letter_types ?? []).map((row) => ({ value: row.type, label: row.label }))}
              onChange={(value) => {
                const info = catalogue?.letter_types.find((row) => row.type === value)
                set({ letter_type: value as LetterType, requires_approval: info?.default_requires_approval ?? form.requires_approval })
              }}
            />
          </FormField>
          <FormField label="Subject" htmlFor="tpl-subject" required error={errors.subject} className="sm:col-span-2">
            <Input id="tpl-subject" value={form.subject} onChange={(_event, data) => set({ subject: data.value })} />
          </FormField>
          <FormField label="Salutation" htmlFor="tpl-salutation">
            <Input id="tpl-salutation" value={form.salutation} onChange={(_event, data) => set({ salutation: data.value })} />
          </FormField>
          <FormField label="Closing" htmlFor="tpl-closing">
            <Input id="tpl-closing" value={form.closing} onChange={(_event, data) => set({ closing: data.value })} />
          </FormField>
          <FormField label="Body" required error={errors.body} className="sm:col-span-2" hint="Use placeholders such as {{employee_name}}; they are filled in for each letter.">
            <PlaceholderRichText
              ariaLabel="Template body"
              value={form.body}
              disabled={readOnly || busy}
              placeholders={catalogue?.placeholders ?? []}
              onChange={(body) => set({ body })}
            />
          </FormField>
          <FormField label="Signatory" className="sm:col-span-2" hint="Pick a company signatory or type a name and title.">
            <FluentSelect
              ariaLabel="Signatory"
              value={form.signatory_id ? String(form.signatory_id) : ""}
              disabled={readOnly}
              options={signatoryOptions}
              onChange={(value) => {
                const row = signatories.find((item) => String(item.id) === value)
                set(row ? { signatory_id: row.id, signatory_name: row.displayName, signatory_title: row.jobTitle } : { signatory_id: null })
              }}
            />
          </FormField>
          <FormField label="Signatory name" htmlFor="tpl-signatory-name">
            <Input id="tpl-signatory-name" value={form.signatory_name ?? ""} onChange={(_event, data) => set({ signatory_name: data.value, signatory_id: null })} />
          </FormField>
          <FormField label="Signatory title" htmlFor="tpl-signatory-title">
            <Input id="tpl-signatory-title" value={form.signatory_title ?? ""} onChange={(_event, data) => set({ signatory_title: data.value, signatory_id: null })} />
          </FormField>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Switch label="Requires approval before issue" checked={form.requires_approval} onCheckedChange={(checked) => set({ requires_approval: checked })} />
            <Switch label="Add an employee acknowledgement section" checked={form.include_acknowledgement} onCheckedChange={(checked) => set({ include_acknowledgement: checked })} />
            {!current ? <Switch label="Active" checked={form.is_active} onCheckedChange={(checked) => set({ is_active: checked })} /> : null}
          </div>
        </fieldset>

        {current ? (
          <section aria-label="Preview" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Preview</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <FormField label="Preview for" className="min-w-0 flex-1" hint="Leave empty to use sample values.">
                <RecipientPicker token={token} kind="any" value={previewRecipient} onChange={setPreviewRecipient} />
              </FormField>
              <Button variant="outline" disabled={previewLoading} onClick={() => void preview()}>Preview saved version</Button>
            </div>
            {previewUrl || previewLoading ? <PdfFrame url={previewUrl} loading={previewLoading} title="Template preview" /> : null}
          </section>
        ) : null}

        {current ? (
          <section aria-label="Version history">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Version history</h3>
            {versions.length ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {[...versions].sort((a, b) => b.version - a.version).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">Version {row.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {[row.created_by_name, formatLetterDate(row.created_at, true)].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Updated {formatLetterDate(current.updated_at)}{current.updated_by_name ? ` by ${current.updated_by_name}` : ""}.</p>
            )}
          </section>
        ) : null}
      </div>
    </ProfileSidePanel>
  )
}
