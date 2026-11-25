import { Suspense } from "react"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { DashboardShellSkeleton } from "@/components/ui/access-skeleton"
import { getUiTheme } from "@/components/ui-theme/server"
import { UiThemeProvider } from "@/components/ui-theme/UiThemeProvider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The design choice (Theme 1 / Theme 2) lives in the ui-theme cookie. Both
  // themes go through AdminDashboardView so sign-in, route permission checks
  // and the forced password reset apply the same way; only the frame differs.
  const ui = await getUiTheme()

  // Suspense at the server layout boundary so any client child that uses
  // useSearchParams (or similar CSR hooks) can static-prerender cleanly.
  return (
    <UiThemeProvider initial={ui}>
      <Suspense fallback={<DashboardShellSkeleton />}>
        <AdminDashboardView>{children}</AdminDashboardView>
      </Suspense>
    </UiThemeProvider>
  )
}
