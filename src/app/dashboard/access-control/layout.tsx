export default function AccessControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Access Control section tabs live in AdminDashboardView so they stay mounted
  // when navigating to /dashboard/roles or /dashboard/permissions (outside this tree).
  return <div className="min-w-0">{children}</div>
}
