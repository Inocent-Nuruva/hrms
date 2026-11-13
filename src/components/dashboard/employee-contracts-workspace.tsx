"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { ContractsList } from "@/components/dashboard/contracts/contracts-list"
import {
  CompanyLegalForm,
  ContractTemplatesEditor,
  SigningSettingsForm,
} from "@/components/dashboard/contracts/contract-settings"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { readAccessToken } from "@/lib/contracts-api"
import {
  canPerformPermission,
  EMPLOYMENT_CONTRACT_MANAGE_PERMISSION,
} from "@/lib/dashboard-permissions"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "contracts", label: "Contracts" },
  { value: "templates", label: "Templates" },
  { value: "signing", label: "Signatories & signing" },
  { value: "company", label: "Company details" },
] as const

function ContractsWorkspace() {
  const actor = useDashboardActor()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [token, setToken] = React.useState("")
  React.useEffect(() => setToken(readAccessToken()), [])
  if (!actor.ready || !token) return null

  const canManage = canPerformPermission(actor.permissionLabels, EMPLOYMENT_CONTRACT_MANAGE_PERMISSION)
  const canManageSignatories = canPerformPermission(actor.permissionLabels, "contract_signatories:manage")
  const canEditCompany = canManage || canPerformPermission(actor.permissionLabels, "companies:update")
  const tab = (searchParams?.get("tab") ?? "contracts") as (typeof TABS)[number]["value"]
  const employeeId = Number(searchParams?.get("employee_id")) || null

  return (
    <div className="grid gap-4">
      <PageHeader as="h2" title="Employment contracts" description="Prepare contracts from templates, collect company and employee signatures, and track renewals and expiry." />
      <div role="tablist" aria-label="Contracts sections" className="inline-flex max-w-full flex-wrap gap-0.5 self-start rounded-lg border border-border bg-muted/40 p-0.5">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => router.replace(`${pathname}?tab=${item.value}`)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "contracts" ? <ContractsList token={token} canManage={canManage} employeeId={employeeId} /> : null}
      {tab === "templates" ? <ContractTemplatesEditor token={token} canEdit={canManage} /> : null}
      {tab === "signing" ? <SigningSettingsForm token={token} canEdit={canManageSignatories} /> : null}
      {tab === "company" ? <CompanyLegalForm token={token} canEdit={canEditCompany} /> : null}
    </div>
  )
}

export function EmployeeContractsWorkspace() {
  return (
    <React.Suspense fallback={null}>
      <ContractsWorkspace />
    </React.Suspense>
  )
}
