import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { AttendanceDeviceDetailView } from "@/components/dashboard/attendance-device-detail-view"

export default async function AttendanceDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <AdminDashboardView>
      <AttendanceDeviceDetailView deviceId={id} />
    </AdminDashboardView>
  )
}
