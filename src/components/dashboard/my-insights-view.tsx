"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard"
import { adminRequest } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { Button } from "@/components/ui/button"

type Insights = {
  attendance: {
    from_date: string
    to_date: string
    total_days: number
    present_days: number
    absent_days: number
    half_days: number
    late_days: number
    leave_days: number
  }
  leave: {
    approved: number
    returned_for_correction: number
    pending_total: number
    draft: number
  }
}
function Metrics({ values }: { values: [string, number][] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="rounded-md bg-muted/60 p-3">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
export function MyInsightsView() {
  const actor = useDashboardActor()
  const allowed = actor.ready && actor.scope === "company"
  useForbiddenRouteGuard(allowed)
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    adminRequest<Insights>("/api/me/insights", {
      token: readStoredSessionTokens().accessToken,
      signal: controller.signal,
      cacheTtlMs: 0,
    })
      .then(setData)
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load your insights."
          )
      })
    return () => controller.abort()
  }, [allowed, attempt])
  if (!allowed) return null
  const a = data?.attendance,
    l = data?.leave
  return (
    <main className="space-y-5 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">My insights</h1>
      {error && (
        <div role="alert">
          {error}{" "}
          <Button
            variant="outline"
            onClick={() => {
              setError("")
              setAttempt((x) => x + 1)
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {!data && !error && <p role="status">Loading your insights…</p>}
      {a && l && (
        <>
          <section
            aria-labelledby="attendance-insights"
            className="rounded-lg border p-4"
          >
            <h2 id="attendance-insights" className="text-lg font-semibold">
              Attendance over the last 30 days
            </h2>
            <p className="text-sm text-muted-foreground">
              <time>{a.from_date}</time> to <time>{a.to_date}</time>
            </p>
            {a.total_days ? (
              <Metrics
                values={[
                  ["Recorded days", a.total_days],
                  ["Present", a.present_days],
                  ["Absent", a.absent_days],
                  ["Half days", a.half_days],
                  ["Days on leave", a.leave_days],
                  ["Days late", a.late_days],
                ]}
              />
            ) : (
              <p className="my-3">
                No attendance summaries were recorded for this period.
              </p>
            )}
            <Link
              href="/dashboard/attendance/attendance-history"
              className="mt-3 inline-block underline"
            >
              Attendance History
            </Link>
          </section>
          <section
            aria-labelledby="leave-insights"
            className="rounded-lg border p-4"
          >
            <h2 id="leave-insights" className="text-lg font-semibold">
              My leave requests
            </h2>
            <p className="text-sm text-muted-foreground">
              Request counts across all dates
            </p>
            <Metrics
              values={[
                ["Draft", l.draft],
                [
                  "Awaiting review",
                  l.pending_total - l.returned_for_correction,
                ],
                ["Returned for correction", l.returned_for_correction],
                ["Approved", l.approved],
              ]}
            />
            <Link
              href="/dashboard/me/leave/requests"
              className="mt-3 inline-block underline"
            >
              My leave requests
            </Link>
          </section>
        </>
      )}
    </main>
  )
}
