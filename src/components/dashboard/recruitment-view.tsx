"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import { EmployeeRegistrationView } from "@/components/dashboard/employee-registration-view"
import { cn } from "@/lib/utils"

type RecruitmentTab = "invite" | "registration"

const DEFAULT_TAB: RecruitmentTab = "invite"

function resolveRecruitmentTab(value: string | null): RecruitmentTab {
  return value === "registration" ? "registration" : DEFAULT_TAB
}

export function RecruitmentView() {
  const pathname = usePathname() ?? "/dashboard/operations/recruitment"
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = resolveRecruitmentTab(searchParams?.get("tab") ?? null)

  const handleTabChange = React.useCallback(
    (nextTab: RecruitmentTab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")

      if (nextTab === DEFAULT_TAB) {
        params.delete("tab")
      } else {
        params.set("tab", nextTab)
      }

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="tab-rail-scroll">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {([
            { id: "invite", label: "Invite" },
            { id: "registration", label: "Registration" },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "shrink-0 border-b-2 px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                  isActive
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === "invite" ? (
        <EmployeeInviteView />
      ) : (
        <div className="min-w-0">
          <EmployeeRegistrationView />
        </div>
      )}
    </div>
  )
}
