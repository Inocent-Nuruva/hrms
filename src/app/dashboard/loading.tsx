/**
 * Keep route-level loading empty for post-login navigations.
 * Login already shows the workspace loader; a second skeleton here felt like a double load.
 * Soft in-app navigations still paint quickly via client components.
 */
export default function DashboardLoading() {
  return null
}
