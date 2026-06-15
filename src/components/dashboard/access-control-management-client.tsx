"use client"

import dynamic from "next/dynamic"

const AccessControlManagementView = dynamic(
  () =>
    import("@/components/dashboard/access-control-management-view").then(
      (module) => module.AccessControlManagementView
    ),
  { ssr: false }
)

export function AccessControlManagementClient({
  section,
  moduleTitle,
}: {
  section: string
  moduleTitle?: string
}) {
  return <AccessControlManagementView section={section} moduleTitle={moduleTitle} />
}
