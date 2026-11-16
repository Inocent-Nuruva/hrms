"use client"

import * as React from "react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

import { EmployeeImportView } from "@/components/dashboard/employee-import-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"

type RegistrationTab = "manual" | "import"

export function EmployeeRegistrationView() {
  const [activeTab, setActiveTab] = React.useState<RegistrationTab>("manual")

  return (
    <section className="min-w-0 overflow-hidden border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3">
        <PageHeader
          title="Add employees"
          description="Register one employee or validate and import an Excel employee list"
        />
        <div
          role="tablist"
          aria-label="Employee registration mode"
          className="inline-flex self-start rounded-lg border border-border bg-muted/40 p-0.5"
        >
          {([
            { id: "manual", label: "Manual registration" },
            { id: "import", label: "Bulk import" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 p-2.5 sm:p-3">
        {activeTab === "manual" ? <EmployeeRegisterForm /> : <EmployeeImportView />}
      </div>
    </section>
  )
}
