"use client"

import * as React from "react"

import { ContractsList } from "@/components/dashboard/contracts/contracts-list"
import type { AdminRecord } from "@/lib/admin-api"
import { readAccessToken } from "@/lib/contracts-api"

function employeeName(employee: AdminRecord) {
  const full = typeof employee.full_name === "string" ? employee.full_name : ""
  const parts = [employee.first_name, employee.last_name].filter((part) => typeof part === "string" && part).join(" ")
  return full || parts || `Employee #${String(employee.id)}`
}

/**
 * Contract list embedded in onboarding, recruitment and the employee
 * profile. With `employee` it shows that employee's contracts only.
 */
export function EmploymentContractsView({ employee, canManage = true }: { employee?: AdminRecord; canManage?: boolean } = {}) {
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  if (!token) return null
  const employeeId = employee ? Number(employee.id) || null : null
  return (
    <ContractsList
      token={token}
      canManage={canManage}
      employeeId={employeeId}
      employeeName={employee ? employeeName(employee) : undefined}
      compact={Boolean(employeeId)}
    />
  )
}
