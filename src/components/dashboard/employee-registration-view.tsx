"use client"

import * as React from "react"
import { FileSpreadsheetIcon, UserPlusIcon } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

import { EmployeeImportView } from "@/components/dashboard/employee-import-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"

type RegistrationTab = "manual" | "import"

const TABS = [
  { id: "manual", label: "Manual registration", icon: UserPlusIcon },
  { id: "import", label: "Bulk import", icon: FileSpreadsheetIcon },
] as const

/**
 * Add employees: one card holding the header, the manual/bulk switch and the
 * active form, with breathing room below the section menu (same layout as
 * the Invite employee page).
 */
export function EmployeeRegistrationView() {
  const [activeTab, setActiveTab] = React.useState<RegistrationTab>("manual")

  return (
    <div className="mx-auto w-full max-w-6xl pt-4 pb-6 sm:pt-6 lg:pb-10">
      <section className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
        <div className="px-4 pt-4 sm:px-6">
          <PageHeader
            className="min-w-0"
            title="Add employees"
            description="Register one employee or validate and import an Excel employee list."
          />
        </div>

        <div
          role="tablist"
          aria-label="Employee registration mode"
          className="mt-3 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:px-6"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                id={`registration-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`registration-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
                  event.preventDefault()
                  const index = TABS.findIndex((item) => item.id === tab.id)
                  const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]
                  setActiveTab(next.id)
                  document.getElementById(`registration-tab-${next.id}`)?.focus()
                }}
                className={cn(
                  "-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  selected
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <tab.icon className="size-4" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`registration-panel-${activeTab}`}
          aria-labelledby={`registration-tab-${activeTab}`}
          className={cn("min-w-0", activeTab === "import" && "px-4 py-5 sm:px-6 sm:py-6")}
        >
          {activeTab === "manual" ? <EmployeeRegisterForm /> : <EmployeeImportView />}
        </div>
      </section>
    </div>
  )
}
