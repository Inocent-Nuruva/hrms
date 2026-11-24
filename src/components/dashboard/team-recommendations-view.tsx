"use client"

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import {
  decideRecommendation,
  getReviewWorkspace,
  getTeamWorkspace,
  submitRecommendation,
  type Choices,
  type Destination,
  type Recommendation,
  type RecommendationKind,
  type ReviewDecision,
} from "@/lib/team-recommendations"

const kinds: Record<RecommendationKind, string> = {
  PROMOTION: "Promotion",
  TRANSFER: "Transfer",
  DISCIPLINARY: "Disciplinary",
}
const states: Record<Recommendation["status"], string> = {
  SUBMITTED: "Submitted",
  RETURNED: "Returned",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}
const selectClass =
  "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
function failure(e: unknown) {
  return e instanceof Error ? e.message : "The request could not be completed."
}

function SubmissionForm({
  choices,
  previous,
  onSaved,
  onCancel,
}: {
  choices: Choices
  previous: Recommendation | null
  onSaved: () => void
  onCancel: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (previous) heading.current?.focus()
  }, [previous])
  const [employee, setEmployee] = useState(
    previous ? String(previous.employee_id) : ""
  )
  const [kind, setKind] = useState<RecommendationKind>(
    previous?.recommendation_type ?? "PROMOTION"
  )
  const [title, setTitle] = useState(
    previous?.proposal.proposed_position_title ?? ""
  )
  const [department, setDepartment] = useState(
    String(previous?.proposal.proposed_department_id ?? "")
  )
  const [branch, setBranch] = useState(
    String(previous?.proposal.proposed_branch_id ?? "")
  )
  const [date, setDate] = useState(previous?.proposed_effective_date ?? "")
  const [rationale, setRationale] = useState(previous?.rationale ?? "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function send(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError("")
    if (rationale.trim().length < 20) {
      setError("Enter at least 20 characters of rationale.")
      return
    }
    const proposal: Destination = {}
    if (kind === "PROMOTION") proposal.proposed_position_title = title.trim()
    if (kind === "TRANSFER") {
      if (!branch && !department) {
        setError("Choose a proposed department or branch.")
        return
      }
      if (branch) proposal.proposed_branch_id = Number(branch)
      if (department) proposal.proposed_department_id = Number(department)
    }
    setBusy(true)
    try {
      await submitRecommendation(readStoredSessionTokens().accessToken, {
        employee_id: Number(employee),
        recommendation_type: kind,
        rationale: rationale.trim(),
        proposal,
        ...(date ? { proposed_effective_date: date } : {}),
        ...(previous ? { revises_id: previous.id } : {}),
      })
      onSaved()
    } catch (e) {
      setError(failure(e))
    } finally {
      setBusy(false)
    }
  }
  const availableDepartments = choices.departments.filter(
    (d) => !branch || d.branch_id == null || String(d.branch_id) === branch
  )
  return (
    <form onSubmit={send} className="space-y-4 rounded-lg border p-4">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">
        {previous
          ? `Revise recommendation #${previous.id}`
          : "New recommendation"}
      </h2>
      {previous?.feedback && <p>HR feedback · {previous.feedback}</p>}
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label>
          Team member
          <select
            className={selectClass}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            required
            disabled={!!previous}
          >
            <option value="">Select a team member</option>
            {choices.employees.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recommendation type
          <select
            className={selectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as RecommendationKind)}
            disabled={!!previous}
          >
            {Object.entries(kinds).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {kind === "PROMOTION" && (
          <label>
            Proposed position title
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </label>
        )}
        {kind === "TRANSFER" && (
          <>
            <label>
              Proposed branch
              <select
                className={selectClass}
                value={branch}
                onChange={(e) => {
                  const v = e.target.value
                  setBranch(v)
                  const d = choices.departments.find(
                    (x) => String(x.id) === department
                  )
                  if (v && d?.branch_id && String(d.branch_id) !== v)
                    setDepartment("")
                }}
              >
                <option value="">Select a branch</option>
                {choices.branches.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proposed department
              <select
                className={selectClass}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">Select a department</option>
                {availableDepartments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Proposed effective date (optional)
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="sm:col-span-2">
          <label htmlFor="recommendation-rationale">Rationale</label>
          <textarea
            id="recommendation-rationale"
            className={selectClass}
            rows={3}
            minLength={20}
            maxLength={3000}
            required
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {previous ? "Submit revision" : "Submit recommendation"}
        </Button>
        {previous && (
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel revision
          </Button>
        )}
      </div>
    </form>
  )
}

function ReviewForm({
  row,
  onSaved,
}: {
  row: Recommendation
  onSaved: () => void
}) {
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function decide(decision: ReviewDecision) {
    if (busy) return
    const value = comment.trim()
    if ((value || decision !== "APPROVE") && value.length < 5) {
      setError("Enter at least five characters of feedback for the manager.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await decideRecommendation(
        readStoredSessionTokens().accessToken,
        row.id,
        decision,
        value
      )
      onSaved()
    } catch (e) {
      setError(failure(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3 space-y-2">
      <div>
        <label htmlFor={`manager-feedback-${row.id}`}>
          Feedback to the manager
        </label>
        <textarea
          id={`manager-feedback-${row.id}`}
          className={selectClass}
          rows={2}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Feedback is required for Return and Reject.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void decide("APPROVE")} disabled={busy}>
          Approve
        </Button>
        <Button
          onClick={() => void decide("RETURN")}
          variant="outline"
          disabled={busy}
        >
          Return
        </Button>
        <Button
          onClick={() => void decide("REJECT")}
          variant="outline"
          disabled={busy}
        >
          Reject
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

function RecommendationCard({
  row,
  children,
}: {
  row: Recommendation
  children: ReactNode
}) {
  const target = [
    row.proposal.proposed_position_title,
    row.proposal.proposed_department_name,
    row.proposal.proposed_branch_name,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <article className="min-w-0 space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {kinds[row.recommendation_type]} · {row.employee ?? "Employee"} · #
          {row.id}
        </h3>
        <span>{states[row.status]}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Submitted {row.submitted_at.slice(0, 10)}
        {row.submitted_by && ` by ${row.submitted_by}`}
        {row.revises_id && ` · Revision of #${row.revises_id}`}
      </p>
      {target && <p>Proposed destination · {target}</p>}
      {row.proposed_effective_date && (
        <p>Proposed effective date · {row.proposed_effective_date}</p>
      )}
      <p className="whitespace-pre-wrap break-words">{row.rationale}</p>
      {row.feedback && (
        <p className="whitespace-pre-wrap break-words">
          HR feedback · {row.feedback}
        </p>
      )}
      {children}
    </article>
  )
}

export function TeamRecommendationsView({
  review = false,
}: {
  review?: boolean
}) {
  const actor = useDashboardActor()
  const route = review
    ? "/dashboard/to-do/recommendations"
    : "/dashboard/me/team/recommendations"
  const allowed =
    actor.ready &&
    actor.scope === "company" &&
    canAccessDashboardRoute(route, actor.permissionLabels, actor.accessMode)
  useForbiddenRouteGuard(allowed)
  const [rows, setRows] = useState<Recommendation[] | null>(null)
  const [choices, setChoices] = useState<Choices | null>(null)
  const [previous, setPrevious] = useState<Recommendation | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  useEffect(() => {
    if (!allowed) return
    let active = true
    const token = readStoredSessionTokens().accessToken
    const load = review
      ? getReviewWorkspace(token).then((rows) => ({ rows, choices: null }))
      : getTeamWorkspace(token)
    load
      .then((result) => {
        if (active) {
          setRows(result.rows)
          setChoices(result.choices)
        }
      })
      .catch((e) => {
        if (active) setError(failure(e))
      })
    return () => {
      active = false
    }
  }, [allowed, review, revision])
  function refresh(message = "") {
    setError("")
    setRows(null)
    setChoices(null)
    setNotice(message)
    setPrevious(null)
    setRevision((n) => n + 1)
  }
  if (!allowed) return null
  const revised = new Set(rows?.map((row) => row.revises_id))
  return (
    <main className="min-w-0 space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {review ? "Review recommendations" : "Team recommendations"}
        </h1>
        <Button variant="outline" onClick={() => refresh()}>
          Refresh
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">
        HR records a decision here. Changes to employment records go through the
        relevant HR workflow.
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {!error && !rows && <p role="status">Loading recommendations…</p>}
      {choices &&
        (choices.employees.length ? (
          <SubmissionForm
            key={previous?.id ?? "new"}
            choices={choices}
            previous={previous}
            onCancel={() => setPrevious(null)}
            onSaved={() => refresh("Recommendation submitted to HR.")}
          />
        ) : (
          <p>
            No active reporting employees are available for a recommendation.
          </p>
        ))}
      {rows && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {review ? "Awaiting HR review" : "My submissions"}
          </h2>
          {!rows.length && (
            <p>
              {review
                ? "No recommendations await your review."
                : "You have no recommendations for your current team."}
            </p>
          )}
          {rows.map((row) => (
            <RecommendationCard key={row.id} row={row}>
              {review ? (
                <ReviewForm
                  row={row}
                  onSaved={() => refresh("Decision recorded.")}
                />
              ) : (
                row.status === "RETURNED" &&
                !revised.has(row.id) &&
                choices?.employees.some((e) => e.id === row.employee_id) && (
                  <Button variant="outline" onClick={() => setPrevious(row)}>
                    Revise recommendation
                  </Button>
                )
              )}
            </RecommendationCard>
          ))}
        </section>
      )}
    </main>
  )
}
