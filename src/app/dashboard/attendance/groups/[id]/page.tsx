import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { AccessGroupDetailView } from "@/components/dashboard/access-group-detail-view"

interface GroupDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params

  return (
    <AdminDashboardView>
      <AccessGroupDetailView groupId={id} />
    </AdminDashboardView>
  )
}
