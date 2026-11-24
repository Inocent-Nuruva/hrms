"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard"
import {
  getMovementPolicy,
  resetMovementPolicy,
  saveMovementPolicy,
  type MovementPolicy,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"

export function MovementSettingsView() {
  const actor = useDashboardActor()
  const allowed =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/movements/settings",
      actor.permissionLabels,
      actor.accessMode
    )
  useForbiddenRouteGuard(allowed)
  const leaveIfForbidden = useLeaveIfForbidden()
  const [policy, setPolicy] = useState<MovementPolicy | null>(null)
  const [days, setDays] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!allowed) return
    let current = true
    getMovementPolicy(readStoredSessionTokens().accessToken)
      .then((value) => {
        if (current) {
          setPolicy(value)
          setDays(String(value.max_backdate_days))
        }
      })
      .catch((cause) => {
        if (current && !leaveIfForbidden(cause))
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load movement settings."
          )
      })
    return () => {
      current = false
    }
  }, [allowed, leaveIfForbidden])

  async function update(reset: boolean) {
    if (!policy || busy) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const token = readStoredSessionTokens().accessToken
      const value = reset
        ? await resetMovementPolicy(token)
        : await saveMovementPolicy(token, {
            require_management_approval: policy.require_management_approval,
            allow_backdating: policy.allow_backdating,
            max_backdate_days: Number(days),
          })
      setPolicy(value)
      setDays(String(value.max_backdate_days))
      setMessage(
        reset ? "Installation defaults restored." : "Movement settings saved."
      )
    } catch (cause) {
      if (!leaveIfForbidden(cause))
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not update movement settings."
        )
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void update(false)
  }

  if (!allowed) return null
  return (
    <section className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">Movement settings</h1>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!policy && !error && <p role="status">Loading movement settings…</p>}
      {policy && (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border bg-card p-5"
        >
          <p className="text-sm text-muted-foreground">
            {policy.source === "installation"
              ? "Using installation defaults."
              : "Using this company’s settings."}
          </p>
          <fieldset disabled={busy} className="space-y-5">
            <label className="flex items-start gap-3">
              <input
                className="mt-1"
                type="checkbox"
                checked={policy.require_management_approval}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    require_management_approval: e.target.checked,
                  })
                }
              />
              Require management approval for promotions and demotions
            </label>
            <p className="text-sm text-muted-foreground">
              Approval changes take effect when a movement is submitted.
            </p>
            <label className="flex items-start gap-3">
              <input
                className="mt-1"
                type="checkbox"
                checked={policy.allow_backdating}
                onChange={(e) =>
                  setPolicy({ ...policy, allow_backdating: e.target.checked })
                }
              />
              Allow backdating for users with backdate permission
            </label>
            <label className="grid max-w-xs gap-2">
              Maximum backdate days
              <Input
                required
                type="number"
                min={0}
                max={2147483647}
                step={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save settings</Button>
              {policy.source === "company" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void update(true)}
                >
                  Restore installation defaults
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}
