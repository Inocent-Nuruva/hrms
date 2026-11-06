"use client"

import * as React from "react"

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import { FluentSelect, type FluentSelectOption } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"

export type OnboardingTaskReassignment = {
  assigned_company_user_id?: number
  assigned_department_id?: number
  due_date?: string
}

export type OnboardingTaskReassignTarget = {
  title: string
  assignedUserId: number | null
  assignedDepartmentId: number | null
  dueDate: string
}

/** Build the PATCH payload: only fields the user actually changed. */
export function buildTaskReassignment(
  current: OnboardingTaskReassignTarget,
  next: { userId: string; departmentId: string; dueDate: string },
): OnboardingTaskReassignment {
  const payload: OnboardingTaskReassignment = {}
  const userId = Number(next.userId)
  const departmentId = Number(next.departmentId)
  if (next.userId && userId > 0 && userId !== current.assignedUserId) {
    payload.assigned_company_user_id = userId
  }
  if (next.departmentId && departmentId > 0 && departmentId !== current.assignedDepartmentId) {
    payload.assigned_department_id = departmentId
  }
  if (next.dueDate && next.dueDate !== current.dueDate) {
    payload.due_date = next.dueDate
  }
  return payload
}

export function OnboardingTaskReassignDialog({
  target,
  userOptions,
  departmentOptions,
  saving,
  onClose,
  onSubmit,
}: {
  target: OnboardingTaskReassignTarget | null
  userOptions: FluentSelectOption[]
  departmentOptions: FluentSelectOption[]
  saving: boolean
  onClose: () => void
  onSubmit: (payload: OnboardingTaskReassignment) => void
}) {
  const [userId, setUserId] = React.useState("")
  const [departmentId, setDepartmentId] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")

  React.useEffect(() => {
    if (!target) return
    setUserId(target.assignedUserId ? String(target.assignedUserId) : "")
    setDepartmentId(target.assignedDepartmentId ? String(target.assignedDepartmentId) : "")
    setDueDate(target.dueDate)
  }, [target])

  const payload = target ? buildTaskReassignment(target, { userId, departmentId, dueDate }) : {}
  const hasChanges = Object.keys(payload).length > 0

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogPopup from="bottom" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reassign task</DialogTitle>
          <DialogDescription>
            {target?.title ? `“${target.title}” — ` : ""}change who owns this task or when it is due. The new owner is notified.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FluentSelect
            label="Department"
            ariaLabel="Department"
            value={departmentId}
            onChange={setDepartmentId}
            options={[{ value: "", label: "Keep current department" }, ...departmentOptions]}
          />
          <FluentSelect
            label="Person"
            ariaLabel="Person"
            value={userId}
            onChange={setUserId}
            options={[{ value: "", label: "Keep current person" }, ...userOptions]}
          />
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Due date
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !hasChanges} onClick={() => onSubmit(payload)}>
            {saving ? "Saving…" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
