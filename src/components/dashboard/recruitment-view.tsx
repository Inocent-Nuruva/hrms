"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components"
import { FileSignatureIcon, MailIcon, ScrollTextIcon, UserPlusIcon, UsersRoundIcon } from "lucide-react"

import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import { EmployeeRegistrationView } from "@/components/dashboard/employee-registration-view"
import { RecruitmentPipelineView } from "@/components/dashboard/recruitment-pipeline-view"
import { EmploymentContractsView } from "@/components/dashboard/employment-contracts-view"
import { EmploymentLettersView } from "@/components/dashboard/employment-letters-view"
import { PageShell, PageShellBody, PageShellHeader, PageShellTabs } from "@/components/dashboard/page-shell"
import { useTheme } from "@/components/theme-provider"

type RecruitmentTab = "pipeline" | "invite" | "registration" | "contracts" | "letters"

const DEFAULT_TAB: RecruitmentTab = "pipeline"

const RECRUITMENT_TABS = [
  { id: "pipeline", label: "Pipeline", icon: UsersRoundIcon },
  { id: "invite", label: "Invite", icon: MailIcon },
  { id: "registration", label: "Registration", icon: UserPlusIcon },
  { id: "contracts", label: "Contracts", icon: FileSignatureIcon },
  { id: "letters", label: "Letters", icon: ScrollTextIcon },
] as const

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

  // Invite and Registration bring their own content layout; the rest get padding.
  const flushTab = activeTab === "invite" || activeTab === "registration"

  return (
    <FluentProvider theme={fluentTheme}>
      <PageShell>
        <PageShellHeader
          withTabs
          title="Recruitment"
          description="Track candidates, invite or register new hires, and prepare their contracts and letters."
        />
        <PageShellTabs
          tabs={RECRUITMENT_TABS}
          active={activeTab}
          onChange={handleTabChange}
          ariaLabel="Recruitment sections"
          idPrefix="recruitment"
        />
        <PageShellBody idPrefix="recruitment" tabId={activeTab} flush={flushTab}>
          {activeTab === "pipeline" ? (
            <RecruitmentPipelineView />
          ) : activeTab === "invite" ? (
            <EmployeeInviteView embedded />
          ) : activeTab === "contracts" ? (
            <EmploymentContractsView />
          ) : activeTab === "letters" ? (
            <EmploymentLettersView />
          ) : (
            <EmployeeRegistrationView embedded />
          )}
        </PageShellBody>
      </PageShell>
    </FluentProvider>
  )
}
