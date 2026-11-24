"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  createNotificationRule,
  listNotificationDeliveries,
  listNotificationRules,
  updateNotificationRule,
  type AdminRecord,
  type NotificationRuleItem,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

/** Leave events that notify in-app and by email unless an admin rule turns them off. */
export const LEAVE_NOTIFICATION_EVENTS: Array<{ key: string; label: string; group: string }> = [
  { key: "leave.forwarded", label: "Request moved to next approver", group: "Requests" },
  { key: "leave.approval_reminder", label: "Approval reminder", group: "Requests" },
  { key: "leave.end_early", label: "Leave ended early", group: "Requests" },
  { key: "leave.encashment.requested", label: "Encashment requested", group: "Encashment" },
  { key: "leave.encashment.approved", label: "Encashment approved", group: "Encashment" },
  { key: "leave.encashment.rejected", label: "Encashment rejected", group: "Encashment" },
  { key: "leave.encashment.submitted_to_payroll", label: "Encashment sent to payroll", group: "Encashment" },
  { key: "leave.encashment.paid", label: "Encashment paid", group: "Encashment" },
  { key: "leave.encashment.payment_failed", label: "Encashment payment failed / reversed by payroll", group: "Encashment" },
  { key: "leave.encashment.reversed", label: "Encashment reversed", group: "Encashment" },
  { key: "leave.comp_off.requested", label: "Comp-off requested", group: "Compensatory off" },
  { key: "leave.comp_off.approved", label: "Comp-off approved", group: "Compensatory off" },
  { key: "leave.comp_off.rejected", label: "Comp-off rejected", group: "Compensatory off" },
  { key: "leave.comp_off.credited", label: "Comp-off credited", group: "Compensatory off" },
  { key: "leave.comp_off.expired", label: "Comp-off expired", group: "Compensatory off" },
  { key: "leave.rollover.completed", label: "Leave year closed (rollover)", group: "Year end" },
  { key: "leave.carry_forward.expiry_approaching", label: "Carried-forward leave expiring soon", group: "Year end" },
  { key: "leave.balance.forfeited", label: "Leave forfeited / expired", group: "Year end" },
  { key: "leave.exit_settlement.initiated", label: "Exit settlement started", group: "Exit settlement" },
  { key: "leave.exit_settlement.approved", label: "Exit settlement approved", group: "Exit settlement" },
  { key: "leave.exit_settlement.submitted_to_payroll", label: "Exit settlement sent to payroll", group: "Exit settlement" },
  { key: "leave.exit_settlement.completed", label: "Exit settlement completed", group: "Exit settlement" },
  { key: "leave.exit_settlement.failed", label: "Exit settlement failed", group: "Exit settlement" },
]

const DELIVERY_TONE: Record<string, string> = {
  DELIVERED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-slate-100 text-slate-700",
  FAILED: "bg-red-100 text-red-800",
  SKIPPED: "bg-amber-100 text-amber-800",
}

const ruleEvent = (rule: NotificationRuleItem) => String(rule.trigger_event ?? rule.triggerEvent ?? "")
const str = (v: unknown) => (v == null || v === "" ? "—" : String(v))

/**
 * Leave notification settings and delivery status. Each leave event is
 * on (in-app + email) by default; switching one off stores a company
 * notification rule for that event, which the notification service honours.
 */
export function LeaveNotificationsPanel() {
  const actor = useDashboardActor()
  const canEdit = canPerformPermission(actor.permissionLabels, "notifications:settings-update")
  const canReadDeliveries = canPerformPermission(actor.permissionLabels, "notifications:delivery-logs-read")
  const token = readStoredSessionTokens().accessToken ?? ""
  const [rules, setRules] = React.useState<NotificationRuleItem[]>([])
  const [deliveries, setDeliveries] = React.useState<AdminRecord[]>([])
  const [statusFilter, setStatusFilter] = React.useState("")
  const [busyKey, setBusyKey] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      setRules(await listNotificationRules(token, { related_module: "leave" }))
      if (canReadDeliveries) {
        const res = await listNotificationDeliveries(token, {
          related_module: "leave",
          limit: 25,
          status: (statusFilter || undefined) as never,
        })
        setDeliveries(res.rows as AdminRecord[])
      }
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not load leave notifications.")
    }
  }, [token, canReadDeliveries, statusFilter])

  React.useEffect(() => {
    void load()
  }, [load])

  async function toggle(eventKey: string, enabled: boolean) {
    setBusyKey(eventKey)
    try {
      const existing = rules.find((rule) => ruleEvent(rule) === eventKey)
      if (existing?.id != null) {
        await updateNotificationRule(token, existing.id, { enabled })
      } else {
        await createNotificationRule(token, {
          notification_type: "GENERAL",
          trigger_event: eventKey,
          related_module: "leave",
          recipient_type: "EVENT_RECIPIENTS",
          channels: ["IN_APP", "EMAIL"],
          enabled,
        })
      }
      showSuccessAlert(enabled ? "Notification switched on." : "Notification switched off.")
      await load()
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not save the notification setting.")
    } finally {
      setBusyKey(null)
    }
  }

  const groups = [...new Set(LEAVE_NOTIFICATION_EVENTS.map((e) => e.group))]
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="Leave notifications">
      <div>
        <h3 className="text-sm font-semibold">Leave notifications</h3>
        <p className="text-xs text-muted-foreground">
          These leave events notify the employee (and HR where relevant) in the app and by email. Failed emails are retried
          automatically. Employees can still mute channels in their own notification preferences.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group} className="rounded-md border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold">{group}</div>
            <ul className="divide-y divide-border">
              {LEAVE_NOTIFICATION_EVENTS.filter((e) => e.group === group).map((event) => {
                const rule = rules.find((r) => ruleEvent(r) === event.key)
                const enabled = rule ? rule.enabled !== false : true
                const channels = (rule?.channels as string[] | undefined) ?? ["IN_APP", "EMAIL"]
                return (
                  <li key={event.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <div>{event.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {enabled ? channels.join(" + ").replace("IN_APP", "In-app").replace("EMAIL", "Email") : "Off"}
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={enabled}
                        disabled={!canEdit || busyKey === event.key}
                        onChange={(e) => void toggle(event.key, e.target.checked)}
                        aria-label={`Send "${event.label}" notifications`}
                      />
                      {enabled ? "On" : "Off"}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {canReadDeliveries ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold">Recent leave notification deliveries</h4>
            <span className="inline-flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter deliveries by status"
              >
                <option value="">All statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="SKIPPED">Skipped</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
            </span>
          </div>
          <div className="overflow-x-auto">
            <StandardTable className="w-full min-w-[720px] text-xs">
              <StandardTableHeader className="bg-muted/40 text-left text-muted-foreground">
                <StandardTableRow>
                  <StandardTableHead className="px-2 py-1.5">When</StandardTableHead>
                  <StandardTableHead className="px-2 py-1.5">Notification</StandardTableHead>
                  <StandardTableHead className="px-2 py-1.5">Channel</StandardTableHead>
                  <StandardTableHead className="px-2 py-1.5">Recipient</StandardTableHead>
                  <StandardTableHead className="px-2 py-1.5">Status</StandardTableHead>
                  <StandardTableHead className="px-2 py-1.5">Attempts</StandardTableHead>
                  <StandardTableHead className="px-2 py-1.5">Last error</StandardTableHead>
                </StandardTableRow>
              </StandardTableHeader>
              <StandardTableBody>
                {deliveries.map((row) => {
                  const notification = (row.notification ?? {}) as AdminRecord
                  const status = String(row.status ?? "")
                  return (
                    <StandardTableRow key={String(row.id)} className="border-t border-border">
                      <StandardTableCell className="whitespace-nowrap px-2 py-1.5">{str(row.created_at).slice(0, 16).replace("T", " ")}</StandardTableCell>
                      <StandardTableCell className="px-2 py-1.5">{str(notification.title)}</StandardTableCell>
                      <StandardTableCell className="px-2 py-1.5">{str(row.channel)}</StandardTableCell>
                      <StandardTableCell className="px-2 py-1.5">{str(row.recipient_address)}</StandardTableCell>
                      <StandardTableCell className="px-2 py-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 font-medium", DELIVERY_TONE[status] ?? DELIVERY_TONE.PENDING)}>
                          {status || "—"}
                        </span>
                      </StandardTableCell>
                      <StandardTableCell className="px-2 py-1.5">{str(row.attempt_count)}</StandardTableCell>
                      <StandardTableCell className="max-w-xs px-2 py-1.5 text-red-700">{row.last_error ? String(row.last_error) : ""}</StandardTableCell>
                    </StandardTableRow>
                  )
                })}
                {!deliveries.length ? (
                  <StandardTableRow>
                    <StandardTableCell colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                      No leave notification deliveries yet.
                    </StandardTableCell>
                  </StandardTableRow>
                ) : null}
              </StandardTableBody>
            </StandardTable>
          </div>
        </div>
      ) : null}
    </section>
  )
}
