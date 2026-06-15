import { redirect } from "next/navigation"

export default function AccessControlIndexPage() {
  redirect("/dashboard/roles")
}
