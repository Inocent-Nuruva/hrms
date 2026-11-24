"use client"

import Link from "next/link"
import { toDoQueues } from "@/lib/dashboard-sections"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard"

export default function ToDoPage() {
  const actor = useDashboardActor()
  const allowed = actor.ready && actor.scope === "company"
  useForbiddenRouteGuard(allowed)
  if (!allowed) return null
  const queues = toDoQueues.filter((item) =>
    canSeeDashboardPage(item.url, actor.permissionLabels, actor.accessMode, {
      scope: actor.scope,
      roleNames: actor.roleNames,
    })
  )
  return (
    <main className="space-y-5 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">To do</h1>
      <nav aria-label="To do queues" className="grid gap-3 sm:grid-cols-2">
        {queues.map((q) => (
          <Link
            key={q.url}
            href={q.url}
            className="rounded-lg border p-4 font-medium hover:bg-muted focus-visible:ring-2"
          >
            {q.title}
          </Link>
        ))}
      </nav>
      {!queues.length && <p>No queues are available for your account.</p>}
    </main>
  )
}
