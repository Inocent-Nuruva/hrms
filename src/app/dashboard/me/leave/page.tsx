import { redirect } from "next/navigation"

export default function DashboardSelfLeavePage() {
  redirect("/dashboard/me/leave/requests")
}
