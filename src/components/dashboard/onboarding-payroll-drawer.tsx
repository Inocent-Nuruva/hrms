"use client"

import * as React from "react"
import { Button, Field, Input, MessageBar, MessageBarBody, OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, Spinner, Switch } from "@fluentui/react-components"
import { DateInput } from "@/components/ui/date-input"
import { listEmployeePayrollProfiles, upsertEmployeePayrollProfile, type AdminRecord } from "@/lib/admin-api"

const fields = [
  ["payroll_number", "payrollNumber", "Payroll number"],
  ["effective_from", "effectiveFrom", "Effective from"],
  ["taxpayer_identification_number", "taxpayerIdentificationNumber", "Tax identification number"],
  ["social_security_scheme_code", "socialSecuritySchemeCode", "Pension scheme code"],
  ["social_security_number", "socialSecurityNumber", "Pension membership number"],
  ["health_insurance_scheme_code", "healthInsuranceSchemeCode", "Health insurance scheme code"],
  ["health_insurance_number", "healthInsuranceNumber", "Health insurance number"],
] as const

function value(row: AdminRecord, snake: string, camel: string) { return String(row[snake] ?? row[camel] ?? "") }

export function OnboardingPayrollDrawer({ token, employeeId, employeeName, employeeNo, canEdit, onClose, onChanged }: { token: string; employeeId: number; employeeName: string; employeeNo: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [original, setOriginal] = React.useState<AdminRecord | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [enabled, setEnabled] = React.useState(false)
  const [hold, setHold] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const [error, setError] = React.useState("")
  const [revision, setRevision] = React.useState(0)
  const read = React.useCallback(async () => {
    const result = await listEmployeePayrollProfiles(token, { employee_id: employeeId, limit: 100 })
    return result.rows.find((row) => Number(row.employee_id ?? row.employeeId) === employeeId) ?? null
  }, [token, employeeId])
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    void read().then((row) => {
      if (cancelled) return
      setOriginal(row)
      setForm(Object.fromEntries(fields.map(([snake, camel]) => [snake, value(row ?? {}, snake, camel).includes("*") ? "" : value(row ?? {}, snake, camel).slice(0, snake === "effective_from" ? 10 : undefined)])))
      setEnabled(Boolean(row?.payroll_enabled ?? row?.payrollEnabled ?? false))
      setHold(Boolean(row?.payroll_hold ?? row?.payrollHold ?? false))
      setReason(value(row ?? {}, "payroll_hold_reason", "payrollHoldReason"))
      setDirty(false); setError("")
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load payroll profile") }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [read, revision])
  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const close = () => { if (!saving && (!dirty || window.confirm("Discard unsaved payroll profile changes?"))) onClose() }
  const save = async () => {
    setSaving(true); setError("")
    try {
      if (!form.payroll_number?.trim() || !form.effective_from) throw new Error("Payroll number and effective date are required.")
      if (hold && !reason.trim()) throw new Error("Explain why payroll is on hold.")
      const latest = await read()
      if (JSON.stringify(latest) !== JSON.stringify(original)) throw new Error("This payroll profile changed while you were editing. Reload the latest profile before saving. Your draft is retained until you reload.")
      const preserved = Object.fromEntries([
        ["tax_residency_code", "taxResidencyCode"], ["employment_tax_category", "employmentTaxCategory"], ["payment_method", "paymentMethod"], ["primary_bank_account_id", "primaryBankAccountId"], ["currency", "currency"], ["pay_frequency", "payFrequency"], ["effective_to", "effectiveTo"],
      ].flatMap(([snake, camel]) => original?.[snake] !== undefined || original?.[camel] !== undefined ? [[snake, original?.[snake] ?? original?.[camel] ?? undefined]] : []))
      const identifiers = ["taxpayer_identification_number", "social_security_number", "health_insurance_number"]
      const values = Object.fromEntries(Object.entries(form).filter(([key, fieldValue]) => !identifiers.includes(key) || fieldValue.trim()).map(([key, fieldValue]) => [key, fieldValue.trim()]))
      if (identifiers.some((key) => form[key]?.includes("*"))) throw new Error("Enter full identifiers, not masked values. Leave an identifier blank to keep the existing value.")
      await upsertEmployeePayrollProfile(token, { ...preserved, ...values, expected_version: Number(original?.version ?? 0), preserve_existing_identifiers: true, employee_id: employeeId, payroll_enabled: enabled, payroll_hold: hold, payroll_hold_reason: reason.trim() || undefined })
      setDirty(false); onChanged(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save payroll profile. Your draft is retained.") }
    finally { setSaving(false) }
  }
  return <OverlayDrawer open position="end" size="medium" onOpenChange={(_, data) => { if (!data.open) close() }}><DrawerHeader><DrawerHeaderTitle action={<Button onClick={close}>Close</Button>}>Payroll setup</DrawerHeaderTitle><p>{employeeName}</p></DrawerHeader><DrawerBody className="flex flex-col gap-4 !pb-6">
    {error ? <MessageBar intent="error"><MessageBarBody>{error}<Button disabled={saving} onClick={() => { if (!dirty || window.confirm("Discard the draft and load the latest profile?")) setRevision((current) => current + 1) }}>Reload profile</Button></MessageBarBody></MessageBar> : null}
    {loading ? <Spinner label="Loading payroll profile" /> : <>
      <p className="text-sm">Payroll owns these activation requirements. Salary approval and bank verification remain separate checks. Existing private identifiers are not displayed; leave their fields blank to keep them, or enter the full new value to replace them.</p>
      {fields.map(([key, , label]) => <Field key={key} label={label} required={key === "payroll_number" || key === "effective_from"}>{key === "effective_from" ? <DateInput className="max-w-none" value={form[key] ?? ""} disabled={!canEdit || saving} onValueChange={(nextValue) => { setDirty(true); setForm((current) => ({ ...current, [key]: nextValue })) }} /> : <Input value={form[key] ?? ""} disabled={!canEdit || saving} onChange={(_, data) => { setDirty(true); setForm((current) => ({ ...current, [key]: data.value })) }} />}</Field>)}
      <div className="grid gap-1">
        <Switch label="Payroll enabled" checked={enabled} disabled={!canEdit || saving} onChange={(_, data) => { setEnabled(data.checked); setDirty(true) }} />
        <p className="pl-10 text-xs text-muted-foreground">Includes this employee in payroll processing when the other payroll requirements are complete.</p>
      </div>
      <div className="grid gap-1">
        <Switch label="Payroll on hold" checked={hold} disabled={!canEdit || saving} onChange={(_, data) => { setHold(data.checked); setDirty(true) }} />
        <p className="pl-10 text-xs text-muted-foreground">Temporarily blocks payroll processing even when payroll is enabled. A hold reason is required.</p>
      </div>
      {hold ? <Field label="Hold reason" required><Input value={reason} disabled={!canEdit || saving} onChange={(_, data) => { setReason(data.value); setDirty(true) }} /></Field> : null}
      {employeeNo ? <a className="text-sm text-primary underline" href={`/dashboard/employees/profile/${encodeURIComponent(employeeNo)}`} target="_blank" rel="noopener noreferrer">Review bank details in employee profile (new tab)</a> : null}
      {canEdit ? <Button appearance="primary" size="large" className="min-h-10 w-full shrink-0" disabled={saving || !dirty} onClick={() => void save()}>{saving ? "Saving…" : "Save payroll setup"}</Button> : <p>Payroll management permission is required to edit.</p>}
    </>}
  </DrawerBody></OverlayDrawer>
}
