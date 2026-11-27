"use client"

import { PageShell } from "@/components/dashboard/page-shell"
import { PageHeader } from "@/components/ui/page-header"
import * as React from "react"
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
} from "@fluentui/react-components"
import {
  ArrowClockwise20Regular,
  CheckmarkCircle20Regular,
  Eye20Regular,
  MoneyHand20Regular,
  PersonAdd20Regular,
  Person20Regular,
  Delete20Regular,
} from "@fluentui/react-icons"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { PayrollEmployeeSalaryDialog } from "@/components/dashboard/payroll-employee-salary-dialog"
import { toast } from "@/components/ui/fluent-toast-store"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  approveEmployeePayrollSalary,
  assignEligibleSalaryApprovers,
  listEligibleSalaryApprovers,
  listSalaryApproverCandidates,
  listPayrollSalaryStructures,
  listSalaryApprovals,
  removeEligibleSalaryApprover,
  type AdminRecord,
} from "@/lib/admin-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { resolveBackendMediaUrl } from "@/lib/backend-media-url"

function record(value: unknown): AdminRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : {}
}

function text(row: AdminRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function money(row: AdminRecord) {
  const value = Number(row.baseSalary)
  return `${text(row, "currency") || "TZS"} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}`
}

function personName(row: AdminRecord) {
  const name = text(row, "name", "full_name", "fullName")
  if (name) return name
  return [text(row, "first_name", "firstName"), text(row, "last_name", "lastName")].filter(Boolean).join(" ") || text(row, "email") || "Unknown user"
}

function personPhoto(row: AdminRecord) {
  const selectedAvatar = record(row.selected_default_avatar ?? row.selectedDefaultAvatar)
  return resolveBackendMediaUrl(text(
    row,
    "profile_photo_url",
    "profilePhotoUrl",
  ) || text(selectedAvatar, "image_path", "imagePath", "file_url", "fileUrl")) ?? undefined
}

export function SalaryApprovalsView() {
  const actor = useDashboardActor()
  const canApprove = canPerformPermission(actor.permissionLabels, "payroll:salary-approve")
  const canAssignApprovers = canApprove || canPerformPermission(actor.permissionLabels, "company_users:update")
  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [structures, setStructures] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState("")
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)
  const [assignmentOpen, setAssignmentOpen] = React.useState(false)
  const [assignmentLoading, setAssignmentLoading] = React.useState(false)
  const [assignmentSaving, setAssignmentSaving] = React.useState(false)
  const [removingApproverId, setRemovingApproverId] = React.useState("")
  const [assignmentQuery, setAssignmentQuery] = React.useState("")
  const [companyUsers, setCompanyUsers] = React.useState<AdminRecord[]>([])
  const [eligibleApprovers, setEligibleApprovers] = React.useState<AdminRecord[]>([])
  const [selectedApproverUserIds, setSelectedApproverUserIds] = React.useState<string[]>([])

  const currentApproverMembershipIds = React.useMemo(
    () => new Set(eligibleApprovers.map((row) => Number(row.company_user_id ?? row.companyUserId)).filter(Boolean)),
    [eligibleApprovers],
  )
  const assignableUsers = React.useMemo(() => companyUsers.filter((row) => {
    const membershipId = Number(row.company_user_id ?? row.companyUserId)
    return !currentApproverMembershipIds.has(membershipId)
  }), [companyUsers, currentApproverMembershipIds])
  const filteredAssignableUsers = React.useMemo(() => {
    const query = assignmentQuery.trim().toLowerCase()
    return assignableUsers.filter((row) => {
      const userId = String(row.company_user_id ?? row.companyUserId ?? "")
      return !selectedApproverUserIds.includes(userId) && (!query || `${personName(row)} ${text(row, "email", "user_no")}`.toLowerCase().includes(query))
    })
  }, [assignableUsers, assignmentQuery, selectedApproverUserIds])
  const companyUserByUserId = React.useMemo(
    () => new Map(companyUsers.map((row) => [String(row.company_user_id ?? row.companyUserId ?? ""), row])),
    [companyUsers],
  )

  const refresh = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token) return
    setLoading(true)
    try {
      const [approvalRows, structureRows] = await Promise.all([
        listSalaryApprovals(token),
        listPayrollSalaryStructures(token),
      ])
      setRows(approvalRows)
      setStructures(structureRows)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary approvals could not be loaded")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const loadApproverManagement = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token || !canAssignApprovers) return
    setAssignmentLoading(true)
    try {
      const [users, approvers] = await Promise.all([
        listSalaryApproverCandidates(token),
        listEligibleSalaryApprovers(token),
      ])
      setCompanyUsers(users)
      setEligibleApprovers(approvers)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary approvers could not be loaded")
    } finally {
      setAssignmentLoading(false)
    }
  }, [canAssignApprovers])

  React.useEffect(() => {
    if (!assignmentOpen) return
    setAssignmentQuery("")
    setSelectedApproverUserIds([])
    void loadApproverManagement()
  }, [assignmentOpen, loadApproverManagement])

  async function assignApprovers() {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token || !selectedApproverUserIds.length) return
    setAssignmentSaving(true)
    try {
      await assignEligibleSalaryApprovers(token, selectedApproverUserIds)
      toast.success(`${selectedApproverUserIds.length} salary approver${selectedApproverUserIds.length === 1 ? "" : "s"} assigned`)
      setSelectedApproverUserIds([])
      await loadApproverManagement()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary approvers could not be assigned")
    } finally {
      setAssignmentSaving(false)
    }
  }

  async function removeApprover(approver: AdminRecord) {
    const companyUserId = String(approver.company_user_id ?? approver.companyUserId ?? "")
    if (!companyUserId) return
    setRemovingApproverId(companyUserId)
    try {
      const token = readStoredSessionTokens().accessToken.trim()
      if (!token) return
      await removeEligibleSalaryApprover(token, companyUserId)
      toast.success(`${personName(approver)} removed from salary approvers`)
      await loadApproverManagement()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary approver could not be removed")
    } finally {
      setRemovingApproverId("")
    }
  }
  async function approve(row: AdminRecord) {
    const employee = record(row.employee)
    const employeeId = text(employee, "id")
    const token = readStoredSessionTokens().accessToken.trim()
    if (!token || !employeeId) return
    setBusyId(text(row, "id"))
    try {
      await approveEmployeePayrollSalary(token, employeeId)
      toast.success("Starting salary approved")
      await refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salary could not be approved")
    } finally {
      setBusyId("")
    }
  }

  const pendingCount = rows.filter((row) => text(row, "status") === "PENDING_APPROVAL").length

  return (
    <PageShell>
      <header className="border-b border-border px-4 py-4 sm:px-6">
        <PageHeader
          title={<span className="inline-flex items-center gap-2"><MoneyHand20Regular />Salary approvals</span>}
          description="Review starting salaries, assigned approvers, and completed decisions."
          stats={[
            { label: "Pending", value: pendingCount, tone: pendingCount ? "warning" : "success" },
            { label: "Approved", value: rows.length - pendingCount, tone: "success" },
          ]}
          actions={<>
            {canAssignApprovers ? <Button appearance="primary" icon={<PersonAdd20Regular />} onClick={() => setAssignmentOpen(true)}>Assign approvers</Button> : null}
            <Button icon={<ArrowClockwise20Regular />} aria-label="Refresh salary approvals" onClick={() => void refresh()} />
          </>}
        />
      </header>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center"><FluentLoadingIndicator /></div>
      ) : rows.length ? (
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div aria-hidden="true" className="hidden grid-cols-[minmax(200px,1.4fr)_minmax(120px,1fr)_minmax(180px,1.4fr)_minmax(130px,0.8fr)_auto] gap-4 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Employee</span><span>Salary</span><span>Submitted / approver</span><span>Status</span><span className="w-[200px] text-right">Actions</span>
            </div>
            <ul aria-label="Salary approvals" className="divide-y divide-border">
              {rows.map((row) => {
                const employee = record(row.employee)
                const approval = record(row.approval)
                const submittedBy = record(approval.submitted_by)
                const assignedTo = record(approval.assigned_to)
                const approvedBy = record(approval.approved_by)
                const pending = text(row, "status") === "PENDING_APPROVAL"
                return (
                  <li key={text(row, "id")} className="grid gap-3 px-4 py-4 hover:bg-muted/30 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_minmax(120px,1fr)_minmax(180px,1.4fr)_minmax(130px,0.8fr)_auto] lg:items-center lg:gap-4 lg:py-3">
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <div className="truncate font-semibold">{text(employee, "name")}</div>
                      <div className="text-xs text-muted-foreground">{text(employee, "employee_no")}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium tabular-nums">{money(row)}</div>
                      <div className="text-xs text-muted-foreground">Structure: {text(row, "salaryStructureCode") || "—"}</div>
                    </div>
                    <div className="min-w-0 text-sm">
                      <div className="truncate"><span className="text-xs text-muted-foreground">Submitted by </span>{text(submittedBy, "name") || "Not recorded"}</div>
                      <div className="truncate"><span className="text-xs text-muted-foreground">Approver </span>{text(approvedBy, "name") || text(assignedTo, "name") || "Any eligible approver"}</div>
                    </div>
                    <div><Badge appearance="tint" color={pending ? "warning" : "success"}>{pending ? "Pending approval" : "Approved"}</Badge></div>
                    <div className="flex items-center gap-2 sm:justify-end lg:w-[200px]">
                      <Button className="flex-1 sm:flex-none" icon={<Eye20Regular />} onClick={() => setSelected(row)}>Review</Button>
                      {pending && canApprove ? <Button className="flex-1 sm:flex-none" appearance="primary" icon={<CheckmarkCircle20Regular />} disabled={busyId === text(row, "id")} onClick={() => void approve(row)}>Approve</Button> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
          <CheckmarkCircle20Regular className="text-emerald-600" />
          <p className="font-medium">No salary approvals yet</p>
          <p className="text-sm text-muted-foreground">New starting salary assignments will appear here.</p>
        </div>
      )}

      {selected ? (
        <PayrollEmployeeSalaryDialog
          open
          onOpenChange={(open) => { if (!open) setSelected(null) }}
          employeeId={text(record(selected.employee), "id")}
          employeeLabel={`${text(record(selected.employee), "name")} (${text(record(selected.employee), "employee_no")})`}
          structures={structures}
          canEdit={false}
          canApprove={canApprove}
          onChanged={() => void refresh()}
          drawer
        />
      ) : null}

      <Dialog open={assignmentOpen} onOpenChange={(_event, data) => setAssignmentOpen(data.open)}>
        <DialogSurface className="max-w-2xl">
          <DialogBody>
            <DialogTitle
              action={<DialogTrigger disableButtonEnhancement><Button appearance="subtle" aria-label="Close salary approver assignment">Close</Button></DialogTrigger>}
            >Assign salary approvers</DialogTitle>
            <DialogContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Select one or more people. They will be able to receive and approve starting-salary requests.
              </p>
              {assignmentLoading ? <div className="flex min-h-32 items-center justify-center"><FluentLoadingIndicator /></div> : <>
                <div className="space-y-2">
                  <div className="text-sm font-medium">People to add</div>
                  <TagPicker
                    selectedOptions={selectedApproverUserIds}
                    onOptionSelect={(_event, data) => {
                      if (data.value === "__no-results") return
                      setSelectedApproverUserIds(data.selectedOptions)
                      setAssignmentQuery("")
                    }}
                  >
                    <TagPickerControl className="w-full">
                      <TagPickerGroup aria-label="Selected salary approvers">
                        {selectedApproverUserIds.map((userId) => {
                          const user = companyUserByUserId.get(userId) ?? {}
                          const name = personName(user)
                          return <Tag key={userId} value={userId} media={<Avatar name={name} image={personPhoto(user) ? { src: personPhoto(user) } : undefined} icon={<Person20Regular />} size={20} />}>{name}</Tag>
                        })}
                      </TagPickerGroup>
                      <TagPickerInput
                        aria-label="Search people to assign as salary approvers"
                        placeholder={selectedApproverUserIds.length ? "Add another person" : "Type a name or email"}
                        value={assignmentQuery}
                        onChange={(event) => setAssignmentQuery(event.currentTarget.value)}
                      />
                    </TagPickerControl>
                    <TagPickerList>
                      {filteredAssignableUsers.length ? filteredAssignableUsers.map((user) => {
                        const userId = String(user.company_user_id ?? user.companyUserId ?? "")
                        const name = personName(user)
                        const photo = personPhoto(user)
                        return <TagPickerOption key={userId} value={userId} text={name} media={<Avatar name={name} image={photo ? { src: photo } : undefined} icon={<Person20Regular />} size={28} />}>
                          <div><div>{name}</div><div className="text-xs text-muted-foreground">{text(user, "email", "user_no")}</div></div>
                        </TagPickerOption>
                      }) : <TagPickerOption value="__no-results">
                        {assignmentQuery.trim() ? "No people match your search" : "No people are available to assign"}
                      </TagPickerOption>}
                    </TagPickerList>
                  </TagPicker>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Current salary approvers ({eligibleApprovers.length})</div>
                  <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                    {eligibleApprovers.map((approver) => {
                      const member = companyUsers.find((user) => Number(user.company_user_id ?? user.companyUserId) === Number(approver.company_user_id ?? approver.companyUserId)) ?? approver
                      const name = personName(member)
                      const photo = personPhoto(member)
                      const companyUserId = String(approver.company_user_id ?? approver.companyUserId ?? "")
                      return <div key={companyUserId} className="flex items-center gap-2 rounded-md border p-2">
                        <Avatar name={name} image={photo ? { src: photo } : undefined} icon={<Person20Regular />} size={32} />
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{name}</div><div className="truncate text-xs text-muted-foreground">{text(member, "email")}</div></div>
                        <Button appearance="subtle" size="small" icon={<Delete20Regular />} aria-label={`Remove ${name} as salary approver`} title="Remove approver" disabled={Boolean(removingApproverId)} onClick={() => void removeApprover(approver)} />
                      </div>
                    })}
                  </div>
                </div>
              </>}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement><Button appearance="secondary">Cancel</Button></DialogTrigger>
              <Button appearance="primary" disabled={assignmentLoading || assignmentSaving || !selectedApproverUserIds.length} onClick={() => void assignApprovers()}>
                {assignmentSaving ? "Assigning…" : `Assign ${selectedApproverUserIds.length || ""} approver${selectedApproverUserIds.length === 1 ? "" : "s"}`}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </PageShell>
  )
}
