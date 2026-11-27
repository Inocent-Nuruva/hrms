"use client"

import * as React from "react"
import { FileSpreadsheetIcon, UserPlusIcon } from "lucide-react"

import { EmployeeImportView } from "@/components/dashboard/employee-import-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"
import { PageShell, PageShellBody, PageShellHeader, PageShellTabs } from "@/components/dashboard/page-shell"

type RegistrationTab = "manual" | "import"

const TABS = [
  { id: "manual", label: "Manual registration", icon: UserPlusIcon },
  { id: "import", label: "Bulk import", icon: FileSpreadsheetIcon },
] as const

/**
 * Add employees: the shared page shell with Manual / Bulk import tabs.
 */
export function EmployeeRegistrationView() {
  const [activeTab, setActiveTab] = React.useState<RegistrationTab>("manual")

  return (
    <PageShell>
        <PageShellHeader
          withTabs
          title="Add employees"
          description="Register one employee or validate and import an Excel employee list."
        />
      <PageShellTabs
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Employee registration mode"
        idPrefix="registration"
      />
      <PageShellBody idPrefix="registration" tabId={activeTab} flush={activeTab === "manual"}>
        {activeTab === "manual" ? <EmployeeRegisterForm /> : <EmployeeImportView />}
      </PageShellBody>
    </PageShell>
  )
}
