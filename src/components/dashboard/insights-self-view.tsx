"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"

import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  MetricTile,
  TalentDoodleSprites,
  optionLabel,
  prettify,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals"
import { getHrDashboard, type AdminRecord } from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function metricEntries(record: AdminRecord | null) {
  if (!record) return []
  const entries: Array<{ label: string; value: string | number }> = []
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      entries.push({ label: prettify(key), value })
    } else if (typeof value === "string" && value.trim() && value.length < 40) {
      entries.push({ label: prettify(key), value })
    }
  }
  return entries.slice(0, 8)
}

export function InsightsSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setDashboard(await getHrDashboard(token, "employee"))
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        setLoading(false)
        return
      }
      setDashboard(null)
      setError(errorObject instanceof Error ? errorObject.message : "Could not load your dashboard.")
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden])

  React.useEffect(() => {
    void load()
  }, [load])

  const metrics = metricEntries(dashboard)

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My insights"
        title="My dashboard"
        description="Your employee dashboard from /api/dashboards/employee."
        actions={
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.length > 0 ? metrics.map((item) => (
          <MetricTile key={item.label} label={item.label} value={item.value} />
        )) : (
          <MetricTile label="Status" value={dashboard ? "Loaded" : "—"} />
        )}
      </div>
      {dashboard ? (
        <button type="button" className="text-sm font-semibold underline-offset-2 hover:underline" onClick={() => setDetail(dashboard)}>
          Open full dashboard
        </button>
      ) : null}
      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail) || "My dashboard"} row={detail} />
    </section>
  )
}
