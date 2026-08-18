"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { getHrAttendanceSetupStatus, runHrAttendanceSetupWizard } from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { primaryButtonClass, readString, secondaryButtonClass } from "@/components/dashboard/talent-visuals"

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
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="button" className={primaryButtonClass} disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Run wizard
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()}>
            Refresh
          </button>
        </div>
      ) : null}
    </div>
  )
}
