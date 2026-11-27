"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components"

import { PageShell } from "@/components/dashboard/page-shell"
import { RecruitmentPipelineView } from "@/components/dashboard/recruitment-pipeline-view"
import { useTheme } from "@/components/theme-provider"

/**
 * Recruitment is the hiring pipeline only. Invite, Registration, Contracts
 * and Letters each have one home under Employees; links to the old
 * Recruitment tabs (`?tab=invite` …) are sent there.
 */
const MOVED_TABS: Record<string, string> = {
  invite: "/dashboard/employees/invite",
  registration: "/dashboard/employees/registration",
  contracts: "/dashboard/employees/contracts",
  letters: "/dashboard/employees/letters",
}

export function RecruitmentView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const movedTo = MOVED_TABS[searchParams?.get("tab") ?? ""]
  const fluentTheme = React.useMemo(
    () => ({
      ...(resolvedTheme === "dark" ? webDarkTheme : webLightTheme),
      fontFamilyBase: "var(--font-comfortaa), Comfortaa, sans-serif",
    }),
    [resolvedTheme],
  )

  React.useEffect(() => {
    if (movedTo) router.replace(movedTo)
  }, [movedTo, router])

  if (movedTo) return null

  return (
    <FluentProvider theme={fluentTheme}>
      <PageShell>
        {/* The pipeline supplies the page header (with its actions) and body. */}
        <RecruitmentPipelineView />
      </PageShell>
    </FluentProvider>
  )
}
