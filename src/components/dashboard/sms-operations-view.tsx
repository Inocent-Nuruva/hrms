"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readBoolean,
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
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  getPlatformSmsGlobalSetting,
  getPlatformSmsRegistryItem,
  getSmsGlobalSetting,
  getSmsRegistryItem,
  listPlatformSmsLogs,
  listPlatformSmsRegistry,
  listSmsLogs,
  listSmsRegistry,
  retryPlatformSmsLog,
  retrySmsLog,
  sendTestSms,
  updatePlatformSmsGlobalSetting,
  updatePlatformSmsRegistryItem,
  updateSmsGlobalSetting,
  updateSmsRegistryItem,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  canAccessDashboardRoute,
  canPerformPermission,
  COMPANY_MANAGEMENT_ROUTE_PERMISSION,
  SMS_LOGS_RETRY_PERMISSION,
  SMS_SETTINGS_UPDATE_PERMISSION,
  SMS_TEST_PERMISSION,
} from "@/lib/dashboard-permissions"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { SmsRecipientPhoneInput } from "@/components/dashboard/sms-recipient-phone"
import {
  DEFAULT_SMS_DIAL_DIGITS,
  composeE164,
} from "@/components/dashboard/sms-recipient-phone-utils"

export type SmsOpsTab = "overview" | "registry" | "logs" | "platform"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function registryCode(row: AdminRecord) {
  return readString(row, ["code", "notificationCode", "notification_code"])
}

function settingEnabled(row: AdminRecord | null) {
  return readBoolean(row, ["isEnabled", "is_enabled"])
}

export function SmsOperationsView({ activeTab }: { activeTab: SmsOpsTab }) {
  const actor = useDashboardActor()
  const smsRoute =
    activeTab === "platform" ? "/dashboard/sms/platform" : `/dashboard/sms/${activeTab}`
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(smsRoute, actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)
  const hasPlatformAccess =
    actor.ready && canPerformPermission(actor.permissionLabels, COMPANY_MANAGEMENT_ROUTE_PERMISSION)
  const canUpdateSettings =
    actor.ready && canPerformPermission(actor.permissionLabels, SMS_SETTINGS_UPDATE_PERMISSION)
  const canRetryLogs =
    actor.ready && canPerformPermission(actor.permissionLabels, SMS_LOGS_RETRY_PERMISSION)
  const canSendTest =
    actor.ready && canPerformPermission(actor.permissionLabels, SMS_TEST_PERMISSION)

  const [global, setGlobal] = React.useState<AdminRecord | null>(null)
  const [platformGlobal, setPlatformGlobal] = React.useState<AdminRecord | null>(null)
  const [registry, setRegistry] = React.useState<AdminRecord[]>([])
  const [logs, setLogs] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"test" | "registry">("test")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")
  const [platformKind, setPlatformKind] = React.useState<"global" | "registry" | "logs">("global")
  const [logStatus, setLogStatus] = React.useState("")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const tasks: Array<Promise<unknown>> = []
    if (activeTab === "overview") {
      tasks.push(
        getSmsGlobalSetting(token).then(setGlobal).catch((errorObject) => {
          setGlobal(null)
          throw errorObject
        }),
        listSmsLogs(token, { limit: 20 }).then(setLogs).catch(() => setLogs([])),
      )
    }
    if (activeTab === "registry") {
      tasks.push(listSmsRegistry(token).then(setRegistry).catch((errorObject) => {
        setRegistry([])
        throw errorObject
      }))
    }
    if (activeTab === "logs") {
      tasks.push(
        listSmsLogs(token, {
          limit: 50,
          ...(logStatus ? { status: logStatus } : {}),
        }).then(setLogs).catch((errorObject) => {
          setLogs([])
          throw errorObject
        }),
      )
    }
    if (activeTab === "platform") {
      if (!hasPlatformAccess) {
        setError("Platform SMS controls need companies:read.")
        setLoading(false)
        return
      }
      if (platformKind === "global") {
        tasks.push(getPlatformSmsGlobalSetting(token).then(setPlatformGlobal).catch((errorObject) => {
          setPlatformGlobal(null)
          throw errorObject
        }))
      }
      if (platformKind === "registry") {
        tasks.push(listPlatformSmsRegistry(token).then(setRegistry).catch((errorObject) => {
          setRegistry([])
          throw errorObject
        }))
      }
      if (platformKind === "logs") {
        tasks.push(
          listPlatformSmsLogs(token, {
            limit: 50,
            ...(logStatus ? { status: logStatus } : {}),
          }).then(setLogs).catch((errorObject) => {
            setLogs([])
            throw errorObject
          }),
        )
      }
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      // Company SMS pages stay open and show the API error. Only platform
      // SMS is fail-closed (same "platform access required" case as Companies).
      if (activeTab === "platform" && leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load SMS data.")
    }
    setLoading(false)
  }, [activeTab, hasPlatformAccess, leaveIfForbidden, logStatus, platformKind])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const rows = activeTab === "registry" || (activeTab === "platform" && platformKind === "registry") ? registry : logs
  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function toggleGlobal(platform: boolean) {
    const token = readStoredToken()
    const current = platform ? platformGlobal : global
    if (!token || !current) return
    setBusyId(platform ? "platform-global" : "global")
    try {
      const next = !settingEnabled(current)
      if (platform) {
        await updatePlatformSmsGlobalSetting(token, { is_enabled: next })
        setPlatformGlobal({ ...current, isEnabled: next, is_enabled: next })
      } else {
        await updateSmsGlobalSetting(token, { is_enabled: next })
        setGlobal({ ...current, isEnabled: next, is_enabled: next })
      }
      toast.success(next ? "SMS enabled." : "SMS disabled.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not update SMS.")
    } finally {
      setBusyId("")
    }
  }

  async function retry(row: AdminRecord, platform: boolean) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`retry-${id}`)
    try {
      if (platform) await retryPlatformSmsLog(token, id)
      else await retrySmsLog(token, id)
      toast.success("Retry queued.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not retry.")
    } finally {
      setBusyId("")
    }
  }

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "test") {
        const recipientPhone = composeE164(
          form.country_code || DEFAULT_SMS_DIAL_DIGITS,
          form.phone_digits ?? "",
        )
        if (!recipientPhone || !form.message) {
          throw new Error("Enter a country code, 9-digit phone number, and message.")
        }
        await sendTestSms(token, {
          recipient_phone: recipientPhone,
          message: form.message,
        })
      } else {
        if (!form.code) throw new Error("Registry code is missing.")
        const payload = {
          is_enabled: form.is_enabled === "true",
          sms_template: form.sms_template || undefined,
          description: form.description || undefined,
        }
        if (form.platform === "true") await updatePlatformSmsRegistryItem(token, form.code, payload)
        else await updateSmsRegistryItem(token, form.code, payload)
      }
      toast.success("Saved.")
      setCreateOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "registry" || (activeTab === "platform" && platformKind === "registry")) {
      return [
        { key: "code", label: "Code", render: (row) => registryCode(row) || optionLabel(row) },
        { key: "name", label: "Name", render: (row) => readString(row, ["name", "notificationName", "notification_name"], "—") },
        { key: "module", label: "Module", render: (row) => prettify(readString(row, ["module"], "—")) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={settingEnabled(row) ? "ENABLED" : "DISABLED"} /> },
        ...(canUpdateSettings
          ? [
              {
                key: "actions",
                label: "Actions",
                render: (row: AdminRecord) => (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation()
                      setCreateMode("registry")
                      setForm({
                        code: registryCode(row),
                        sms_template: readString(row, ["smsTemplate", "sms_template"]),
                        description: readString(row, ["description"]),
                        is_enabled: settingEnabled(row) ? "true" : "false",
                        platform: activeTab === "platform" ? "true" : "false",
                      })
                      setCreateOpen(true)
                    }}
                  >
                    Edit
                  </button>
                ),
              } satisfies Column<AdminRecord>,
            ]
          : []),
      ]
    }
    return [
      { key: "to", label: "Recipient", render: (row) => readString(row, ["recipientPhone", "recipient_phone"], "—") },
      { key: "code", label: "Code", render: (row) => readString(row, ["notificationCode", "notification_code"], "—") },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "PENDING")} /> },
      { key: "error", label: "Error", render: (row) => readString(row, ["errorMessage", "error_message"], "—") },
      ...(canRetryLogs
        ? [
            {
              key: "actions",
              label: "Actions",
              render: (row: AdminRecord) => (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `retry-${rowId(row)}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    void retry(row, activeTab === "platform")
                  }}
                >
                  Retry
                </button>
              ),
            } satisfies Column<AdminRecord>,
          ]
        : []),
    ]
  }, [activeTab, busyId, canRetryLogs, canUpdateSettings, platformKind])

  if (!canAccess) return null

  const showTable = activeTab === "registry" || activeTab === "logs" || (activeTab === "platform" && platformKind !== "global")

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="SMS"
            title="Company SMS"
            description="Enable company SMS, inspect recent logs, and send a test message. Shown only if you have an SMS grant."
            actions={
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                  {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                  Refresh
                </button>
                {canSendTest ? (
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => {
                      setCreateMode("test")
                      setForm({
                        country_code: DEFAULT_SMS_DIAL_DIGITS,
                        phone_digits: "",
                        message: "",
                      })
                      setCreateOpen(true)
                    }}
                  >
                    Send test
                  </button>
                ) : null}
              </div>
            }
          />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Company SMS" value={global ? (settingEnabled(global) ? "On" : "Off") : "—"} />
            <MetricTile label="Recent logs" value={logs.length} />
            <MetricTile label="Failed" value={logs.filter((row) => readString(row, ["status"]).toUpperCase() === "FAILED").length} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Global setting</h2>
                <p className="text-sm text-muted-foreground">{readString(global, ["description"], "Turns company SMS notifications on or off.")}</p>
              </div>
              {canUpdateSettings ? (
                <button type="button" className={actionButtonClass} disabled={!global || busyId === "global"} onClick={() => void toggleGlobal(false)}>
                  {settingEnabled(global) ? "Disable" : "Enable"}
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "registry" ? "SMS registry" : activeTab === "logs" ? "SMS logs" : "Platform SMS"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "platform"
                ? "Platform registry and logs. Hidden without companies:read."
                : "Templates and delivery logs for the current company."}
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        </div>
      )}

      {activeTab === "platform" ? (
        <div className="flex flex-wrap gap-1.5">
          {(["global", "registry", "logs"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setPlatformKind(kind)}
              className={platformKind === kind ? "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold !text-white" : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"}
            >
              {prettify(kind)}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "platform" && platformKind === "global" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          {error ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Platform SMS</h2>
              <p className="text-sm text-muted-foreground">{readString(platformGlobal, ["description"], "Turns platform SMS on or off.")}</p>
            </div>
            {canUpdateSettings ? (
              <button type="button" className={actionButtonClass} disabled={!platformGlobal || busyId === "platform-global"} onClick={() => void toggleGlobal(true)}>
                {settingEnabled(platformGlobal) ? "Disable" : "Enable"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showTable ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
            {activeTab === "logs" || (activeTab === "platform" && platformKind === "logs") ? (
              <select className={inputClass + " max-w-40"} value={logStatus} onChange={(event) => setLogStatus(event.target.value)}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
            ) : null}
          </div>
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="SMS records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`sms-${activeTab}-${platformKind}`}
              onRowSelect={(_, row) => {
                if (!row) return
                setDetail(row)
                const token = readStoredToken()
                const code = registryCode(row)
                if (token && code && (activeTab === "registry" || platformKind === "registry")) {
                  const loader = activeTab === "platform" ? getPlatformSmsRegistryItem : getSmsRegistryItem
                  void loader(token, code).then((record) => record && setDetail(record)).catch(() => undefined)
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail)} row={detail} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{createMode === "test" ? "Send test SMS" : "Update registry item"}</DialogTitle>
            <DialogDescription>Send a test message or update this registry item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "test" ? (
              <>
                <SmsRecipientPhoneInput
                  countryCode={form.country_code || DEFAULT_SMS_DIAL_DIGITS}
                  nationalDigits={form.phone_digits ?? ""}
                  onChange={({ countryCode, nationalDigits }) =>
                    setForm((current) => ({
                      ...current,
                      country_code: countryCode,
                      phone_digits: nationalDigits,
                    }))
                  }
                />
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Message</span><textarea className={textareaClass} value={form.message ?? ""} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} /></label>
              </>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Enabled</span>
                  <select className={inputClass} value={form.is_enabled ?? "true"} onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.value }))}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Template</span><textarea className={textareaClass} value={form.sms_template ?? ""} onChange={(event) => setForm((current) => ({ ...current, sms_template: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
              </>
            )}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
