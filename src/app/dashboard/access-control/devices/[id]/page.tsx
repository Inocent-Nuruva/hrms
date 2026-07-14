import { AttendanceDeviceDetailView } from "@/components/dashboard/attendance-device-detail-view"

export default async function AccessControlDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <AttendanceDeviceDetailView deviceId={id} />
}
