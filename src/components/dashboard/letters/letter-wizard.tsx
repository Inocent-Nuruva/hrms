"use client"

import * as React from "react"
import { ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon } from "lucide-react"

import { ProfileSidePanel } from "@/components/dashboard/employee-profile/profile-side-panel"
import { RecordTag } from "@/components/dashboard/employee-profile/profile-record-views"
import { RecipientPicker } from "@/components/dashboard/letters/recipient-picker"
import { PlaceholderRichText } from "@/components/dashboard/letters/placeholder-picker"
import {
  MissingPlaceholders,
  PdfFrame,
  errorText,
  missingFromError,
  useBlobUrl,
  useLetterCatalogue,
  useLetterPermissions,
} from "@/components/dashboard/letters/letter-shared"
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  createLetter,
  getRecipientValues,
  issueLetter,
  listLetterTemplates,
  placeholdersIn,
  previewLetterPdf,
  previewLetterTemplatePdf,
  submitLetter,
  updateLetter,
  type Letter,
  type LetterExtraField,
  type LetterInput,
  type LetterRecipient,
  type LetterTemplate,
  type LetterType,
  type LetterTypeInfo,
} from "@/lib/letters-api"
import { cn } from "@/lib/utils"

export const WIZARD_STEPS = ["recipient", "letter", "details", "preview"] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]
const STEP_LABELS: Record<WizardStep, string> = {
  recipient: "Recipient",
  letter: "Letter",
  details: "Details",
  preview: "Preview & edit",
}

export type WizardState = {
  recipient: LetterRecipient | null
  letterType: LetterType | ""
  templateId: number | null
  extraValues: Record<string, string>
  recipientAddress: string
  subject: string
  salutation: string
  body: string
  closing: string
}

export const EMPTY_WIZARD_STATE: WizardState = {
  recipient: null,
  letterType: "",
  templateId: null,
  extraValues: {},
  recipientAddress: "",
  subject: "",
  salutation: "",
  body: "",
  closing: "",
}

/** Errors that stop the user leaving a step (keyed by field). Empty = valid. */
export function validateWizardStep(
  step: WizardStep,
  state: WizardState,
  typeInfo: LetterTypeInfo | null | undefined,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (step === "recipient") {
    if (!state.recipient) errors.recipient = "Choose who the letter is for."
  } else if (step === "letter") {
    if (!state.letterType) errors.letterType = "Choose a letter type."
    if (!state.templateId) errors.templateId = "Choose a template."
    if (state.recipient?.kind === "candidate" && typeInfo && typeInfo.recipient !== "candidate_or_employee") {
      errors.letterType = "Only offer letters can be sent to a candidate."
    }
  } else if (step === "details") {
    for (const field of typeInfo?.extra_fields ?? []) {
      if (field.required && !(state.extraValues[field.key] ?? "").trim()) errors[`extra.${field.key}`] = `${field.label} is required.`
    }
  } else if (step === "preview") {
    if (!state.subject.trim()) errors.subject = "Enter a subject."
    if (!state.body.trim()) errors.body = "The letter body cannot be empty."
  }
  return errors
}

/** First step with errors, or null when every step up to `upTo` is valid. */
export function firstInvalidStep(state: WizardState, typeInfo: LetterTypeInfo | null | undefined, upTo: WizardStep = "preview") {
  for (const step of WIZARD_STEPS) {
    if (Object.keys(validateWizardStep(step, state, typeInfo)).length) return step
    if (step === upTo) break
  }
  return null
}

function stateFromLetter(letter: Letter): WizardState {
  return {
    recipient: {
      kind: letter.recipient_kind,
      id: Number(letter.recipient_kind === "candidate" ? letter.candidate_id : letter.employee_id),
      name: letter.recipient_name,
      employee_no: letter.employee_no,
      department: null,
      position: null,
      email: null,
      status: null,
    },
    letterType: letter.letter_type,
    templateId: letter.template_id,
    extraValues: { ...(letter.extra_values ?? {}) },
    recipientAddress: letter.recipient_address ?? "",
    subject: letter.subject ?? "",
    salutation: letter.salutation ?? "",
    body: letter.body ?? "",
    closing: letter.closing ?? "",
  }
}

function optionList(field: LetterExtraField) {
  return (field.options ?? []).map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  )
}

export function ExtraFieldInput({
  field,
  value,
  onChange,
  id,
}: {
  field: LetterExtraField
  value: string
  onChange: (value: string) => void
  id: string
}) {
  if (field.kind === "date") return <DatePickerPresets id={id} value={value} onChange={onChange} placeholder={field.label} />
  if (field.kind === "textarea")
    return <Textarea id={id} formatting={false} rows={3} value={value} onChange={(_event, data) => onChange(data.value)} />
  if (field.kind === "select")
    return <FluentSelect id={id} ariaLabel={field.label} value={value} onChange={onChange} options={optionList(field)} />
  return (
    <Input
      id={id}
      inputMode={field.kind === "money" || field.kind === "number" ? "decimal" : undefined}
      value={value}
      onChange={(_event, data) => onChange(data.value)}
    />
  )
}

/** The registration-style step bar (numbered underline tabs). */
function WizardStepBar({
  current,
  reached,
  onSelect,
}: {
  current: WizardStep
  reached: number
  onSelect: (step: WizardStep) => void
}) {
  const currentIndex = WIZARD_STEPS.indexOf(current)
  return (
    <ol aria-label="Letter steps" className="-mx-4 mb-5 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
      {WIZARD_STEPS.map((step, index) => {
        const active = step === current
        const done = index < currentIndex
        return (
          <li key={step} className="shrink-0">
            <button
              type="button"
              aria-current={active ? "step" : undefined}
              disabled={index > reached}
              onClick={() => onSelect(step)}
              className={cn(
                "-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
                active
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : done
                    ? "border-transparent text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                    : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "mr-2 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold leading-none",
                  active
                    ? "bg-[var(--primary)] !text-white"
                    : done
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              {STEP_LABELS[step]}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * New / edit letter wizard: Recipient → Letter → Details → Preview & edit.
 * Pass `letter` to edit an existing draft, `presetRecipient` to lock the recipient
 * (employee profile).
 */
export function LetterWizard({
  open,
  onOpenChange,
  token,
  letter,
  presetRecipient,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  letter?: Letter | null
  presetRecipient?: LetterRecipient | null
  onSaved?: (letter: Letter) => void
}) {
  const catalogue = useLetterCatalogue(open ? token : "")
  const permissions = useLetterPermissions()
  const [step, setStep] = React.useState<WizardStep>("recipient")
  const [reached, setReached] = React.useState(0)
  const [state, setState] = React.useState<WizardState>(EMPTY_WIZARD_STATE)
  const [draftId, setDraftId] = React.useState<number | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [templates, setTemplates] = React.useState<LetterTemplate[]>([])
  const [values, setValues] = React.useState<{ values: Record<string, string>; missing: string[] } | null>(null)
  const [serverMissing, setServerMissing] = React.useState<string[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [previewUrl, setPreviewBlob] = useBlobUrl()
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)
  const loadedTemplateRef = React.useRef<number | null>(null)

  // Reset whenever the panel opens.
  React.useEffect(() => {
    if (!open) return
    const initial = letter ? stateFromLetter(letter) : { ...EMPTY_WIZARD_STATE, recipient: presetRecipient ?? null }
    setState(initial)
    setDraftId(letter?.id ?? null)
    loadedTemplateRef.current = letter?.template_id ?? null
    const startIndex = letter ? 3 : presetRecipient ? 1 : 0
    setStep(WIZARD_STEPS[startIndex])
    setReached(startIndex)
    setErrors({})
    setServerMissing(letter ? letter.missing_placeholders ?? [] : null)
    setPreviewBlob(null)
    setPreviewError(null)
  }, [open, letter, presetRecipient, setPreviewBlob])

  const typeInfo = catalogue?.letter_types.find((row) => row.type === state.letterType) ?? null
  const placeholderLabels = React.useMemo(
    () => Object.fromEntries((catalogue?.placeholders ?? []).map((row) => [row.key, row.label])),
    [catalogue],
  )

  // Templates for the chosen type; default preselected.
  React.useEffect(() => {
    if (!open || !token || !state.letterType) {
      setTemplates([])
      return
    }
    let active = true
    listLetterTemplates(token, { letter_type: state.letterType })
      .then((rows) => {
        if (!active) return
        const usable = rows.filter((row) => row.is_active)
        setTemplates(usable)
        setState((current) => {
          if (current.templateId) return current
          const preferred = usable.find((row) => row.is_default) ?? usable[0]
          return { ...current, templateId: preferred?.id ?? null }
        })
      })
      .catch(() => active && setTemplates([]))
    return () => {
      active = false
    }
  }, [open, token, state.letterType])

  // Auto-filled values for the recipient.
  const recipientKey = state.recipient ? `${state.recipient.kind}:${state.recipient.id}` : ""
  React.useEffect(() => {
    if (!open || !token || !state.recipient) {
      setValues(null)
      return
    }
    let active = true
    getRecipientValues(token, state.recipient.kind, state.recipient.id)
      .then((result) => active && setValues(result))
      .catch(() => active && setValues({ values: {}, missing: [] }))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by recipientKey
  }, [open, token, recipientKey])

  const template = templates.find((row) => row.id === state.templateId) ?? null

  // Copy the template wording when a (different) template is chosen.
  React.useEffect(() => {
    if (!template || loadedTemplateRef.current === template.id) return
    loadedTemplateRef.current = template.id
    setState((current) => ({
      ...current,
      subject: template.subject,
      salutation: template.salutation,
      body: template.body,
      closing: template.closing,
    }))
  }, [template])

  const patchState = (patch: Partial<WizardState>) => {
    setState((current) => ({ ...current, ...patch }))
    setServerMissing(null)
  }

  const clientMissing = React.useMemo(() => {
    const known = { ...(values?.values ?? {}), ...state.extraValues }
    return placeholdersIn(state.subject, state.salutation, state.body, state.closing).filter((key) => !(known[key] ?? "").trim())
  }, [values, state.extraValues, state.subject, state.salutation, state.body, state.closing])
  const missing = serverMissing ?? clientMissing

  const goTo = (target: WizardStep) => {
    const targetIndex = WIZARD_STEPS.indexOf(target)
    const currentIndex = WIZARD_STEPS.indexOf(step)
    if (targetIndex > currentIndex) {
      for (const check of WIZARD_STEPS.slice(currentIndex, targetIndex)) {
        const stepErrors = validateWizardStep(check, state, typeInfo)
        if (Object.keys(stepErrors).length) {
          setErrors(stepErrors)
          setStep(check)
          return
        }
      }
    }
    setErrors({})
    setStep(target)
    setReached((value) => Math.max(value, targetIndex))
  }

  const payload = (): LetterInput => ({
    letter_type: state.letterType || undefined,
    template_id: state.templateId ?? undefined,
    ...(state.recipient?.kind === "candidate" ? { candidate_id: state.recipient.id } : { employee_id: state.recipient?.id }),
    extra_values: state.extraValues,
    subject: state.subject,
    salutation: state.salutation,
    body: state.body,
    closing: state.closing,
    recipient_address: state.recipientAddress || undefined,
  })

  const saveDraft = async (): Promise<Letter | null> => {
    const invalid = firstInvalidStep(state, typeInfo)
    if (invalid) {
      setErrors(validateWizardStep(invalid, state, typeInfo))
      setStep(invalid)
      return null
    }
    const body = payload()
    const saved = draftId ? await updateLetter(token, draftId, body) : await createLetter(token, body)
    setDraftId(saved.id)
    setServerMissing(saved.missing_placeholders ?? [])
    return saved
  }

  const refreshPreview = async (saveFirst: boolean) => {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      if (saveFirst || draftId) {
        const saved = saveFirst ? await saveDraft() : null
        const id = saved?.id ?? draftId
        if (!id) return
        const { blob } = await previewLetterPdf(token, id)
        setPreviewBlob(blob)
      } else if (state.templateId) {
        const { blob } = await previewLetterTemplatePdf(token, state.templateId, {
          ...(state.recipient?.kind === "candidate" ? { candidate_id: state.recipient.id } : { employee_id: state.recipient?.id }),
          extra_values: state.extraValues,
        })
        setPreviewBlob(blob)
      }
    } catch (cause) {
      setPreviewError(errorText(cause, "Preview failed"))
    } finally {
      setPreviewLoading(false)
    }
  }

  // First preview on entering the last step.
  const previewStarted = React.useRef(false)
  React.useEffect(() => {
    if (!open) {
      previewStarted.current = false
      return
    }
    if (step === "preview" && !previewStarted.current && state.templateId) {
      previewStarted.current = true
      void refreshPreview(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per entry
  }, [open, step, state.templateId])

  const requiresApproval = template?.requires_approval ?? letter?.requires_approval ?? typeInfo?.default_requires_approval ?? true
  const directIssue = !requiresApproval && permissions.issue

  const finish = async (mode: "draft" | "submit") => {
    setBusy(true)
    try {
      const saved = await saveDraft()
      if (!saved) return
      if (mode === "draft") {
        toast.success(`Draft ${saved.reference_no} saved`)
        onSaved?.(saved)
        onOpenChange(false)
        return
      }
      let result = await submitLetter(token, saved.id)
      if (directIssue && result.status === "APPROVED") {
        result = await issueLetter(token, saved.id, true)
        toast.success(`Letter ${result.reference_no} issued`)
      } else {
        toast.success(result.status === "PENDING_APPROVAL" ? `Letter ${result.reference_no} sent for approval` : `Letter ${result.reference_no} approved`)
      }
      onSaved?.(result)
      onOpenChange(false)
    } catch (cause) {
      const keys = missingFromError(cause)
      if (keys.length) setServerMissing(keys)
      toast.error(errorText(cause, "Could not save the letter"))
    } finally {
      setBusy(false)
    }
  }

  const stepIndex = WIZARD_STEPS.indexOf(step)
  const letterTypeOptions = (catalogue?.letter_types ?? [])
    .filter((row) => state.recipient?.kind !== "candidate" || row.recipient === "candidate_or_employee")
    .map((row) => ({ value: row.type, label: row.label }))
  const usedKeys = placeholdersIn(template?.subject ?? state.subject, template?.body ?? state.body)
  const autoFields = usedKeys.filter((key) => !(typeInfo?.extra_fields ?? []).some((field) => field.key === key))

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <Button
        variant="outline"
        disabled={busy || stepIndex === 0 || (Boolean(presetRecipient) && stepIndex === 1)}
        onClick={() => goTo(WIZARD_STEPS[stepIndex - 1])}
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" /> Back
      </Button>
      <div className="flex flex-wrap gap-2">
        {stepIndex >= 1 ? (
          <Button variant="outline" disabled={busy} onClick={() => void finish("draft")}>
            Save draft
          </Button>
        ) : null}
        {step === "preview" ? (
          <Button disabled={busy} onClick={() => void finish("submit")}>
            {busy ? "Working…" : directIssue ? "Approve & issue" : requiresApproval ? "Submit for approval" : "Submit"}
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => goTo(WIZARD_STEPS[stepIndex + 1])}>
            Continue <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <ProfileSidePanel
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={letter ? `Edit letter ${letter.reference_no}` : "New letter"}
      description={STEP_LABELS[step]}
      footer={footer}
    >
      <WizardStepBar current={step} reached={reached} onSelect={goTo} />

      {step === "recipient" ? (
        <FormField label="Recipient" required error={errors.recipient} hint="Type at least 2 characters.">
          <RecipientPicker
            token={token}
            kind="any"
            value={state.recipient}
            onChange={(recipient) => patchState({ recipient })}
          />
        </FormField>
      ) : null}

      {step === "letter" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Letter type" required error={errors.letterType}>
            <FluentSelect
              ariaLabel="Letter type"
              value={state.letterType}
              placeholder={catalogue ? "Choose a letter type" : "Loading…"}
              options={letterTypeOptions}
              onChange={(value) => {
                loadedTemplateRef.current = null
                patchState({ letterType: value as LetterType, templateId: null })
              }}
            />
          </FormField>
          <FormField
            label="Template"
            required
            error={errors.templateId}
            hint={state.letterType && !templates.length ? "No active template for this type. Add one on the Templates tab." : undefined}
          >
            <FluentSelect
              ariaLabel="Template"
              value={state.templateId ? String(state.templateId) : ""}
              disabled={!state.letterType}
              placeholder="Choose a template"
              options={templates.map((row) => ({
                value: String(row.id),
                label: `${row.name}${row.is_default ? " (default)" : ""}`,
              }))}
              onChange={(value) => patchState({ templateId: Number(value) || null })}
            />
          </FormField>
          {template ? (
            <div className="flex flex-wrap gap-1.5 sm:col-span-2">
              {template.requires_approval ? <RecordTag tone="warning">Requires approval</RecordTag> : <RecordTag tone="success">No approval needed</RecordTag>}
              {template.include_acknowledgement ? <RecordTag>Employee acknowledgement</RecordTag> : null}
              <RecordTag>Version {template.current_version}</RecordTag>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "details" ? (
        <div className="flex flex-col gap-6">
          {typeInfo?.extra_fields.length ? (
            <section aria-label="Letter details">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Letter details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {typeInfo.extra_fields.map((field) => (
                  <FormField
                    key={field.key}
                    label={field.label}
                    htmlFor={`letter-extra-${field.key}`}
                    required={field.required}
                    error={errors[`extra.${field.key}`]}
                    className={field.kind === "textarea" ? "sm:col-span-2" : undefined}
                  >
                    <ExtraFieldInput
                      id={`letter-extra-${field.key}`}
                      field={field}
                      value={state.extraValues[field.key] ?? ""}
                      onChange={(value) => patchState({ extraValues: { ...state.extraValues, [field.key]: value } })}
                    />
                  </FormField>
                ))}
              </div>
            </section>
          ) : null}
          <FormField label="Recipient address" htmlFor="letter-recipient-address" hint="Printed under the recipient's name. Optional.">
            <Textarea
              id="letter-recipient-address"
              formatting={false}
              rows={3}
              value={state.recipientAddress}
              onChange={(_event, data) => patchState({ recipientAddress: data.value })}
            />
          </FormField>
          <section aria-label="Filled in automatically">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Filled in automatically</h3>
            <p className="mb-3 text-xs text-muted-foreground">From the recipient&apos;s record. Update the record to change these.</p>
            {values === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : autoFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">This template uses no recipient fields.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {autoFields.map((key) => (
                  <FormField key={key} label={placeholderLabels[key] ?? key} htmlFor={`letter-auto-${key}`}>
                    <Input id={`letter-auto-${key}`} readOnly value={values.values[key] ?? ""} placeholder="Not on record" />
                  </FormField>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <MissingPlaceholders keys={missing} labels={placeholderLabels} />
            <FormField label="Subject" htmlFor="letter-subject" required error={errors.subject}>
              <Input id="letter-subject" value={state.subject} onChange={(_event, data) => patchState({ subject: data.value })} />
            </FormField>
            <FormField label="Salutation" htmlFor="letter-salutation">
              <Input id="letter-salutation" value={state.salutation} onChange={(_event, data) => patchState({ salutation: data.value })} />
            </FormField>
            <FormField label="Body" required error={errors.body}>
              <PlaceholderRichText
                ariaLabel="Letter body"
                value={state.body}
                placeholders={catalogue?.placeholders ?? []}
                onChange={(body) => patchState({ body })}
              />
            </FormField>
            <FormField label="Closing" htmlFor="letter-closing">
              <Input id="letter-closing" value={state.closing} onChange={(_event, data) => patchState({ closing: data.value })} />
            </FormField>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Preview</h3>
              <Button variant="outline" size="sm" disabled={previewLoading || busy} onClick={() => void refreshPreview(true)}>
                <RefreshCwIcon className="size-4" aria-hidden="true" /> Save &amp; refresh
              </Button>
            </div>
            {previewError ? <p role="alert" className="text-xs text-destructive">{previewError}</p> : null}
            <PdfFrame url={previewUrl} loading={previewLoading} title="Letter preview" empty="Save the draft to see your edits." />
            {!draftId ? <p className="text-xs text-muted-foreground">Until the draft is saved the preview shows the template wording.</p> : null}
          </div>
        </div>
      ) : null}
    </ProfileSidePanel>
  )
}
