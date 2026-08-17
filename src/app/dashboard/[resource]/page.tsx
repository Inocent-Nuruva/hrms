import { redirect } from "next/navigation"

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
    redirect("/dashboard")
  }

  // Roles/permissions tables render in AdminDashboardView (DataTable).
  // Access Control tabs also live in that shell so they do not remount here.
  return null
}
