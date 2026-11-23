import { redirect } from "next/navigation"

interface LegacyAttendancePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function appendSearchParams(path: string, values: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry))
    } else if (value) {
      query.set(key, value)
    }
  })
  const encoded = query.toString()
  return encoded ? `${path}?${encoded}` : path
}

export default async function LegacyAttendancePage({ searchParams }: LegacyAttendancePageProps) {
  redirect(appendSearchParams("/dashboard/attendance/attendance-history", (await searchParams) ?? {}))
}
