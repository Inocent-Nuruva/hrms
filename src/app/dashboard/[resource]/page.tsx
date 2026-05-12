import { redirect } from "next/navigation"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import type { AdminResourceKey } from "@/lib/admin-api"

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

  return <AdminDashboardView activeResource={normalized as AdminResourceKey} useApis />
}
