"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  CycleRail,
  DetailField,
  HeroBand,
  MetricTile,
  ScoreRing,
  StatusChip,
  TalentDoodleSprites,
  TimelineRail,
  asRecord,
  asRecordArray,
  formatDate,
  heroActionButtonClass,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import { probationCriteriaFromCase, resolveMyProbationCase } from "@/components/dashboard/probation-case"
import {
  getMyProbation,
  submitMyProbationSelfAssessment,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function ProbationSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [record, setRecord] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [comment, setComment] = React.useState("")
  const [ratings, setRatings] = React.useState<Array<{ code: string; name: string; rating: string; comment: string }>>([])
  const [objectives, setObjectives] = React.useState<Array<{ id: string; title: string; percent: string; comment: string }>>([])
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    try {
      const payload = await getMyProbation(token, controller.signal)
      const caseRecord = resolveMyProbationCase(payload)
      setRecord(caseRecord)
      setRatings(
        probationCriteriaFromCase(caseRecord).map((item) => ({
          code: readString(item, ["code", "criterion_code", "criterionCode"]),
          name: readString(item, ["name", "title"], readString(item, ["code"])),
          rating: "",
          comment: "",
        })),
      )
      setObjectives(
        asRecordArray(caseRecord?.objectives).map((item) => ({
          id: rowId(item),
          title: readString(item, ["title", "name"], `Objective #${rowId(item)}`),
          percent: readString(item, ["employeeCompletionPercent", "employee_completion_percent"], ""),
          comment: readString(item, ["employeeProgressComment", "employee_progress_comment"]),
        })),
      )
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        window.clearTimeout(timeout)
        setLoading(false)
        return
      }
      setRecord(null)
      const aborted =
        (errorObject instanceof DOMException && errorObject.name === "AbortError") ||
        (errorObject instanceof Error && errorObject.name === "AbortError")
      setError(
        aborted
          ? "The probation service took too long to respond. Refresh to try again."
          : errorObject instanceof Error
            ? errorObject.message
            : "Could not load your probation.",
      )
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }, [leaveIfForbidden])

  React.useEffect(() => {
    void load()
  }, [load])

  const score = readNumber(record, [
    "managerScore",
    "manager_score",
    "minimumConfirmationScore",
    "minimum_confirmation_score",
  ])
  const caseId = rowId(record)

  async function onSubmit() {
    const token = readStoredToken()
    if (!token || !caseId) return
    if (!comment.trim()) {
      toast.error("Add an overall comment before submitting.")
      return
    }
    setSaving(true)
    try {
      await submitMyProbationSelfAssessment(token, caseId, {
        overall_comment: comment.trim(),
        ratings: ratings
          .filter((item) => item.code && item.rating)
          .map((item) => ({
            criterion_code: item.code,
            rating: Number(item.rating),
            comment: item.comment || undefined,
          })),
        objectives: objectives
          .filter((item) => item.id && item.percent)
          .map((item) => ({
            objective_id: Number(item.id),
            completion_percent: Number(item.percent),
            comment: item.comment || undefined,
          })),
      })
      toast.success("Self-assessment submitted.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not submit the assessment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My probation"
        title={record ? "Your confirmation path" : "No active probation"}
        description={
          record
            ? "See where you sit in the cycle, update objectives, and send your self-assessment."
            : "If HR opens a probation case for you, it will appear here with the review timeline."
        }
        actions={
          <button type="button" className={heroActionButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading your probation record...
        </div>
      ) : record ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-4">
              <ScoreRing value={score} label="Latest score" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Status"
                value={<StatusChip value={readString(record, ["status"], "OPEN")} />}
              />
              <MetricTile
                label="Due"
                value={formatDate(record.currentDueDate ?? record.current_due_date)}
                hint={`Cycle ${readString(record, ["currentCycleNumber", "current_cycle_number"], "1")}`}
              />
              <MetricTile
                label="Policy"
                value={
                  optionLabel(asRecord(record.policy)) === "—"
                    ? readString(record, ["policy_name", "policyName"], "—")
                    : optionLabel(asRecord(record.policy))
                }
              />
              <MetricTile
                label="Decision"
                value={prettify(readString(record, ["finalDecision", "final_decision"], "Pending"))}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Timeline</h2>
              <div className="mt-4">
                <TimelineRail
                  items={[
                    {
                      label: "Started",
                      value: formatDate(record.currentStartDate ?? record.current_start_date ?? record.originalStartDate),
                    },
                    {
                      label: "Self-assessment",
                      value: formatDate(asRecordArray(record.reviewCycles)[0]?.selfAssessmentSubmittedAt) === "—"
                        ? "Not submitted"
                        : formatDate(asRecordArray(record.reviewCycles)[0]?.selfAssessmentSubmittedAt),
                    },
                    {
                      label: "Due",
                      value: formatDate(record.currentDueDate ?? record.current_due_date),
                    },
                  ]}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Cycle</h2>
              <div className="mt-4">
                <CycleRail
                  steps={["OPEN", "IN_PROGRESS", "SELF_ASSESSED", "MANAGER_REVIEWED", "CONFIRMED"]}
                  current={readString(record, ["status"], "OPEN")}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailField label="Case" value={readString(record, ["caseNo", "case_no"], `Case #${caseId}`)} />
                <DetailField label="Extensions" value={readString(record, ["extensionCount", "extension_count"], "0")} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Self-assessment</h2>
                <p className="text-xs text-muted-foreground">
                  Rate each criterion, update objective progress, then send the assessment to your manager.
                </p>
              </div>
              <button type="button" className={primaryButtonClass} onClick={() => void onSubmit()} disabled={saving}>
                {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Submit assessment"}
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Overall comment</span>
                <textarea className={textareaClass} value={comment} onChange={(event) => setComment(event.target.value)} />
              </label>
              {ratings.map((item, index) => (
                <div key={`${item.code}-${index}`} className="grid gap-2 rounded-xl bg-muted/40 p-3 md:grid-cols-[minmax(0,1fr)_120px]">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <input
                      className={`${textareaClass} mt-2 min-h-16`}
                      value={item.comment}
                      placeholder="Comment"
                      onChange={(event) =>
                        setRatings((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, comment: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Rating</span>
                    <input
                      className={inputClass}
                      value={item.rating}
                      onChange={(event) =>
                        setRatings((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, rating: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
              {objectives.map((item, index) => (
                <div key={item.id || index} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[minmax(0,1fr)_120px]">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <input
                      className={`${textareaClass} mt-2 min-h-16`}
                      value={item.comment}
                      placeholder="Progress comment"
                      onChange={(event) =>
                        setObjectives((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, comment: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">% complete</span>
                    <input
                      className={inputClass}
                      value={item.percent}
                      onChange={(event) =>
                        setObjectives((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, percent: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : error ? null : (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          There is no probation case assigned to you right now.
        </div>
      )}
    </section>
  )
}
