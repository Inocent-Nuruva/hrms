"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react"
import { GitCompareIcon, HistoryIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import { FluentSelect } from "@/components/ui/fluent-select"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import type { AdminRecord } from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { showErrorAlert } from "@/lib/error-alert"
import {
  POLICY_STATUS_LABEL,
  approvePolicyVersion,
  comparePolicyVersions,
  discardPolicyVersion,
  getPolicyImpact,
  listPolicyVersions,
  returnPolicyVersion,
  statusTone,
  submitPolicyVersion,
  type PolicyChange,
  type PolicyImpact,
  type PolicyVersion,
} from "@/lib/leave-engine-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { cn } from "@/lib/utils"

const token = () => readStoredSessionTokens().accessToken
const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
const show = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)

/**
 * Policy history: every approved change is a new version with its own
 * effective dates. Drafts are submitted, approved (effective today or later;
 * back-dating needs explicit confirmation) or returned, and can be compared
 * and previewed for the employees they affect before approval.
 */
export function LeavePolicyVersionsPanel({
  policies,
  onChanged,
}: {
  policies: AdminRecord[]
  onChanged?: () => void
}) {
  const actor = useDashboardActor()
  const canUpdate = canPerformPermission(actor.permissionLabels, "leave_policies:update")
  const canApprove = canPerformPermission(actor.permissionLabels, "leave_policies:approve")
  const [policyId, setPolicyId] = React.useState<number | null>(null)
  const [versions, setVersions] = React.useState<PolicyVersion[]>([])
  const [compare, setCompare] = React.useState<{ title: string; changes: PolicyChange[] } | null>(null)
  const [impact, setImpact] = React.useState<PolicyImpact | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [effectiveFrom, setEffectiveFrom] = React.useState(new Date().toISOString().slice(0, 10))

  const load = React.useCallback(async (id: number) => {
    try {
      setVersions((await listPolicyVersions(token(), id)).data)
    } catch (error) {
      showErrorAlert(errorText(error, "Could not load policy versions."))
    }
  }, [])

  React.useEffect(() => {
    if (policyId !== null) void load(policyId)
  }, [load, policyId])

  async function run(label: string, action: () => Promise<unknown>) {
    if (policyId === null) return
    setBusy(true)
    try {
      await action()
      await load(policyId)
      onChanged?.()
      showSuccessAlert(label)
    } catch (error) {
      showErrorAlert(errorText(error, "The action failed."))
    } finally {
      setBusy(false)
    }
  }

  async function approve(version: PolicyVersion) {
    const today = new Date().toISOString().slice(0, 10)
    const retroactive = effectiveFrom < today
    let reason: string | undefined
    if (retroactive) {
      if (!window.confirm(`Effective ${effectiveFrom} is in the past. This is a retroactive correction to open leave years. Continue?`)) return
      reason = window.prompt("Reason for the retroactive change (required)") ?? undefined
      if (!reason || reason.trim().length < 5) return
    }
    await run("Version approved", () =>
      approvePolicyVersion(token(), version.id, {
        effective_from: effectiveFrom,
        ...(retroactive ? { allow_retroactive: true, change_reason: reason } : {}),
      }),
    )
  }

  async function showCompare(version: PolicyVersion) {
    const previous = versions.find((item) => item.version_no < version.version_no && item.lifecycle_status !== "archived")
    if (!previous) {
      showErrorAlert("There is no earlier version to compare with.")
      return
    }
    try {
      const result = await comparePolicyVersions(token(), version.id, previous.id)
      setCompare({ title: `v${previous.version_no} → v${version.version_no}`, changes: result.changes })
    } catch (error) {
      showErrorAlert(errorText(error, "Could not compare versions."))
    }
  }

  async function showImpact(version: PolicyVersion) {
    try {
      setImpact(await getPolicyImpact(token(), version.id))
    } catch (error) {
      showErrorAlert(errorText(error, "Could not calculate the impact."))
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Policy versions">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <HistoryIcon className="size-4" /> Policy versions and approvals
          </h2>
          <p className="text-xs text-muted-foreground">
            Editing an approved policy creates a new version. Earlier versions stay for history and the calculations made under them.
          </p>
        </div>
        <FluentSelect
          className="max-w-sm"
          value={policyId != null ? String(policyId) : ""}
          onChange={(value) => {
            setCompare(null)
            setImpact(null)
            setPolicyId(value ? Number(value) : null)
          }}
          ariaLabel="Policy"
          placeholder="Choose a policy…"
          options={policies.map((policy) => ({
            value: String(policy.id),
            label: `${String(policy.name)} ${policy.version_no ? `(v${String(policy.version_no)})` : ""}`.trim(),
          }))}
        />
      </div>

      {policyId !== null ? (
        <>
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">Effective date for approvals</span>
            <DateInput className="w-44" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </label>
          <div className="overflow-x-auto">
            <StandardTable className="w-full min-w-[720px] text-sm" data-testid="policy-versions">
              <StandardTableHeader className="text-left text-xs text-muted-foreground">
                <StandardTableRow>
                  <StandardTableHead className="py-2">Version</StandardTableHead>
                  <StandardTableHead>Status</StandardTableHead>
                  <StandardTableHead>Effective</StandardTableHead>
                  <StandardTableHead>Reason</StandardTableHead>
                  <th />
                </StandardTableRow>
              </StandardTableHeader>
              <StandardTableBody>
                {versions.map((version) => (
                  <StandardTableRow key={version.id} className="border-t border-border align-top">
                    <StandardTableCell className="py-2 font-medium">v{version.version_no}</StandardTableCell>
                    <StandardTableCell>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusTone(version.lifecycle_status))}>
                        {POLICY_STATUS_LABEL[version.lifecycle_status]}
                      </span>
                    </StandardTableCell>
                    <StandardTableCell className="text-xs">
                      {version.effective_from ?? "Since the start"} → {version.effective_to ?? "open"}
                    </StandardTableCell>
                    <StandardTableCell className="max-w-xs text-xs">{version.change_reason ?? "—"}</StandardTableCell>
                    <StandardTableCell className="py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => void showCompare(version)}>
                          <GitCompareIcon className="mr-1 size-3.5" /> Compare
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void showImpact(version)}>
                          <UsersIcon className="mr-1 size-3.5" /> Affected employees
                        </Button>
                        {canUpdate && version.lifecycle_status === "draft" ? (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("Submitted for approval", () => submitPolicyVersion(token(), version.id))}>
                            Submit
                          </Button>
                        ) : null}
                        {canApprove && ["draft", "pending_approval"].includes(version.lifecycle_status) ? (
                          <Button size="sm" disabled={busy} onClick={() => void approve(version)}>
                            Approve
                          </Button>
                        ) : null}
                        {canApprove && version.lifecycle_status === "pending_approval" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              const reason = window.prompt("What needs to change?")
                              if (reason) void run("Returned to draft", () => returnPolicyVersion(token(), version.id, reason))
                            }}
                          >
                            Return
                          </Button>
                        ) : null}
                        {canUpdate && ["draft", "pending_approval"].includes(version.lifecycle_status) ? (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("Draft discarded", () => discardPolicyVersion(token(), version.id))}>
                            Discard
                          </Button>
                        ) : null}
                      </div>
                    </StandardTableCell>
                  </StandardTableRow>
                ))}
              </StandardTableBody>
            </StandardTable>
          </div>
        </>
      ) : null}

      {compare ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Changes {compare.title}</h3>
            <Button size="sm" variant="outline" onClick={() => setCompare(null)}>Close</Button>
          </div>
          {compare.changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No differences.</p>
          ) : (
            <div className="overflow-x-auto">
              <StandardTable className="w-full min-w-[520px] text-xs">
                <StandardTableHeader className="text-left text-muted-foreground">
                  <StandardTableRow><StandardTableHead className="py-1">Setting</StandardTableHead><StandardTableHead>Leave type</StandardTableHead><StandardTableHead>Before</StandardTableHead><StandardTableHead>After</StandardTableHead></StandardTableRow>
                </StandardTableHeader>
                <StandardTableBody>
                  {compare.changes.map((change, index) => (
                    <StandardTableRow key={index} className="border-t border-border">
                      <StandardTableCell className="py-1">{change.field.replace(/_/g, " ")}</StandardTableCell>
                      <StandardTableCell>{change.leave_type_name ?? (change.leave_type_id ? `#${change.leave_type_id}` : "Policy")}</StandardTableCell>
                      <StandardTableCell className="text-rose-700 dark:text-rose-300">{show(change.before)}</StandardTableCell>
                      <StandardTableCell className="text-emerald-700 dark:text-emerald-300">{show(change.after)}</StandardTableCell>
                    </StandardTableRow>
                  ))}
                </StandardTableBody>
              </StandardTable>
            </div>
          )}
        </div>
      ) : null}

      {impact ? (
        <div className="space-y-2 rounded-md border border-border p-3" data-testid="policy-impact">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Affected employees (v{impact.version_no}, from {impact.effective_from}): {impact.employees_affected} · {impact.rows_with_warnings} with warnings
            </h3>
            <Button size="sm" variant="outline" onClick={() => setImpact(null)}>Close</Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <StandardTable className="w-full min-w-[720px] text-xs">
              <StandardTableHeader className="sticky top-0 bg-background text-left text-muted-foreground">
                <StandardTableRow>
                  <StandardTableHead className="py-1">Employee</StandardTableHead><StandardTableHead>Leave type</StandardTableHead>
                  <StandardTableHead className="text-right">Entitlement now</StandardTableHead><StandardTableHead className="text-right">Proposed</StandardTableHead>
                  <StandardTableHead className="text-right">Balance now</StandardTableHead><StandardTableHead>Warnings</StandardTableHead>
                </StandardTableRow>
              </StandardTableHeader>
              <StandardTableBody>
                {impact.data.map((row, index) => (
                  <StandardTableRow key={index} className="border-t border-border align-top">
                    <StandardTableCell className="py-1">{row.employee_name || row.employee_no}</StandardTableCell>
                    <StandardTableCell>{row.leave_type_name}</StandardTableCell>
                    <StandardTableCell className="text-right">{show(row.current_entitlement)}</StandardTableCell>
                    <StandardTableCell className={cn("text-right", row.entitlement_change < 0 && "text-rose-600", row.entitlement_change > 0 && "text-emerald-600")}>
                      {show(row.proposed_entitlement)}
                    </StandardTableCell>
                    <StandardTableCell className="text-right">{show(row.current_available)}</StandardTableCell>
                    <StandardTableCell className="text-amber-700 dark:text-amber-300">{row.warnings.join(" ")}</StandardTableCell>
                  </StandardTableRow>
                ))}
              </StandardTableBody>
            </StandardTable>
          </div>
        </div>
      ) : null}
    </section>
  )
}
