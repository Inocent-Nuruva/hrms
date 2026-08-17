"use client"

import dynamic from "next/dynamic"

const AccessControlActivityView = dynamic(
  () =>
    import("@/components/dashboard/access-control-activity-view").then(
      (module) => module.AccessControlActivityView
    ),
  { ssr: false }
)

export function AccessControlActivityClient({
  section,
  moduleTitle,
}: {
  section: string
  moduleTitle?: string
}) {
  return <AccessControlActivityView section={section} moduleTitle={moduleTitle} />
}
