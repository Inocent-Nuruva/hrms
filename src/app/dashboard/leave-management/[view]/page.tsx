import { redirect } from "next/navigation";

import { AttendanceBusinessTripsView } from "@/components/dashboard/attendance-business-trips-view";
import { LeaveBalanceImportView } from "@/components/dashboard/leave-balance-import-view";
import { LeaveManagementView } from "@/components/dashboard/leave-management-view";
import { LeavePayrollIntegrationView } from "@/components/leave/leave-payroll-integration-view";
import { LeaveRolloverView } from "@/components/leave/leave-rollover-view";
import { LeaveStatutoryView } from "@/components/leave/leave-statutory-view";
import { LeaveOperationsView } from "@/components/leave/leave-operations-view";

const ALLOWED_VIEWS = new Set([
  "types",
  "requests",
  "team-calendar",
  "balances",
  "balance-import",
  "transactions",
  "reports",
  "business-trips",
  "holidays",
  "policies",
  "workflows",
  "rollover",
  "statutory",
  "payroll-integration",
  "operations",
]);

type LeaveView =
  | "types"
  | "requests"
  | "team-calendar"
  | "balances"
  | "transactions"
  | "reports"
  | "holidays"
  | "policies"
  | "workflows";

interface LeaveManagementViewPageProps {
  params: Promise<{
    view: string;
  }>;
}

export default async function LeaveManagementViewPage({
  params,
}: LeaveManagementViewPageProps) {
  const { view } = await params;
  const normalized = view?.toLowerCase();

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/leave-management");
  }

  if (normalized === "business-trips") {
    return <AttendanceBusinessTripsView />;
  }

  if (normalized === "balance-import") {
    return <LeaveBalanceImportView />;
  }

  if (normalized === "rollover") {
    return <LeaveRolloverView />;
  }

  if (normalized === "statutory") {
    return <LeaveStatutoryView />;
  }

  if (normalized === "operations") {
    return <LeaveOperationsView />;
  }

  if (normalized === "payroll-integration") {
    return <LeavePayrollIntegrationView />;
  }

  return (
    <LeaveManagementView
      activeTab={normalized as LeaveView}
      showTabButtons={false}
    />
  );
}
