import { redirect } from "next/navigation"

import { AccessControlManagementClient } from "@/components/dashboard/access-control-management-client"
import { AttendanceManagementClient } from "@/components/dashboard/attendance-management-client"

interface AccessControlViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function AccessControlViewPage({
  params,
}: AccessControlViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()

  const redirectMap: Record<string, string> = {
    roles: "/dashboard/roles",
    permissions: "/dashboard/permissions",
  }

  if (redirectMap[normalized]) {
    redirect(redirectMap[normalized])
  }

  if (normalized === "devices") {
    return <AttendanceManagementClient section="devices" />
  }

  if (!["doors", "templates", "organizations", "groups"].includes(normalized)) {
    redirect("/dashboard/access-control")
  }

  return <AccessControlManagementClient section={normalized} moduleTitle="Access Control" />
}
