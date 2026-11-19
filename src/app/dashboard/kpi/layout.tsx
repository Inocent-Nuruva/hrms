import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { managementKpiSectionTabGroups } from "@/lib/dashboard-sections";

export default function KpiManagementLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col">
    <DashboardSectionTabs groups={managementKpiSectionTabGroups} showGroupNavigation />
    <div className="min-w-0">{children}</div>
  </div>;
}
