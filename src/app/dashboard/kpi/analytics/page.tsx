import { KpiAnalyticsWorkspace } from "@/components/dashboard/kpi/kpi-analytics-workspace";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<p className="p-6">Loading analytics…</p>}>
      <KpiAnalyticsWorkspace />
    </Suspense>
  );
}
