import { Suspense } from "react"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { DashboardShellSkeleton } from "@/components/ui/access-skeleton"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Suspense at the server layout boundary so any client child that uses
  // useSearchParams (or similar CSR hooks) can static-prerender cleanly.
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <AdminDashboardView>{children}</AdminDashboardView>
    </Suspense>
  )
}
