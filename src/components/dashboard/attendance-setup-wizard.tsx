"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight20Regular,
  ArrowSync20Regular,
  CheckmarkCircle20Regular,
  Sparkle20Regular,
  Warning20Regular,
} from "@fluentui/react-icons"
import { Button as FluentButton, Field } from "@fluentui/react-components"

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/animate-ui/components/base/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/fluent-toast-store"
import { Input } from "@/components/ui/input"

import {
  getHrAttendanceSetupStatus,
  runHrAttendanceSetupWizard,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { asRecord, readString } from "@/components/dashboard/talent-visuals"

export function AttendanceSetupWizard() {
  const router = useRouter()
  const actor = useDashboardActor()
  const canRun = canPerformPermission(actor.permissionLabels, {
    permissions: ["attendance_policies:create", "attendance_policies:update"],
    mode: "any",
  })
  const canManageCheckpoints = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "attendance_checkpoints:create",
      "attendance_checkpoints:update",
    ],
    mode: "any",
  })
  const [setup, setSetup] = React.useState<AdminRecord | null>(null)
  const [statusError, setStatusError] = React.useState("")
  const [loadingStatus, setLoadingStatus] = React.useState(true)
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [quickstartOpen, setQuickstartOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return
    setLoadingStatus(true)
    setStatusError("")
    try {
      const record = await getHrAttendanceSetupStatus(token)
      setSetup(record)
    } catch {
      setStatusError("Could not check the latest attendance setup status.")
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function run() {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return
    if (!name.trim()) {
      toast.error(
        "Enter a short name for these attendance rules, such as Head office attendance.",
      )
      return
    }
    setBusy(true)
    try {
      await runHrAttendanceSetupWizard(token, {
        policy: { name: name.trim() },
      })
      toast.success(
        "Starter attendance policy created. Review the remaining setup items below.",
      )
      setName("")
      await load()
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Could not create the attendance policy."
      toast.error(
        /already exists/i.test(message)
          ? `A policy named “${name.trim()}” already exists. Choose a different name or edit the existing policy.`
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  const activePolicy = asRecord(setup?.activePolicy)
  const activePolicyName = readString(activePolicy, ["name"])
  const missingItems = Array.isArray(setup?.missing)
    ? setup.missing.filter((item): item is string => typeof item === "string")
    : []
  const isComplete = setup?.isComplete === true
  const hasActivePolicy = Boolean(activePolicy)
  const hasMissingCheckpoint = missingItems.some((item) =>
    item.toLowerCase().includes("checkpoint"),
  )
  const statusTitle = loadingStatus
    ? "Checking attendance setup"
    : statusError
      ? "Setup status unavailable"
      : isComplete
        ? "Attendance setup is complete"
        : hasActivePolicy
          ? "Attendance setup needs attention"
          : "Create your first attendance policy"
  const statusLabel = loadingStatus
    ? "Checking"
    : statusError
      ? "Unavailable"
      : isComplete
        ? "Complete"
        : hasActivePolicy
          ? "In progress"
          : "Not configured"
  const statusDescription = loadingStatus
    ? "Please wait while HRMS checks your attendance configuration."
    : statusError
      ? statusError
      : isComplete
        ? `The active policy${activePolicyName ? ` “${activePolicyName}”` : ""} is ready to calculate employee attendance.`
        : hasActivePolicy
          ? `Your active policy${activePolicyName ? ` is “${activePolicyName}”` : ""}. Complete the remaining schedule and clock-in requirements before attendance is ready for employees.`
          : "Start by creating the rule set HRMS will use to calculate attendance. This creates an active starter policy; you can review grace periods, late rules, geofences, and clock-in methods afterward."

  return (
    <Dialog open={quickstartOpen} onOpenChange={setQuickstartOpen}>
      <div className="flex sm:justify-end">
        <DialogTrigger
          render={
            <FluentButton
              type="button"
              appearance="subtle"
              size="small"
              icon={<Sparkle20Regular />}
              className="w-full sm:w-auto"
            />
          }
        >
          Policy creation quickstart
        </DialogTrigger>
      </div>

      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Policy creation quickstart</DialogTitle>
          <DialogDescription>
            Review what is ready, complete the next setup step, or create the
            first attendance policy.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          {isComplete ? <CheckmarkCircle20Regular /> : <Warning20Regular />}
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <span>{statusTitle}</span>
            <Badge variant={isComplete ? "secondary" : "outline"}>
              {statusLabel}
            </Badge>
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{statusDescription}</p>

            {!loadingStatus && hasActivePolicy && missingItems.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="font-medium text-foreground">
                  {missingItems.length}{" "}
                  {missingItems.length === 1 ? "item" : "items"} remaining:
                </p>
                <ul className="list-disc pl-5">
                  {missingItems.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {hasMissingCheckpoint ? (
                  <div className="flex flex-col items-start gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setQuickstartOpen(false)
                        router.push("/dashboard/attendance/checkpoints")
                      }}
                    >
                      {canManageCheckpoints
                        ? "Create or activate checkpoint"
                        : "View checkpoints"}
                      <ArrowRight20Regular data-icon="inline-end" />
                    </Button>
                    <p className="text-xs">
                      Create a checkpoint if none exists, or activate an
                      inactive checkpoint to complete this step.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canRun && !loadingStatus && !statusError && !hasActivePolicy ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field
                  label="Name for this attendance rule set"
                  hint="Use a clear administrative name, such as “Head office attendance”. You can edit the detailed rules after creation."
                  size="small"
                  className="min-w-0 flex-1 sm:max-w-md"
                >
                  <Input
                    aria-label="Name for this attendance rule set"
                    placeholder="For example, Head office attendance"
                    size="small"
                    value={name}
                    onChange={(_event, data) => setName(data.value)}
                  />
                </Field>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !name.trim()}
                  onClick={() => void run()}
                >
                  {busy ? (
                    <FluentLoadingIndicator
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <Sparkle20Regular data-icon="inline-start" />
                  )}
                  {busy ? "Creating policy…" : "Create starter policy"}
                </Button>
              </div>
            ) : null}

            {!loadingStatus ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void load()}
                >
                  <ArrowSync20Regular data-icon="inline-start" />
                  Refresh setup status
                </Button>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <DialogClose>Close</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
