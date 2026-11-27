"use client"

import { Building2Icon, FileSignatureIcon, LayoutTemplateIcon, PenLineIcon } from "lucide-react"
import { PageShell, PageShellBody, PageShellHeader, PageShellTabs } from "@/components/dashboard/page-shell"
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

const TABS = [
  { id: "contracts", label: "Contracts", icon: FileSignatureIcon },
  { id: "templates", label: "Templates", icon: LayoutTemplateIcon },
  { id: "signing", label: "Signatories and signing", icon: PenLineIcon },
  { id: "company", label: "Company details", icon: Building2Icon },
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
  const requestedTab = searchParams?.get("tab") ?? "contracts"
  const tab = (TABS.some((item) => item.id === requestedTab) ? requestedTab : "contracts") as (typeof TABS)[number]["id"]
  const employeeId = Number(searchParams?.get("employee_id")) || null

  return (
    <PageShell>
      <PageShellHeader
        withTabs
        title="Employment contracts"
        description="Prepare contracts from templates, collect company and employee signatures, and track renewals and expiry."
      />
      <PageShellTabs
        tabs={TABS}
        active={tab}
        onChange={(next) => router.replace(`${pathname}?tab=${next}`)}
        ariaLabel="Contracts sections"
        idPrefix="contracts"
      />
      <PageShellBody idPrefix="contracts" tabId={tab}>
        {tab === "contracts" ? <ContractsList token={token} canManage={canManage} employeeId={employeeId} /> : null}
        {tab === "templates" ? <ContractTemplatesEditor token={token} canEdit={canManage} /> : null}
        {tab === "signing" ? <SigningSettingsForm token={token} canEdit={canManageSignatories} /> : null}
        {tab === "company" ? <CompanyLegalForm token={token} canEdit={canEditCompany} /> : null}
      </PageShellBody>
    </PageShell>
  )
}

export function EmployeeContractsWorkspace() {
  return (
    <React.Suspense fallback={null}>
      <ContractsWorkspace />
    </React.Suspense>
  )
}
