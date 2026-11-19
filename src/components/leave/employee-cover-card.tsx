"use client"

import * as React from "react"
import Link from "next/link"
import {
  getEmployeeActingOverview,
  type EmployeeActingOverview,
  type LeaveActingAssignment,
  type LeaveActingPerson,
} from "@/lib/admin-api"
import { ActingStatusBadge } from "@/components/leave/acting-employee-panel"

const profileHref = (p: LeaveActingPerson) =>
  `/dashboard/employees/profile/${encodeURIComponent(p.employee_no)}`

function PersonLink({ person }: { person: LeaveActingPerson | null }) {
  if (!person) return <span>-</span>
  return (
    <Link href={profileHref(person)} className="font-semibold text-primary underline-offset-2 hover:underline">
      {person.name}
    </Link>
  )
}

function Assignment({
  a,
  role,
}: {
  a: LeaveActingAssignment
  role: "covered" | "acting"
}) {
  const other = role === "covered" ? a.acting_employee : a.absent_employee
  return (
    <li className="space-y-1 rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{role === "covered" ? "Acting employee" : "Acting for"}</span>
        <PersonLink person={other} />
        <ActingStatusBadge status={a.status} />
      </div>
      <p className="text-xs text-muted-foreground">
        {[other?.employee_no, other?.position_name, other?.department_name].filter(Boolean).join(" · ")}
      </p>
      <p className="text-xs">
        {a.start_date.slice(0, 10)} – {a.end_date.slice(0, 10)}
        {a.appointed_by ? ` · appointed by ${a.appointed_by.name}` : ""}
      </p>
      {a.responsibilities ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{a.responsibilities}</p>
      ) : null}
    </li>
  )
}

/**
 * Profile card: current leave and who covers it, and any acting duties this
 * employee holds. Reads the central acting-assignment records (never edited
 * here; changes happen on the leave request).
 */
export function EmployeeCoverCard({ token, employeeId }: { token: string | null; employeeId: number | null }) {
  const [data, setData] = React.useState<EmployeeActingOverview | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token || !employeeId) return
    let alive = true
    getEmployeeActingOverview(token, employeeId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load leave cover."))
    return () => {
      alive = false
    }
  }, [employeeId, token])

  if (error) return <p className="mt-3 text-xs text-muted-foreground" role="status">{error}</p>
  if (!data) return null
  const covered = data.covered_by.filter((a) => a.leave_request_id !== data.current_leave?.leave_request_id)
  if (!data.current_leave && !data.acting_for.length && !covered.length) return null

  return (
    <section aria-label="Availability and leave cover" className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      {data.current_leave ? (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-semibold">On {data.current_leave.leave_type_name ?? "leave"}</span>{" "}
            <span className="text-muted-foreground">
              {data.current_leave.start_date.slice(0, 10)} – {data.current_leave.end_date.slice(0, 10)} ·{" "}
              {data.current_leave.leave_no}
            </span>
          </p>
          {data.current_leave.acting_assignment ? (
            <ul><Assignment a={data.current_leave.acting_assignment} role="covered" /></ul>
          ) : (
            <p className="text-xs text-muted-foreground">No acting employee assigned.</p>
          )}
        </div>
      ) : null}
      {covered.length ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming leave cover</h3>
          <ul className="space-y-1.5">{covered.map((a) => <Assignment key={a.id} a={a} role="covered" />)}</ul>
        </div>
      ) : null}
      {data.acting_for.length ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acting assignments</h3>
          <ul className="space-y-1.5">{data.acting_for.map((a) => <Assignment key={a.id} a={a} role="acting" />)}</ul>
        </div>
      ) : null}
    </section>
  )
}
