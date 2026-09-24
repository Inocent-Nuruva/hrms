import { redirect } from "next/navigation"

interface LegacyAttendanceCorrectionPageProps {
  params: Promise<{ id: string }>
}

export default async function LegacyAttendanceCorrectionPage({ params }: LegacyAttendanceCorrectionPageProps) {
  const { id } = await params
  const query = new URLSearchParams({ highlight: id })

  redirect(`/dashboard/attendance/corrections?${query.toString()}`)
}
