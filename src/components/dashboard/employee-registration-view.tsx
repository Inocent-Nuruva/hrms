"use client"

import * as React from "react"

import { EmployeeImportView } from "@/components/dashboard/employee-import-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"
import { EmployeeSetupView } from "@/components/dashboard/employee-setup-view"
import { cn } from "@/lib/utils"

type RegistrationTab = "manual" | "import" | "setup"

export function EmployeeRegistrationView() {
  const [activeTab, setActiveTab] = React.useState<RegistrationTab>("manual")

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="tab-rail-scroll">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {([
            { id: "manual", label: "Manual Registration" },
            { id: "import", label: "Bulk Import" },
            { id: "setup", label: "Setup" },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 border-b-2 px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                  isActive
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-w-0">
        {activeTab === "manual" ? (
          <EmployeeRegisterForm />
        ) : activeTab === "import" ? (
          <EmployeeImportView />
        ) : (
          <EmployeeSetupView />
        )}
      </div>
    </div>
  )
}
