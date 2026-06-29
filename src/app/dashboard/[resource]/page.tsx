import { redirect } from "next/navigation"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import type { AdminResourceKey } from "@/lib/admin-api"
import { accessControlSectionTabGroups } from "@/lib/dashboard-sections"

const ALLOWED_RESOURCES: AdminResourceKey[] = [
  "users",
  "roles",
  "permissions",
  "companies",
]

interface DashboardResourcePageProps {
  params: Promise<{
    resource: string
  }>
}

export default async function DashboardResourcePage({
  params,
}: DashboardResourcePageProps) {
  const { resource } = await params
  const normalized = resource?.toLowerCase()

  if (!ALLOWED_RESOURCES.includes(normalized as AdminResourceKey)) {
    redirect("/dashboard/users")
  }

  if (normalized === "roles" || normalized === "permissions") {
    return <DashboardSectionTabs groups={accessControlSectionTabGroups} />
  }

  return null
}
