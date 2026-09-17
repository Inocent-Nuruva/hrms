"use client"

import * as React from "react"
import { LoaderCircle } from "lucide-react"

import {
 Dialog,
 DialogDescription,
 DialogHeader,
 DialogPopup,
 DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
 addLeaveRequestDocument,
 downloadLeaveRequestDocument,
 downloadMyLeaveRequestPdf,
 fileToBase64UploadDto,
 getMyLeaveRequest,
 patchLeaveRequestMedicalDetail,
 resolveBackendMediaUrl,
 type AdminRecord,
} from "@/lib/admin-api"
import { isMedicalLeaveRequest } from "@/lib/leave-request-kind"
import { cn } from "@/lib/utils"

export type LeaveApprovalNode = {
 id: number | null
 level: number
 status: string
 companyUserId: number | null
 name: string
 email: string
 roleLabel: string
 photoUrl: string
 actedAt: string
 comments: string
 isCurrentLevel: boolean
}

export type LeaveWorkflowSummary = {
 requestStatus: string
 currentLevel: number
 approvals: LeaveApprovalNode[]
 levels: number[]
 pendingNames: string[]
 approvedCount: number
 rejectedCount: number
 pendingCount: number
 totalCount: number
 progressPercent: number
 waitingLabel: string
}

function asRecord(value: unknown): AdminRecord | null {
 return typeof value === "object" && value !== null && !Array.isArray(value)
 ? (value as AdminRecord)
 : null
}

function asRecordList(value: unknown): AdminRecord[] {
 if (!Array.isArray(value)) return []
 return value.filter((entry): entry is AdminRecord => !!entry && typeof entry === "object")
}

function readString(record: AdminRecord | null, keys: string[]) {
 if (!record) return ""
 for (const key of keys) {
 const value = record[key]
 if (typeof value === "string" && value.trim()) return value.trim()
 if (typeof value === "number" && Number.isFinite(value)) return String(value)
 }
 return ""
}

function readNumber(record: AdminRecord | null, keys: string[]) {
 if (!record) return null
 for (const key of keys) {
 const value = record[key]
 if (typeof value === "number" && Number.isFinite(value)) return value
 if (typeof value === "string" && value.trim()) {
 const parsed = Number(value)
 if (Number.isFinite(parsed)) return parsed
 }
 }
 return null
}

function personName(record: AdminRecord | null, fallback = "Approver") {
 if (!record) return fallback
 const full = readString(record, ["full_name", "fullName", "display_name", "displayName", "name"])
 if (full) return full
 const composed = [
 readString(record, ["first_name", "firstName"]),
 readString(record, ["last_name", "lastName"]),
 ]
 .filter(Boolean)
 .join(" ")
 .trim()
 if (composed) return composed

 // CompanyUser payloads nest identity under `user`.
 const nestedUser =
  asRecord(record.user) ?? asRecord(record.employee) ?? asRecord(record.profile)
 if (nestedUser && nestedUser !== record) {
  return personName(nestedUser, fallback)
 }

 return fallback
}

function normalizeStatus(value: string) {
 return value.trim().toLowerCase().replace(/[_-]+/g, " ")
}

function formatStatusLabel(value: string) {
 const cleaned = value.replace(/[_-]+/g, " ").trim()
 if (!cleaned) return "Pending"
 return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDateTime(value: string) {
 if (!value) return ""
 const date = new Date(value)
 if (Number.isNaN(date.getTime())) return value
 return date.toLocaleString(undefined, {
 day: "numeric",
 month: "short",
 year: "numeric",
 hour: "numeric",
 minute: "2-digit",
 })
}

function downloadBlob(blob: Blob, filename: string) {
 const url = URL.createObjectURL(blob)
 const link = document.createElement("a")
 link.href = url
 link.download = filename
 document.body.appendChild(link)
 link.click()
 link.remove()
 URL.revokeObjectURL(url)
}

function readDateInputValue(record: AdminRecord | null, key: string) {
 const value = readString(record, [key])
 if (!value) return ""
 return value.replace("T", " ").split(" ")[0] ?? ""
}

function createEmptyMedicalForm() {
 return {
  sickness_nature: "",
  doctor_name: "",
  doctor_phone: "",
  hospital_name: "",
  treatment_start_date: "",
  treatment_end_date: "",
  attachment_url: "",
 }
}

function statusTone(status: string): "good" | "bad" | "warn" | "neutral" {
 const normalized = normalizeStatus(status)
 if (["approved", "completed", "done"].includes(normalized)) return "good"
 if (["rejected", "cancelled", "canceled", "declined"].includes(normalized)) return "bad"
 if (
 normalized.includes("pending") ||
 normalized.includes("awaiting") ||
 normalized.includes("review") ||
 normalized.includes("submitted") ||
 normalized === "in progress" ||
 normalized === "open"
 ) {
 return "warn"
 }
 return "neutral"
}

function coerceApprovalsList(value: unknown): AdminRecord[] {
  const direct = asRecordList(value)
  if (direct.length > 0) {
    return direct
  }

  const record = asRecord(value)
  if (!record) {
    return []
  }

  for (const key of ["data", "items", "results", "rows", "records", "list", "approvals"] as const) {
    const nested = asRecordList(record[key])
    if (nested.length > 0) {
      return nested
    }
  }

  return []
}

/** Merge detail + list fallback so approvals/workflow survive thinner detail responses. */
function mergeLeaveWorkflowRows(
  detail: AdminRecord | null,
  fallback: AdminRecord | null
): AdminRecord | null {
  if (!detail && !fallback) {
    return null
  }
  if (!detail) {
    return fallback
  }
  if (!fallback) {
    return detail
  }

  const merged: AdminRecord = {
    ...fallback,
    ...detail,
  }

  const detailApprovals = extractApprovalsSource(detail)
  const fallbackApprovals = extractApprovalsSource(fallback)
  if (detailApprovals.length > 0) {
    merged.approvals = detailApprovals
  } else if (fallbackApprovals.length > 0) {
    merged.approvals = fallbackApprovals
  }

  if (merged.current_approval_level == null && fallback.current_approval_level != null) {
    merged.current_approval_level = fallback.current_approval_level
  }
  if (merged.currentApprovalLevel == null && fallback.currentApprovalLevel != null) {
    merged.currentApprovalLevel = fallback.currentApprovalLevel
  }
  if (merged.approval_cycle == null && fallback.approval_cycle != null) {
    merged.approval_cycle = fallback.approval_cycle
  }
  if (merged.workflow == null && fallback.workflow != null) {
    merged.workflow = fallback.workflow
  }

  return merged
}

function extractApprovalsSource(row: AdminRecord): AdminRecord[] {
  const keys = [
    "approvals",
    "approval_chain",
    "approvalChain",
    "approval_steps",
    "approvalSteps",
    "leave_request_approvals",
    "leaveRequestApprovals",
    "workflow_approvals",
    "workflowApprovals",
    "request_approvals",
    "requestApprovals",
    "pending_approvals",
    "pendingApprovals",
    "steps",
  ] as const

  for (const key of keys) {
    const list = coerceApprovalsList(row[key])
    if (list.length > 0) {
      return list
    }
  }

  const workflow = asRecord(row.workflow ?? row.approval_workflow ?? row.approvalWorkflow)
  if (workflow) {
    for (const key of ["approvals", "steps", "approval_steps", "approvalSteps"] as const) {
      const list = coerceApprovalsList(workflow[key])
      if (list.length > 0) {
        return list
      }
    }
  }

  const nestedRequest = asRecord(row.leave_request ?? row.leaveRequest ?? row.request)
  if (nestedRequest && nestedRequest !== row) {
    return extractApprovalsSource(nestedRequest)
  }

  return []
}

export function buildLeaveWorkflowSummary(row: AdminRecord | null): LeaveWorkflowSummary {
 if (!row) {
 return {
 requestStatus: "unknown",
 currentLevel: 0,
 approvals: [],
 levels: [],
 pendingNames: [],
 approvedCount: 0,
 rejectedCount: 0,
 pendingCount: 0,
 totalCount: 0,
 progressPercent: 0,
 waitingLabel: "No workflow data",
 }
 }

 const requestStatus = normalizeStatus(readString(row, ["status"]) || "pending")
 const currentLevel =
 readNumber(row, ["current_approval_level", "currentApprovalLevel", "current_level", "currentLevel"]) ??
 (["in review", "submitted", "pending", "pending department manager", "pending hr"].includes(
  requestStatus
 )
  ? 1
  : 0)

 const currentCycle =
  readNumber(row, ["approval_cycle", "approvalCycle"])

 let approvalsSource = extractApprovalsSource(row)
 if (currentCycle !== null && approvalsSource.length > 0) {
  const cycleFiltered = approvalsSource.filter((approval) => {
   const cycle = readNumber(approval, ["approval_cycle", "approvalCycle"])
   return cycle === null || cycle === currentCycle
  })
  if (cycleFiltered.length > 0) {
   approvalsSource = cycleFiltered
  }
 }

 const approvals = approvalsSource
 .map((approval) => {
 const workflowStep = asRecord(approval.workflow_step ?? approval.workflowStep)
 const approver =
 asRecord(approval.approver) ??
 asRecord(approval.user) ??
 asRecord(approval.company_user) ??
 asRecord(approval.companyUser) ??
 asRecord(approval.assigned_to) ??
 asRecord(approval.assignedTo) ??
 asRecord(workflowStep?.company_user) ??
 asRecord(workflowStep?.companyUser)
 const nestedApproverUser = asRecord(approver?.user)
 const level =
 readNumber(approval, ["approval_level", "approvalLevel", "level", "step", "step_order", "stepOrder"]) ??
 readNumber(workflowStep, ["approval_level", "approvalLevel", "level"]) ??
 0
 const status = normalizeStatus(readString(approval, ["status"]) || "pending") || "pending"
 const roleLabel =
 readString(approval, ["approver_type", "approverType", "role_name", "roleName", "title", "action_type", "actionType"]) ||
 readString(workflowStep, ["approver_type", "approverType", "action_type", "actionType"]) ||
 readString(asRecord(approval.role ?? workflowStep?.role), ["name", "display_name"]) ||
 readString(approver, ["role", "title", "job_title", "jobTitle"]) ||
 "Approver"
 const fallbackName =
  readString(approval, ["approver_name", "approverName", "name", "full_name", "fullName"]) || "Approver"

 const photoUrl =
  readString(approver, ["profile_photo_url", "photo_url", "avatar_url", "avatar", "image_url", "imageUrl"]) ||
  readString(nestedApproverUser, ["profile_photo_url", "photo_url", "avatar_url", "avatar", "image_url", "imageUrl"]) ||
  readString(approval, ["approver_photo_url", "approverPhotoUrl", "profile_photo_url", "photo_url", "avatar_url"]) ||
  ""

 return {
 id: readNumber(approval, ["id"]),
 level,
 status,
 companyUserId: readNumber(approval, [
 "approver_company_user_id",
 "approverCompanyUserId",
 "assigned_company_user_id",
 "assignedCompanyUserId",
 "company_user_id",
 "companyUserId",
 ]),
 name: personName(approver, fallbackName),
 email: (
  readString(approver, ["email"]) ||
  readString(nestedApproverUser, ["email"]) ||
  readString(approval, ["approver_email", "approverEmail", "email"])
 ).toLowerCase(),
 roleLabel,
 photoUrl,
 actedAt: readString(approval, ["acted_at", "actedAt", "updated_at", "updatedAt", "created_at", "createdAt"]),
 comments: readString(approval, ["comments", "comment", "notes", "reason"]),
 isCurrentLevel: currentLevel > 0 ? level === currentLevel : level === 1,
 } satisfies LeaveApprovalNode
 })
 .filter((entry) => entry.level > 0 || entry.name !== "Approver" || Boolean(entry.status))
 .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name))

 const levels = Array.from(new Set(approvals.map((item) => item.level))).sort((a, b) => a - b)
 const pendingAtCurrent = approvals.filter(
 (item) =>
 statusTone(item.status) === "warn" &&
 (currentLevel > 0 ? item.level === currentLevel : item.isCurrentLevel)
 )
 const pendingNames = pendingAtCurrent.map((item) => item.name).filter(Boolean)
 const approvedCount = approvals.filter((item) => statusTone(item.status) === "good").length
 const rejectedCount = approvals.filter((item) => statusTone(item.status) === "bad").length
 const pendingCount = approvals.filter((item) => statusTone(item.status) === "warn").length
 const totalCount = approvals.length
 const progressPercent =
 totalCount <= 0 ? 0 : Math.round((approvedCount / totalCount) * 100)

 let waitingLabel = "No active approver"
 if (["approved", "completed"].includes(requestStatus)) {
 waitingLabel = "Fully approved"
 } else if (["rejected", "cancelled", "canceled"].includes(requestStatus)) {
 waitingLabel = formatStatusLabel(requestStatus)
 } else if (pendingNames.length === 1) {
 waitingLabel = `Pending with ${pendingNames[0]}`
 } else if (pendingNames.length > 1) {
 waitingLabel = `Pending with ${pendingNames[0]} +${pendingNames.length - 1}`
 } else if (currentLevel > 0) {
 waitingLabel = `Waiting at level ${currentLevel}`
 }

 return {
 requestStatus,
 currentLevel,
 approvals,
 levels,
 pendingNames,
 approvedCount,
 rejectedCount,
 pendingCount,
 totalCount,
 progressPercent,
 waitingLabel,
 }
}


function StatusText({ status, className }: { status: string; className?: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        "font-medium",
        tone === "good" && "text-emerald-700 dark:text-emerald-300",
        tone === "bad" && "text-rose-700 dark:text-rose-300",
        tone === "warn" && "text-amber-800 dark:text-amber-300",
        tone === "neutral" && "text-muted-foreground",
        className
      )}
    >
      {formatStatusLabel(status)}
    </span>
  )
}

function nodeKey(item: LeaveApprovalNode) {
  return `${item.id ?? "x"}-${item.level}-${item.companyUserId ?? item.email ?? item.name}`
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?"
}

function ringColor(tone: ReturnType<typeof statusTone>, isCurrent: boolean) {
  if (tone === "good") return { stroke: "#10b981", fill: "rgba(16,185,129,0.12)", ring: "ring-emerald-500" }
  if (tone === "bad") return { stroke: "#f43f5e", fill: "rgba(244,63,94,0.12)", ring: "ring-rose-500" }
  if (tone === "warn" || isCurrent) return { stroke: "#f59e0b", fill: "rgba(245,158,11,0.14)", ring: "ring-amber-500" }
  return { stroke: "var(--border)", fill: "var(--card)", ring: "ring-border" }
}

type GraphPoint = { x: number; y: number }

type FlowLayout = {
  width: number
  height: number
  start: GraphPoint
  positions: Map<string, GraphPoint>
  rowYs: Map<number, number>
}

/**
 * Flowchart-style rows: start node on top, then each approval level as a horizontal
 * row of circular profile nodes (e.g. 3 users on level 1, next level below).
 */
function layoutApproverFlowchart(
  approvals: LeaveApprovalNode[],
  levels: number[],
  nodeSize: number,
  centerSize: number
): FlowLayout {
  const positions = new Map<string, GraphPoint>()
  const rowYs = new Map<number, number>()

  const leftPad = 36 // room for L1 / L2 labels
  const rightPad = 24
  const topPad = 16
  const bottomPad = 30
  // Horizontal gap between centers on the same level row.
  const colGap = nodeSize + 40
  // Vertical gap between level rows (room for labels under nodes).
  const rowGap = nodeSize + 56

  const maxCols = Math.max(
    1,
    ...levels.map((level) => approvals.filter((item) => item.level === level).length)
  )

  const contentWidth = Math.max(1, maxCols - 1) * colGap
  const width = Math.max(leftPad + rightPad + contentWidth + nodeSize, 280)
  const height =
    topPad + centerSize + rowGap * Math.max(levels.length, 1) + bottomPad

  // Center content in the drawable area (excluding left label column).
  const contentCenterX = leftPad + (width - leftPad - rightPad) / 2

  const start: GraphPoint = {
    x: contentCenterX,
    y: topPad + centerSize / 2,
  }

  if (approvals.length === 0) {
    return { width, height, start, positions, rowYs }
  }

  levels.forEach((level, levelIndex) => {
    const group = approvals.filter((item) => item.level === level)
    if (group.length === 0) return

    const n = group.length
    const y = start.y + (levelIndex + 1) * rowGap
    rowYs.set(level, y)

    const span = (n - 1) * colGap
    const rowStartX = contentCenterX - span / 2

    group.forEach((item, index) => {
      positions.set(nodeKey(item), {
        x: n === 1 ? contentCenterX : rowStartX + index * colGap,
        y,
      })
    })
  })

  return { width, height, start, positions, rowYs }
}

type FlowEdge = {
  key: string
  d: string
  active: boolean
}

/** Orthogonal flowchart connectors between start / rows / people. */
function buildFlowchartEdges(
  layout: FlowLayout,
  approvals: LeaveApprovalNode[],
  levels: number[],
  nodeSize: number,
  centerSize: number
): FlowEdge[] {
  const edges: FlowEdge[] = []
  const byLevel = new Map<number, LeaveApprovalNode[]>()
  for (const item of approvals) {
    const list = byLevel.get(item.level) ?? []
    list.push(item)
    byLevel.set(item.level, list)
  }

  const firstLevel = levels[0]
  if (firstLevel != null) {
    const firstNodes = byLevel.get(firstLevel) ?? []
    const yBus = (layout.start.y + centerSize / 2 + (layout.rowYs.get(firstLevel) ?? 0) - nodeSize / 2) / 2

    firstNodes.forEach((item) => {
      const pos = layout.positions.get(nodeKey(item))
      if (!pos) return
      const active =
        statusTone(item.status) === "good" ||
        (item.isCurrentLevel && statusTone(item.status) === "warn")
      // Start → bus → node
      edges.push({
        key: `start-${nodeKey(item)}`,
        active,
        d: `M ${layout.start.x} ${layout.start.y + centerSize / 2} V ${yBus} H ${pos.x} V ${pos.y - nodeSize / 2}`,
      })
    })
  }

  for (let i = 0; i < levels.length - 1; i++) {
    const fromLevel = levels[i]!
    const toLevel = levels[i + 1]!
    const fromNodes = byLevel.get(fromLevel) ?? []
    const toNodes = byLevel.get(toLevel) ?? []
    if (fromNodes.length === 0 || toNodes.length === 0) continue

    const fromY = layout.rowYs.get(fromLevel) ?? 0
    const toY = layout.rowYs.get(toLevel) ?? 0
    const yBus = (fromY + nodeSize / 2 + toY - nodeSize / 2) / 2

    // Drop from each previous node to the bus, then fan into next row.
    fromNodes.forEach((fromItem) => {
      const from = layout.positions.get(nodeKey(fromItem))
      if (!from) return
      const fromActive = statusTone(fromItem.status) === "good"
      edges.push({
        key: `drop-${nodeKey(fromItem)}`,
        active: fromActive,
        d: `M ${from.x} ${from.y + nodeSize / 2} V ${yBus}`,
      })
    })

    toNodes.forEach((toItem) => {
      const to = layout.positions.get(nodeKey(toItem))
      if (!to) return
      const active =
        statusTone(toItem.status) === "good" ||
        (toItem.isCurrentLevel && statusTone(toItem.status) === "warn")
      // Horizontal bus span handled by linking from leftmost drop; simple fan:
      const fromXs = fromNodes
        .map((n) => layout.positions.get(nodeKey(n))?.x)
        .filter((x): x is number => typeof x === "number")
      const busX =
        fromXs.length === 1
          ? fromXs[0]!
          : fromXs.reduce((a, b) => a + b, 0) / Math.max(fromXs.length, 1)

      edges.push({
        key: `fan-${nodeKey(toItem)}`,
        active,
        d: `M ${busX} ${yBus} H ${to.x} V ${to.y - nodeSize / 2}`,
      })
    })

    // Connect bus horizontally across from-node drops when multiple parents.
    if (fromNodes.length > 1) {
      const xs = fromNodes
        .map((n) => layout.positions.get(nodeKey(n))?.x)
        .filter((x): x is number => typeof x === "number")
        .sort((a, b) => a - b)
      if (xs.length >= 2) {
        const anyActive = fromNodes.some((n) => statusTone(n.status) === "good")
        edges.push({
          key: `bus-${fromLevel}-${toLevel}`,
          active: anyActive,
          d: `M ${xs[0]} ${yBus} H ${xs[xs.length - 1]}`,
        })
      }
    }
  }

  return edges
}

function ApproverDetailPopoverBody({ item }: { item: LeaveApprovalNode }) {
  const tone = statusTone(item.status)
  return (
    <div className="w-[min(18rem,calc(100vw-2rem))] space-y-3 p-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-popover",
            tone === "good"
              ? "ring-emerald-500"
              : tone === "bad"
                ? "ring-rose-500"
                : item.isCurrentLevel
                  ? "ring-amber-500"
                  : "ring-border"
          )}
        >
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
              {initialsFor(item.name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground break-words">
            {item.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Level {item.level}
            {item.roleLabel ? ` · ${item.roleLabel}` : ""}
          </p>
          <div className="mt-1">
            <StatusText status={item.status} className="text-xs font-semibold" />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-border/70 pt-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </p>
          <p className="break-all text-sm text-foreground">{item.email || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Acted at
          </p>
          <p className="text-sm text-foreground">
            {item.actedAt ? formatDateTime(item.actedAt) : "No action yet"}
          </p>
        </div>
        {item.comments ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Comments
            </p>
            <p className="text-sm leading-snug text-foreground break-words">{item.comments}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ApproverAvatarNode({
  item,
  open,
  onOpenChange,
  size = 64,
}: {
  item: LeaveApprovalNode
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: number
}) {
  const tone = statusTone(item.status)
  const colors = ringColor(tone, item.isCurrentLevel && tone === "warn")
  const pendingNow = item.isCurrentLevel && tone === "warn"

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          "relative outline-none transition-transform duration-200 ease-out",
          open ? "z-20 scale-110" : "hover:z-10 hover:scale-110 active:scale-105",
          pendingNow ? "animate-[pulse_2.4s_ease-in-out_infinite]" : null
        )}
        style={{ width: size, height: size }}
        aria-label={`${item.name}, ${formatStatusLabel(item.status)}`}
      >
        <span
          className={cn(
            "relative block rounded-full p-[2px] shadow-sm ring-2 ring-offset-1 ring-offset-background transition-shadow duration-200",
            colors.ring,
            open ? "shadow-md" : "hover:shadow-md"
          )}
          style={{
            width: size,
            height: size,
            background:
              tone === "good"
                ? "linear-gradient(145deg,#34d399,#059669)"
                : tone === "bad"
                  ? "linear-gradient(145deg,#fb7185,#e11d48)"
                  : pendingNow
                    ? "linear-gradient(145deg,#fbbf24,#d97706)"
                    : "linear-gradient(145deg,var(--border),var(--muted))",
          }}
        >
          <span className="flex h-full w-full overflow-hidden rounded-full bg-card">
            {item.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photoUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary/10 text-[10px] font-semibold text-primary">
                {initialsFor(item.name)}
              </span>
            )}
          </span>

          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full border-2 border-background text-[8px] font-bold text-white",
              tone === "good"
                ? "bg-emerald-500"
                : tone === "bad"
                  ? "bg-rose-500"
                  : pendingNow
                    ? "bg-amber-500"
                    : "bg-slate-400"
            )}
            aria-hidden
          >
            {tone === "good" ? "✓" : tone === "bad" ? "!" : pendingNow ? "…" : "·"}
          </span>
        </span>

        <span className="pointer-events-none absolute left-1/2 top-[calc(100%+4px)] w-[4.25rem] -translate-x-1/2 text-center">
          <span className="block truncate text-[9px] font-semibold leading-tight text-foreground">
            {item.name.split(" ")[0]}
          </span>
          <span className="block truncate text-[8px] text-muted-foreground">L{item.level}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        className="z-[80] max-w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        <ApproverDetailPopoverBody item={item} />
      </PopoverContent>
    </Popover>
  )
}

export function LeaveWorkflowProgress({
  row,
  className,
}: {
  row: AdminRecord | null
  className?: string
}) {
  const summary = React.useMemo(() => buildLeaveWorkflowSummary(row), [row])
  const [openKey, setOpenKey] = React.useState<string | null>(null)

  const peopleCount = summary.approvals.length
  // Compact circular nodes; spacing handled by row/col gaps in the layout.
  const nodeSize = peopleCount >= 8 ? 34 : peopleCount >= 5 ? 36 : 40
  const centerSize = 44

  const layout = React.useMemo(
    () =>
      layoutApproverFlowchart(
        summary.approvals,
        summary.levels,
        nodeSize,
        centerSize
      ),
    [summary.approvals, summary.levels, nodeSize, centerSize]
  )

  const edges = React.useMemo(
    () =>
      buildFlowchartEdges(
        layout,
        summary.approvals,
        summary.levels,
        nodeSize,
        centerSize
      ),
    [layout, summary.approvals, summary.levels, nodeSize, centerSize]
  )

  const requestTone = statusTone(summary.requestStatus)

  if (summary.totalCount === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center",
          className
        )}
      >
        <p className="text-sm font-medium text-foreground">No approvers in the graph yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          People appear here as circular profiles once the request is submitted.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("w-full min-w-0 space-y-2", className)}>
      {/* Compact snapshot chips */}
      <section className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border">
        {[
          {
            label: "Status",
            value: formatStatusLabel(summary.requestStatus),
            className:
              requestTone === "good"
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : requestTone === "bad"
                  ? "bg-rose-500/10 text-rose-800 dark:text-rose-200"
                  : "bg-amber-500/10 text-amber-900 dark:text-amber-200",
          },
          {
            label: "People",
            value: String(summary.totalCount),
            className: "bg-background text-primary",
          },
          {
            label: "OK",
            value: String(summary.approvedCount),
            className: "bg-background text-emerald-700 dark:text-emerald-300",
          },
          {
            label: "Pending",
            value: String(summary.pendingCount),
            className: "bg-background text-amber-800 dark:text-amber-300",
          },
          {
            label: "%",
            value: `${summary.progressPercent}%`,
            className: "bg-background text-foreground",
          },
        ].map((chip, index, arr) => (
          <div
            key={chip.label}
            className={cn(
              "flex min-w-[3.75rem] shrink-0 flex-col justify-center px-2.5 py-1.5",
              chip.className,
              index < arr.length - 1 ? "border-r border-border/60" : null
            )}
          >
            <span className="truncate text-[9px] font-semibold uppercase tracking-wide opacity-80">
              {chip.label}
            </span>
            <span className="truncate text-sm font-semibold leading-tight capitalize">
              {chip.value}
            </span>
          </div>
        ))}
      </section>

      {/* Flowchart canvas: start → level rows of circular profile nodes */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 0)",
            backgroundSize: "14px 14px",
          }}
        />

        <div className="relative w-full overflow-x-auto px-2 py-3 sm:px-3 sm:py-4">
          <div
            className="relative mx-auto"
            style={{
              width: layout.width,
              height: layout.height,
              minWidth: layout.width,
            }}
          >
            {/* SVG connectors */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden
            >
              {edges.map((edge) => (
                <path
                  key={edge.key}
                  d={edge.d}
                  fill="none"
                  stroke={
                    edge.active
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--border) 88%, transparent)"
                  }
                  strokeWidth={edge.active ? 1.75 : 1.15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={edge.active ? undefined : "4 4"}
                  opacity={edge.active ? 0.95 : 0.55}
                />
              ))}
            </svg>

            {/* Level labels on the left */}
            {summary.levels.map((level) => {
              const y = layout.rowYs.get(level)
              if (y == null) return null
              return (
                <div
                  key={`label-${level}`}
                  className="pointer-events-none absolute -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ left: 6, top: y }}
                >
                  L{level}
                </div>
              )
            })}

            {/* Start node (request) */}
            <div
              className={cn(
                "absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border bg-card shadow-sm",
                requestTone === "good"
                  ? "border-emerald-500"
                  : requestTone === "bad"
                    ? "border-rose-500"
                    : "border-primary/45"
              )}
              style={{
                left: layout.start.x,
                top: layout.start.y,
                width: centerSize,
                height: centerSize,
              }}
              aria-hidden
            >
              <span className="text-[7px] font-semibold uppercase tracking-wide text-muted-foreground">
                Start
              </span>
              <span className="px-0.5 text-center text-[9px] font-bold leading-tight text-foreground">
                {formatStatusLabel(summary.requestStatus).split(" ")[0]}
              </span>
            </div>

            {/* Approver circular photo nodes by level row */}
            {summary.approvals.map((item) => {
              const pos = layout.positions.get(nodeKey(item))
              if (!pos) return null
              const key = nodeKey(item)
              return (
                <div
                  key={key}
                  className="absolute z-[3] -translate-x-1/2 -translate-y-1/2"
                  style={{ left: pos.x, top: pos.y }}
                >
                  <ApproverAvatarNode
                    item={item}
                    open={openKey === key}
                    onOpenChange={(next) => setOpenKey(next ? key : null)}
                    size={nodeSize}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

export function LeaveWorkflowDialog({
 open,
 onOpenChange,
 token,
 requestId,
 fallbackRow,
}: {
 open: boolean
 onOpenChange: (open: boolean) => void
 token: string
 requestId: number | string | null
 fallbackRow?: AdminRecord | null
}) {
 const [loading, setLoading] = React.useState(false)
 const [error, setError] = React.useState<string | null>(null)
 const [detail, setDetail] = React.useState<AdminRecord | null>(fallbackRow ?? null)
 const [actionError, setActionError] = React.useState<string | null>(null)
 const [actionMessage, setActionMessage] = React.useState<string | null>(null)
 const [busyAction, setBusyAction] = React.useState<"pdf" | "medical" | "document" | "document-download" | null>(null)
 const [medicalForm, setMedicalForm] = React.useState(createEmptyMedicalForm)
 const [medicalAttachmentFile, setMedicalAttachmentFile] = React.useState<File | null>(null)
 const [documentFile, setDocumentFile] = React.useState<File | null>(null)
 const medicalAttachmentInputRef = React.useRef<HTMLInputElement>(null)

 React.useEffect(() => {
 if (!open) {
 return
 }

 setDetail(fallbackRow ?? null)
 setError(null)
 setActionError(null)
 setActionMessage(null)

 if (!token || requestId === null) {
 return
 }

 let cancelled = false
 setLoading(true)

 void getMyLeaveRequest(token, requestId)
 .then((payload) => {
 if (cancelled) return
 // Prefer the detailed payload, but keep list-row approvals/workflow if
 // the detail response is missing them (common on lighter list embeds).
 const merged = mergeLeaveWorkflowRows(payload, fallbackRow ?? null)
 setDetail(merged)
 })
 .catch((errorObject) => {
 if (cancelled) return
 setError(
 errorObject instanceof Error
 ? errorObject.message
 : "Could not load workflow details."
 )
 setDetail(fallbackRow ?? null)
 })
 .finally(() => {
 if (!cancelled) setLoading(false)
 })

 return () => {
 cancelled = true
 }
 }, [fallbackRow, open, requestId, token])

 React.useEffect(() => {
  const medical = asRecord(detail?.medical_detail)
  setMedicalForm({
   sickness_nature: readString(medical, ["sickness_nature"]),
   doctor_name: readString(medical, ["doctor_name"]),
   doctor_phone: readString(medical, ["doctor_phone"]),
   hospital_name: readString(medical, ["hospital_name"]),
   treatment_start_date: readDateInputValue(medical, "treatment_start_date"),
   treatment_end_date: readDateInputValue(medical, "treatment_end_date"),
   attachment_url: readString(medical, ["attachment_url"]),
  })
  setMedicalAttachmentFile(null)
  if (medicalAttachmentInputRef.current) {
   medicalAttachmentInputRef.current.value = ""
  }
  setDocumentFile(null)
 }, [detail])

 const documents = React.useMemo(
  () => asRecordList(detail?.documents),
  [detail?.documents],
 )

 const refreshDetail = React.useCallback(async () => {
  if (!token || requestId === null) {
   return
  }
  const payload = await getMyLeaveRequest(token, requestId)
  setDetail(mergeLeaveWorkflowRows(payload, fallbackRow ?? null))
 }, [fallbackRow, requestId, token])

 const handleDownloadPdf = React.useCallback(async () => {
  if (!token || requestId === null) {
   return
  }
  setBusyAction("pdf")
  setActionError(null)
  setActionMessage(null)
  try {
   const result = await downloadMyLeaveRequestPdf(token, requestId)
   downloadBlob(result.blob, result.filename)
   setActionMessage("Leave request PDF downloaded.")
  } catch (errorObject) {
   setActionError(
    errorObject instanceof Error
     ? errorObject.message
     : "Failed to download leave request PDF."
   )
  } finally {
   setBusyAction(null)
  }
 }, [requestId, token])

 const handleSaveMedicalDetail = React.useCallback(async () => {
  if (!token || requestId === null) {
   return
  }
  setBusyAction("medical")
  setActionError(null)
  setActionMessage(null)
  try {
   let attachmentUrl = medicalForm.attachment_url.trim()
   if (medicalAttachmentFile) {
    const file = await fileToBase64UploadDto(medicalAttachmentFile)
    const uploadedDocument = asRecord(
     await addLeaveRequestDocument(token, requestId, { file })
    )
    attachmentUrl = readString(uploadedDocument, ["file_url"])
    if (!attachmentUrl) {
     throw new Error("The attachment was uploaded, but its file reference was not returned.")
    }
    setMedicalForm((current) => ({ ...current, attachment_url: attachmentUrl }))
    setMedicalAttachmentFile(null)
    if (medicalAttachmentInputRef.current) {
     medicalAttachmentInputRef.current.value = ""
    }
   }
   await patchLeaveRequestMedicalDetail(token, requestId, {
    sickness_nature: medicalForm.sickness_nature.trim() || undefined,
    doctor_name: medicalForm.doctor_name.trim() || undefined,
    doctor_phone: medicalForm.doctor_phone.trim() || undefined,
    hospital_name: medicalForm.hospital_name.trim() || undefined,
    treatment_start_date: medicalForm.treatment_start_date || undefined,
    treatment_end_date: medicalForm.treatment_end_date || undefined,
    attachment_url: attachmentUrl || undefined,
   })
   await refreshDetail()
   setActionMessage("Medical detail saved.")
  } catch (errorObject) {
   setActionError(
    errorObject instanceof Error
     ? errorObject.message
     : "Failed to save medical detail."
   )
  } finally {
   setBusyAction(null)
  }
 }, [medicalAttachmentFile, medicalForm, refreshDetail, requestId, token])

 const handleUploadDocument = React.useCallback(async () => {
  if (!token || requestId === null) {
   return
  }
  if (!documentFile) {
   setActionError("Choose a document to upload first.")
   return
  }
  setBusyAction("document")
  setActionError(null)
  setActionMessage(null)
  try {
   const file = await fileToBase64UploadDto(documentFile)
   await addLeaveRequestDocument(token, requestId, { file })
   await refreshDetail()
   setDocumentFile(null)
   setActionMessage("Supporting document uploaded.")
  } catch (errorObject) {
   setActionError(
    errorObject instanceof Error
     ? errorObject.message
     : "Failed to upload supporting document."
   )
  } finally {
   setBusyAction(null)
  }
 }, [documentFile, refreshDetail, requestId, token])

 const handleDownloadDocument = React.useCallback(async (documentRow: AdminRecord) => {
  if (!token || requestId === null) {
   return
  }
  const documentId = readNumber(documentRow, ["id"])
  if (documentId === null) {
   setActionError("This document is missing an id and cannot be downloaded.")
   return
  }
  setBusyAction("document-download")
  setActionError(null)
  setActionMessage(null)
  try {
   const result = await downloadLeaveRequestDocument(token, requestId, documentId)
   downloadBlob(result.blob, result.filename)
   setActionMessage("Supporting document downloaded.")
  } catch (errorObject) {
   const rawUrl =
    readString(documentRow, ["file_url"]) ||
    resolveBackendMediaUrl(readString(documentRow, ["file_url"]))
   if (rawUrl) {
    window.open(resolveBackendMediaUrl(rawUrl) ?? rawUrl, "_blank", "noopener,noreferrer")
    setActionMessage("Opened supporting document.")
   } else {
    setActionError(
     errorObject instanceof Error
      ? errorObject.message
      : "Failed to download supporting document."
    )
   }
  } finally {
   setBusyAction(null)
  }
 }, [requestId, token])

 const requestLabel =
 readString(detail, ["leave_no", "request_no", "reference"]) ||
 (requestId !== null ? `Request #${requestId}` : "Leave request")
 const leaveType =
 readString(asRecord(detail?.leave_type), ["name", "display_name"]) ||
 readString(detail, ["leave_type_name"]) ||
 "Leave"
 const status = readString(detail, ["status"]) || "pending"

 const requestReason = readString(detail, ["reason"])
 const medicalDetail = asRecord(detail?.medical_detail)
 const showMedicalDetail = isMedicalLeaveRequest(detail)

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogPopup className="flex max-h-[min(92vh,820px)] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden p-3 sm:w-[min(32rem,calc(100%-2rem))] sm:max-w-none sm:p-4">
 <DialogHeader className="mb-0 shrink-0 space-y-0.5 border-b border-border pb-2 pr-10 text-left">
 <DialogTitle className="text-base">Leave request details</DialogTitle>
 <DialogDescription className="text-left text-sm">
 <span className="font-medium text-foreground">{requestLabel}</span>
 <span className="mx-1.5 text-muted-foreground">·</span>
 {leaveType}
 <span className="mx-1.5 text-muted-foreground">·</span>
 <StatusText status={status} className="text-sm" />
 </DialogDescription>
 </DialogHeader>

 <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-2">
 {loading ? (
 <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
 <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
 Loading network…
 </div>
 ) : null}

 {!loading && error ? (
 <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
 {error} Showing the last available request data.
 </div>
 ) : null}

 {!loading && actionError ? (
 <div className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-900 dark:text-rose-200">
 {actionError}
 </div>
 ) : null}

 {!loading && actionMessage ? (
 <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200">
 {actionMessage}
 </div>
 ) : null}

 {!loading ? (
 <div className="w-full min-w-0 space-y-3">
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div className="rounded-md border border-border/60 px-2.5 py-2">
 <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</p>
 <p className="font-medium text-foreground">{readString(detail, ["start_date"]) || "-"}</p>
 </div>
 <div className="rounded-md border border-border/60 px-2.5 py-2">
 <p className="text-[10px] uppercase tracking-wide text-muted-foreground">End</p>
 <p className="font-medium text-foreground">{readString(detail, ["end_date"]) || "-"}</p>
 </div>
 </div>

 {requestReason ? (
 <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
 <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
 Reason
 </p>
 <p className="mt-1 text-sm text-foreground">{requestReason}</p>
 </div>
 ) : null}

 <div className="flex flex-wrap gap-1.5">
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={busyAction !== null}
 onClick={() => void handleDownloadPdf()}
 >
 {busyAction === "pdf" ? "Downloading…" : "PDF"}
 </Button>
 </div>

 {showMedicalDetail ? (
 <div className="rounded-lg border border-border/70 bg-background/60 p-3">
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
 <div>
 <p className="text-sm font-medium text-foreground">Medical detail</p>
 <p className="text-[11px] text-muted-foreground">
 Keep treatment details and any supporting medical attachment in sync with this request.
 </p>
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={busyAction !== null}
 onClick={() => void handleSaveMedicalDetail()}
 >
 {busyAction === "medical" ? "Saving…" : "Save medical detail"}
 </Button>
 </div>
 <div className="grid gap-3 sm:grid-cols-2">
 <label className="grid gap-1">
 <span className="text-xs font-medium text-muted-foreground">Sickness nature</span>
 <Input
 value={medicalForm.sickness_nature}
 onChange={(event) =>
 setMedicalForm((current) => ({
 ...current,
 sickness_nature: event.target.value,
 }))
 }
 />
 </label>
 <label className="grid gap-1">
 <span className="text-xs font-medium text-muted-foreground">Doctor name</span>
 <Input
 value={medicalForm.doctor_name}
 onChange={(event) =>
 setMedicalForm((current) => ({
 ...current,
 doctor_name: event.target.value,
 }))
 }
 />
 </label>
 <label className="grid gap-1">
 <span className="text-xs font-medium text-muted-foreground">Doctor phone</span>
 <Input
 value={medicalForm.doctor_phone}
 onChange={(event) =>
 setMedicalForm((current) => ({
 ...current,
 doctor_phone: event.target.value,
 }))
 }
 />
 </label>
 <label className="grid gap-1">
 <span className="text-xs font-medium text-muted-foreground">Hospital name</span>
 <Input
 value={medicalForm.hospital_name}
 onChange={(event) =>
 setMedicalForm((current) => ({
 ...current,
 hospital_name: event.target.value,
 }))
 }
 />
 </label>
 <label className="grid gap-1">
 <span className="text-xs font-medium text-muted-foreground">Treatment start</span>
 <DatePickerPresets
 value={medicalForm.treatment_start_date}
 placeholder="Select treatment start"
 onChange={(value) =>
 setMedicalForm((current) => ({
 ...current,
 treatment_start_date: value,
 }))
 }
 />
 </label>
 <label className="grid gap-1">
 <span className="text-xs font-medium text-muted-foreground">Treatment end</span>
 <DatePickerPresets
 value={medicalForm.treatment_end_date}
 placeholder="Select treatment end"
 onChange={(value) =>
 setMedicalForm((current) => ({
 ...current,
 treatment_end_date: value,
 }))
 }
 />
 </label>
 <label className="grid gap-1 sm:col-span-2">
 <span className="text-xs font-medium text-muted-foreground">Medical attachment</span>
 <Input
 ref={medicalAttachmentInputRef}
 type="file"
 accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
 className="h-auto py-2"
 onChange={(event) =>
 setMedicalAttachmentFile(event.target.files?.[0] ?? null)
 }
 />
 <span className="text-[11px] font-normal text-muted-foreground">
 {medicalAttachmentFile
 ? `Ready to upload when you save: ${medicalAttachmentFile.name}`
 : medicalForm.attachment_url
 ? "A medical attachment is already saved. Choose another file to replace it."
 : "Choose a PDF, image, Word, Excel, or text file (up to 10 MB)."}
 </span>
 </label>
 </div>
 {medicalDetail && !medicalForm.attachment_url ? (
 <p className="mt-2 text-[11px] text-muted-foreground">
 Existing medical detail saved on {formatDateTime(readString(medicalDetail, ["created_at"])) || "record"}.
 </p>
 ) : null}
 </div>
 ) : null}

 <div className="rounded-lg border border-border/70 bg-background/60 p-3">
 <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
 <div>
 <p className="text-sm font-medium text-foreground">Supporting documents</p>
 <p className="text-[11px] text-muted-foreground">
 Upload a supporting file and download any document already attached to this request.
 </p>
 </div>
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={busyAction !== null || !documentFile}
 onClick={() => void handleUploadDocument()}
 >
 {busyAction === "document" ? "Uploading…" : "Upload document"}
 </Button>
 </div>
 <div className="rounded-md border border-dashed border-border/80 px-3 py-3">
 <Input
 type="file"
 className="h-auto border-0 px-0 py-0 shadow-none focus-visible:ring-0"
 onChange={(event) => {
 const file = event.target.files?.[0] ?? null
 setDocumentFile(file)
 }}
 />
 <p className="mt-2 text-[11px] text-muted-foreground">
 {documentFile ? `Ready to upload: ${documentFile.name}` : "Choose a document file to attach to this leave request."}
 </p>
 </div>
 <div className="mt-3 space-y-2">
 {documents.length === 0 ? (
 <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
 No supporting documents attached yet.
 </div>
 ) : (
 documents.map((documentRow, index) => {
 const fileUrl = resolveBackendMediaUrl(readString(documentRow, ["file_url"]))
 return (
 <div
 key={`leave-document-${readNumber(documentRow, ["id"]) ?? index}`}
 className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
 >
 <div className="min-w-0">
 <p className="truncate text-xs font-medium text-foreground">
 {readString(documentRow, ["file_name", "original_file_name"]) || "Supporting document"}
 </p>
 <p className="truncate text-[11px] text-muted-foreground">
 {readString(documentRow, ["file_type", "mime_type"]) || "File"} · uploaded{" "}
 {formatDateTime(readString(documentRow, ["uploaded_at", "created_at"])) || "-"}
 </p>
 </div>
 <div className="flex flex-wrap gap-1.5">
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={busyAction !== null}
 onClick={() => void handleDownloadDocument(documentRow)}
 >
 {busyAction === "document-download" ? "Downloading…" : "Download"}
 </Button>
 {fileUrl ? (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}
 >
 Open
 </Button>
 ) : null}
 </div>
 </div>
 )
 })
 )}
 </div>
 </div>

 <div className="w-full min-w-0">
 <LeaveWorkflowProgress row={detail} />
 </div>
 </div>
 ) : null}
 </div>

 <div className="flex shrink-0 justify-end border-t border-border pt-2.5">
 <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
 Close
 </Button>
 </div>
 </DialogPopup>
 </Dialog>
 )
}
