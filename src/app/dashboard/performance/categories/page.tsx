import { redirect } from "next/navigation";

export default function KpiCategoriesPage() {
  redirect("/dashboard/performance/setup?step=kpis&categories=1");
}
