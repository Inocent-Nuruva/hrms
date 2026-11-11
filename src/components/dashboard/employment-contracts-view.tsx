"use client"

import * as React from "react"

import { ContractsList } from "@/components/dashboard/contracts/contracts-list"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import type { AdminRecord } from "@/lib/admin-api"
import { readAccessToken } from "@/lib/contracts-api"
import { canPerformPermission } from "@/lib/dashboard-permissions"

function employeeName(employee: AdminRecord) {
  const full = typeof employee.full_name === "string" ? employee.full_name : ""
  const parts = [employee.first_name, employee.last_name].filter((part) => typeof part === "string" && part).join(" ")
  return full || parts || `Employee #${String(employee.id)}`
}

/**
 * Contract list embedded in onboarding, recruitment and the employee
 * profile. With `employee` it shows that employee's contracts only.
 * Editing actions show only for users who can manage contracts; read-only
 * users see the list without "New contract" or edit actions.
 */
export function EmploymentContractsView({ employee, canManage }: { employee?: AdminRecord; canManage?: boolean } = {}) {
  const actor = useDashboardActor()
  const allowedToManage =
    canPerformPermission(actor.permissionLabels, "employment_contracts:manage") && canManage !== false
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  if (!token) return null
  const employeeId = employee ? Number(employee.id) || null : null
  return (
    <ContractsList
      token={token}
      canManage={allowedToManage}
      employeeId={employeeId}
      employeeName={employee ? employeeName(employee) : undefined}
      compact={Boolean(employeeId)}
    />
  )
}
