"use client"

import * as React from "react"

import { EmployeeImportView } from "@/components/dashboard/employee-import-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"
import { cn } from "@/lib/utils"

type RegistrationTab = "manual" | "import"

export function EmployeeRegistrationView() {
  const [activeTab, setActiveTab] = React.useState<RegistrationTab>("manual")

  return (
    <section className="min-w-0 overflow-hidden border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-1 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
            Add employees
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Register one employee or validate and import an Excel employee list
          </p>
        </div>
        <p className="text-[10px] font-medium text-muted-foreground">
          {activeTab === "manual" ? "Single employee" : "Excel import"}
        </p>
      </div>

      <div className="tab-rail-scroll bg-muted/[0.12] px-3">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {([
            { id: "manual", label: "Manual Registration" },
            { id: "import", label: "Bulk Import" },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
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

      <div className="min-w-0 p-2.5 sm:p-3">
        {activeTab === "manual" ? <EmployeeRegisterForm /> : <EmployeeImportView />}
      </div>
    </section>
  )
}
