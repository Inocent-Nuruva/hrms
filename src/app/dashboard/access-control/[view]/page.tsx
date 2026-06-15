import { redirect } from "next/navigation"

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
    doors: "/dashboard/attendance/doors",
    templates: "/dashboard/attendance/templates",
    organizations: "/dashboard/attendance/organizations",
    groups: "/dashboard/attendance/groups",
  }

  redirect(redirectMap[normalized] ?? "/dashboard/roles")
}
