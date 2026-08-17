"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  CycleRail,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  asRecordArray,
  formatDate,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals"
import {
  completeOffboardingClearance,
  completeOffboardingTask,
  getOffboardingProgress,
  listMyOffboardingClearances,
  listMyOffboardingRequests,
  listMyOffboardingTasks,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"

const STEPS = ["DRAFT", "SUBMITTED", "IN_PROGRESS", "CLEARANCE", "FINALIZED"]

function token() {
  return readStoredSessionTokens().accessToken.trim()
}

function statusOf(row: AdminRecord | null) {
  return readString(row, ["status", "request_status", "state"], "DRAFT").toUpperCase()
}

function isDone(row: AdminRecord) {
  return /complete|done|cleared|closed/i.test(readString(row, ["status"]))
}

export function OffboardingSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden()
  const reduceMotion = useReducedMotion()
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [tasks, setTasks] = React.useState<AdminRecord[]>([])
  const [clearances, setClearances] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState("")

  const selected = requests.find((row) => rowId(row) === selectedId) ?? requests[0] ?? null

  const load = React.useCallback(async () => {
    const access = token()
    if (!access) {
      setError("Authentication required. Please sign in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [mine, myTasks, myClearances] = await Promise.all([
        listMyOffboardingRequests(access),
        listMyOffboardingTasks(access),
        listMyOffboardingClearances(access),
      ])
      setRequests(mine)
      const nextId = selectedId && mine.some((row) => rowId(row) === selectedId) ? selectedId : rowId(mine[0])
      setSelectedId(nextId)
      setTasks(myTasks)
      setClearances(myClearances)
      if (nextId) {
        try {
          await getOffboardingProgress(access, nextId)
        } catch {
          // Progress is optional for employees who only have the /me list.
        }
      }
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) return
      setError(errorObject instanceof Error ? errorObject.message : "Could not load your offboarding.")
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden, selectedId])

  React.useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const motionProps = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } }

  const requestTasks = tasks.filter((task) => {
    const parent = readString(task, ["request_id", "offboarding_request_id", "requestId"])
    return !parent || parent === rowId(selected)
  })
  const requestClearances = clearances.filter((item) => {
    const parent = readString(item, ["request_id", "offboarding_request_id", "requestId"])
    return !parent || parent === rowId(selected)
  })

  async function completeTask(row: AdminRecord) {
    const access = token()
    const requestId = rowId(selected) || readString(row, ["request_id", "offboarding_request_id"])
    const taskId = rowId(row)
    if (!access || !requestId || !taskId) return
    setBusy(`task-${taskId}`)
    try {
      await completeOffboardingTask(access, requestId, taskId, { completion_notes: "Completed by employee" })
      toast.success("Task completed.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not complete the task.")
    } finally {
      setBusy("")
    }
  }

  async function completeClearance(row: AdminRecord) {
    const access = token()
    const requestId = rowId(selected) || readString(row, ["request_id", "offboarding_request_id"])
    const clearanceId = rowId(row)
    if (!access || !requestId || !clearanceId) return
    setBusy(`clearance-${clearanceId}`)
    try {
      await completeOffboardingClearance(access, requestId, clearanceId, { remarks: "Cleared by employee" })
      toast.success("Clearance marked complete.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not complete the clearance.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="space-y-6">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My offboarding"
        title={selected ? readString(selected, ["title", "exit_type", "exitType"], "Your exit checklist") : "No exit in progress"}
        description={
          selected
            ? "Finish the tasks and clearances assigned to you. Resignation itself lives under My Requests."
            : "If you need to resign, start from My Requests. Assigned exit tasks will appear here."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/me/requests/resignation" className={primaryButtonClass}>
              Resignation
            </Link>
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
          </div>
        }
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {requests.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-border/80 pb-px">
          {requests.map((row) => {
            const id = rowId(row)
            const active = id === rowId(selected)
            return (
              <button
                key={id || readString(row, ["title"])}
                type="button"
                onClick={() => setSelectedId(id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {readString(row, ["title", "exit_type", "request_no"], `Exit #${id}`)}
              </button>
            )
          })}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div key={rowId(selected) || "empty"} className="space-y-6" {...motionProps} transition={{ duration: 0.22 }}>
          {!selected && !loading ? (
            <p className="text-sm text-muted-foreground">
              You do not have an active offboarding request. Use Resignation if you want to start an exit.
            </p>
          ) : null}

          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip value={statusOf(selected)} />
                <span className="text-xs text-muted-foreground">
                  Last working day {formatDate(selected.last_working_date ?? selected.lastWorkingDate ?? selected.exit_date ?? selected.exitDate)}
                </span>
              </div>

              <CycleRail steps={STEPS} current={statusOf(selected)} />

              <div className="grid gap-8 lg:grid-cols-2">
                <ItemList
                  title="Assigned tasks"
                  empty="No exit tasks are assigned to you."
                  rows={requestTasks}
                  busy={busy}
                  prefix="task"
                  onComplete={completeTask}
                />
                <ItemList
                  title="Clearances"
                  empty="No clearances are waiting on you."
                  rows={requestClearances}
                  busy={busy}
                  prefix="clearance"
                  onComplete={completeClearance}
                />
              </div>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

function ItemList({
  title,
  empty,
  rows,
  busy,
  prefix,
  onComplete,
}: {
  title: string
  empty: string
  rows: AdminRecord[]
  busy: string
  prefix: string
  onComplete: (row: AdminRecord) => void
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {rows.filter(isDone).length}/{rows.length}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/80">
          {rows.map((row) => {
            const id = rowId(row)
            const done = isDone(row)
            return (
              <li key={id || readString(row, ["title", "name"])} className="flex items-center gap-3 py-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {readString(row, ["title", "name", "department_name", "owner_name"], `${title} #${id}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">{prettify(readString(row, ["status"], "pending"))}</p>
                </div>
                {!done ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busy === `${prefix}-${id}`}
                    onClick={() => onComplete(row)}
                  >
                    {busy === `${prefix}-${id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : "Complete"}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
