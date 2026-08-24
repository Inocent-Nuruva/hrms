"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  CompactStatStrip,
  CycleRail,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  formatDate,
  heroGhostButtonClass,
  pageBleedClass,
  prettify,
  readString,
  rowId,
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
  const [mounted, setMounted] = React.useState(false)
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
    setMounted(true)
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

  const doneTasks = requestTasks.filter(isDone).length
  const doneClearances = requestClearances.filter(isDone).length

  return (
    <section className="w-full min-w-0 space-y-4">
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
            <Link href="/dashboard/me/requests/resignation" className={heroGhostButtonClass}>
              Resignation
            </Link>
            <button
              type="button"
              className={heroGhostButtonClass}
              onClick={() => void load()}
              disabled={mounted ? loading : undefined}
            >
              {mounted && loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {requests.length > 1 ? (
        <div className="flex w-full min-w-0 flex-wrap gap-1 border-b border-border/80 pb-px">
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
        <motion.div key={rowId(selected) || "empty"} className="w-full min-w-0 space-y-4" {...motionProps} transition={{ duration: 0.22 }}>
          {selected ? (
            <>
              <CompactStatStrip
                items={[
                  { label: "Status", value: loading ? "…" : prettify(statusOf(selected)) },
                  { label: "Tasks", value: loading ? "…" : `${doneTasks}/${requestTasks.length}` },
                  { label: "Clearances", value: loading ? "…" : `${doneClearances}/${requestClearances.length}` },
                ]}
              />
              <CycleRail steps={STEPS} current={statusOf(selected)} />
              <ItemList
                title="Assigned tasks"
                empty="No exit tasks are assigned to you."
                rows={requestTasks}
                busy={busy}
                prefix="task"
                onComplete={completeTask}
                subtitle={`Last working day ${formatDate(selected.last_working_date ?? selected.lastWorkingDate ?? selected.exit_date ?? selected.exitDate)}`}
                status={statusOf(selected)}
              />
              <ItemList
                title="Clearances"
                empty="No clearances are waiting on you."
                rows={requestClearances}
                busy={busy}
                prefix="clearance"
                onComplete={completeClearance}
              />
            </>
          ) : loading ? (
            <div className={cn("flex items-center justify-center gap-2 border-y border-border bg-card px-4 py-10 text-sm text-muted-foreground sm:border-x", pageBleedClass)}>
              <Loader2Icon className="size-4 animate-spin" />
              Loading your offboarding...
            </div>
          ) : (
            <div className={cn("px-4 py-10 text-center text-sm text-muted-foreground border-y border-border bg-card sm:border-x", pageBleedClass)}>
              You do not have an active offboarding request. Use Resignation if you want to start an exit.
            </div>
          )}
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
  subtitle,
  status,
}: {
  title: string
  empty: string
  rows: AdminRecord[]
  busy: string
  prefix: string
  onComplete: (row: AdminRecord) => void
  subtitle?: string
  status?: string
}) {
  return (
    <div className={cn("overflow-hidden border-y border-border bg-card sm:border-x", pageBleedClass)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {status ? <StatusChip value={status} /> : (
          <p className="text-xs text-muted-foreground">
            {rows.filter(isDone).length}/{rows.length}
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border/70">
          {rows.map((row) => {
            const id = rowId(row)
            const done = isDone(row)
            return (
              <li key={id || readString(row, ["title", "name"])} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {readString(row, ["title", "name", "department_name", "owner_name"], `${title} #${id}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">{prettify(readString(row, ["status"], "pending"))}</p>
                  </div>
                </div>
                {!done ? (
                  <button
                    type="button"
                    className={actionButtonClass}
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
