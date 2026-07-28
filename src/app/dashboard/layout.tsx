import { Suspense } from "react"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Suspense at the server layout boundary so any client child that uses
  // useSearchParams (or similar CSR hooks) can static-prerender cleanly.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
          Loading dashboard…
        </div>
      }
    >
      <AdminDashboardView>{children}</AdminDashboardView>
    </Suspense>
  )
}
