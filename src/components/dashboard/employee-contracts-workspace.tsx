"use client"

import { EmploymentContractsView } from "@/components/dashboard/employment-contracts-view"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  canPerformPermission,
  EMPLOYMENT_CONTRACT_MANAGE_PERMISSION,
} from "@/lib/dashboard-permissions"

export function EmployeeContractsWorkspace() {
  const actor = useDashboardActor()
  if (!actor.ready) return null
  return (
    <EmploymentContractsView
      canManage={canPerformPermission(
        actor.permissionLabels,
        EMPLOYMENT_CONTRACT_MANAGE_PERMISSION,
      )}
    />
  )
}
