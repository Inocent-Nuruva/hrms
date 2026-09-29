"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { Button, Field, Input } from "@fluentui/react-components"
import { toast } from "@/components/ui/fluent-toast-store"

import { getHrAttendanceSetupStatus, runHrAttendanceSetupWizard } from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { readString } from "@/components/dashboard/talent-visuals"

export function AttendanceSetupWizard() {
  const actor = useDashboardActor()
  const canRun = canPerformPermission(actor.permissionLabels, {
    permissions: ["attendance_policies:create", "attendance_policies:update"],
    mode: "any",
  })
  const [status, setStatus] = React.useState("")
  const [name, setName] = React.useState("Default attendance policy")
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return
    try {
      const record = await getHrAttendanceSetupStatus(token)
      setStatus(readString(record, ["status", "message", "summary"], "Not configured"))
    } catch {
      setStatus("Could not read setup status.")
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function run() {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token || !name.trim()) return
    setBusy(true)
    try {
      await runHrAttendanceSetupWizard(token, { policy: { name: name.trim() } })
      toast.success("Attendance setup wizard started.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Wizard failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border/80 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Setup wizard</p>
        <p className="text-sm text-foreground">{status || "Create the first company attendance policy from the documented wizard."}</p>
      </div>
      {canRun ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Policy name" size="small" className="min-w-56">
            <Input
              aria-label="Policy name created by the attendance setup wizard"
              size="small"
              className="w-full"
              value={name}
              onChange={(_event, data) => setName(data.value)}
            />
          </Field>
          <Button
            type="button"
            appearance="primary"
            size="small"
            disabled={busy || !name.trim()}
            onClick={() => void run()}
          >
            {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Run wizard
          </Button>
          <Button type="button" appearance="outline" size="small" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      ) : null}
    </div>
  )
}
