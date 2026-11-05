"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { downloadLeaveReport } from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"

type ReportType = "balances" | "taken" | "pending" | "by-department"

const REPORTS: Array<{ type: ReportType; title: string; description: string }> = [
  { type: "balances", title: "Leave balances", description: "Entitlement, accrued, carried forward, used, pending and available days per employee." },
  { type: "taken", title: "Leave taken", description: "Approved leave overlapping the period, with days and approval date." },
  { type: "pending", title: "Pending approvals", description: "Requests still waiting, their stage and how long they have waited." },
  { type: "by-department", title: "Leave by department", description: "Approved days, approved and pending requests per department and leave type." },
]

/** Server-built leave reports, downloaded as Excel or CSV. */
export function LeaveReportDownloads({ token }: { token: string | null }) {
  const year = String(new Date().getFullYear())
  const [filters, setFilters] = React.useState({ fiscal_year: year, from_date: "", to_date: "" })
  const [busy, setBusy] = React.useState<string | null>(null)

  const download = async (type: ReportType, format: "xlsx" | "csv") => {
    if (!token) return
    setBusy(`${type}:${format}`)
    try {
      const { blob, filename } = await downloadLeaveReport(token, type, format, filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showErrorAlert(error instanceof Error ? error.message : "Could not download the report.")
    } finally {
      setBusy(null)
    }
  }

  const inputClass = "h-8 rounded-md border border-border bg-background px-2 text-sm"
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Leave reports</h3>
          <p className="text-xs text-muted-foreground">Built on the server from live data and limited to the employees you can see.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="grid gap-1">
            <span>Leave year</span>
            <input className={`${inputClass} w-20`} inputMode="numeric" value={filters.fiscal_year} onChange={(event) => setFilters({ ...filters, fiscal_year: event.target.value })} />
          </label>
          <label className="grid gap-1">
            <span>From</span>
            <input type="date" className={inputClass} value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
          </label>
          <label className="grid gap-1">
            <span>To</span>
            <input type="date" className={inputClass} value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
          </label>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <li key={report.type} className="flex flex-col justify-between gap-2 rounded-md border border-border/70 p-3">
            <div>
              <p className="text-sm font-medium">{report.title}</p>
              <p className="text-xs text-muted-foreground">{report.description}</p>
            </div>
            <div className="flex gap-2">
              <Button appearance="primary" size="small" disabled={busy !== null} onClick={() => void download(report.type, "xlsx")}>
                {busy === `${report.type}:xlsx` ? "Preparing…" : "Excel"}
              </Button>
              <Button appearance="secondary" size="small" disabled={busy !== null} onClick={() => void download(report.type, "csv")}>
                {busy === `${report.type}:csv` ? "Preparing…" : "CSV"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
