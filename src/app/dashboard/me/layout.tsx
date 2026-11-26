import type { ReactNode } from "react";
import { PersonalKpiLayout } from "@/components/dashboard/kpi/personal-kpi-layout";

export default function MeLayout({ children }: { children: ReactNode }) {
  return <PersonalKpiLayout>{children}</PersonalKpiLayout>;
}
