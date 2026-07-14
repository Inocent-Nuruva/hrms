import { redirect } from "next/navigation"

export default async function AttendanceDeviceDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/access-control/devices/${id}`)
}
