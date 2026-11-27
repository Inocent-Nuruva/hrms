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
import { FormField } from "@/components/ui/form-field"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"

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
    if (!employee) {
      setError("Select a team member.")
      return
    }
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
        <FormField label="Team member" required>
          <FluentSelect
            ariaLabel="Team member"
            className="w-full"
            value={employee}
            onChange={(value) => setEmployee(value)}
            disabled={busy || !!previous}
            placeholder="Select a team member"
            options={[
              { value: "", label: "Select a team member" },
              ...choices.employees.map((x) => ({ value: String(x.id), label: x.name })),
            ]}
          />
        </FormField>
        <FormField label="Recommendation type">
          <FluentSelect
            ariaLabel="Recommendation type"
            className="w-full"
            value={kind}
            onChange={(value) => setKind(value as RecommendationKind)}
            disabled={busy || !!previous}
            options={Object.entries(kinds).map(([k, v]) => ({ value: k, label: v }))}
          />
        </FormField>
        {kind === "PROMOTION" && (
          <FormField label="Proposed position title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </FormField>
        )}
        {kind === "TRANSFER" && (
          <>
            <FormField label="Proposed branch">
              <FluentSelect
                ariaLabel="Proposed branch"
                className="w-full"
                value={branch}
                disabled={busy}
                placeholder="Select a branch"
                onChange={(v) => {
                  setBranch(v)
                  const d = choices.departments.find(
                    (x) => String(x.id) === department
                  )
                  if (v && d?.branch_id && String(d.branch_id) !== v)
                    setDepartment("")
                }}
                options={[
                  { value: "", label: "Select a branch" },
                  ...choices.branches.map((x) => ({ value: String(x.id), label: x.name })),
                ]}
              />
            </FormField>
            <FormField label="Proposed department">
              <FluentSelect
                ariaLabel="Proposed department"
                className="w-full"
                value={department}
                disabled={busy}
                placeholder="Select a department"
                onChange={(value) => setDepartment(value)}
                options={[
                  { value: "", label: "Select a department" },
                  ...availableDepartments.map((x) => ({ value: String(x.id), label: x.name })),
                ]}
              />
            </FormField>
          </>
        )}
        <FormField label="Proposed effective date (optional)">
          <DatePickerPresets value={date} onChange={(value) => setDate(value)} />
        </FormField>
        <FormField
          label="Rationale"
          htmlFor="recommendation-rationale"
          required
          className="sm:col-span-2"
        >
          <Textarea
            id="recommendation-rationale"
            formatting={false}
            rows={3}
            minLength={20}
            maxLength={3000}
            required
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
        </FormField>
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
      <FormField
        label="Feedback to the manager"
        htmlFor={`manager-feedback-${row.id}`}
      >
        <Textarea
          id={`manager-feedback-${row.id}`}
          formatting={false}
          rows={2}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </FormField>
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
