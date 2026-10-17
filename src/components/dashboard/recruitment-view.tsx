"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  FluentProvider,
  Tab,
  TabList,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components"

import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import { EmployeeRegistrationView } from "@/components/dashboard/employee-registration-view"
import { RecruitmentPipelineView } from "@/components/dashboard/recruitment-pipeline-view"
import { EmploymentContractsView } from "@/components/dashboard/employment-contracts-view"
import { EmploymentLettersView } from "@/components/dashboard/employment-letters-view"
import { useTheme } from "@/components/theme-provider"

type RecruitmentTab = "pipeline" | "invite" | "registration" | "contracts" | "letters"

const DEFAULT_TAB: RecruitmentTab = "pipeline"

function resolveRecruitmentTab(value: string | null): RecruitmentTab {
  if (value === "registration" || value === "invite" || value === "contracts" || value === "letters") return value
  return DEFAULT_TAB
}

export function RecruitmentView() {
  const pathname = usePathname() ?? "/dashboard/operations/recruitment"
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const activeTab = resolveRecruitmentTab(searchParams?.get("tab") ?? null)
  const fluentTheme = React.useMemo(
    () => ({
      ...(resolvedTheme === "dark" ? webDarkTheme : webLightTheme),
      fontFamilyBase: "var(--font-comfortaa), Comfortaa, sans-serif",
    }),
    [resolvedTheme],
  )

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
    <FluentProvider theme={fluentTheme}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="tab-rail-scroll">
          <TabList
            aria-label="Recruitment sections"
            selectedValue={activeTab}
            onTabSelect={(_event, data) => {
              if (typeof data.value === "string") {
                handleTabChange(data.value as RecruitmentTab)
              }
            }}
            className="min-w-full"
          >
            {([
              { id: "pipeline", label: "Pipeline" },
              { id: "invite", label: "Invite" },
              { id: "registration", label: "Registration" },
              { id: "contracts", label: "Contracts" },
              { id: "letters", label: "Letters" },
            ] as const).map((tab) => (
              <Tab key={tab.id} value={tab.id}>
                {tab.label}
              </Tab>
            ))}
          </TabList>
        </div>

        {activeTab === "pipeline" ? (
          <RecruitmentPipelineView />
        ) : activeTab === "invite" ? (
          <EmployeeInviteView />
        ) : activeTab === "contracts" ? (
          <EmploymentContractsView />
        ) : activeTab === "letters" ? (
          <EmploymentLettersView />
        ) : (
          <div className="min-w-0">
            <EmployeeRegistrationView />
          </div>
        )}
      </div>
    </FluentProvider>
  )
}
