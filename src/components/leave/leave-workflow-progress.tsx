"use client"
import { downloadLeavePdfWithFallback } from "@/lib/leave-pdf-download"

import { leaveEvidenceMessage } from "@/lib/leave-evidence"
import { LeaveSignaturesPanel } from "./leave-signatures-panel"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { CalendarDays, CircleAlert, CircleCheck, Clock, Download, FileText, Paperclip, Stethoscope, Upload, X } from "lucide-react"
import {
 Dialog,
 DialogDescription,
 DialogPopup,
 DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
 uploadMyLeaveRequestDocument,
 downloadMyLeaveRequestDocument,
 downloadMyLeaveRequestPdf,
 getMyLeaveRequest,
 patchMyLeaveRequestMedicalDetail,
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
 waitingLabel: row.routing_required === true ? "Awaiting manager assignment" : waitingLabel,
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
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-border sm:grid-cols-5">
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
            label: "Approvers",
            value: String(summary.totalCount),
            className: "bg-background text-primary",
          },
          {
            label: "Approved",
            value: String(summary.approvedCount),
            className: "bg-background text-emerald-700 dark:text-emerald-300",
          },
          {
            label: "Pending",
            value: String(summary.pendingCount),
            className: "bg-background text-amber-800 dark:text-amber-300",
          },
          {
            label: "Progress",
            value: `${summary.progressPercent}%`,
            className: "bg-background text-foreground",
          },
        ].map((chip, index, arr) => (
          <div
            key={chip.label}
            className={cn(
              "flex min-w-0 flex-col justify-center border-b border-border/60 px-3 py-2 sm:border-b-0", index === 0 ? "col-span-2 sm:col-span-1" : null,
              chip.className,
              index < arr.length - 1 ? "border-r border-border/60" : null
            )}
          >
            <span className="truncate text-[11px] font-medium opacity-80">
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
   const result = await downloadLeavePdfWithFallback((options) =>
    downloadMyLeaveRequestPdf(token, requestId, options)
   )
   if (!result) return
   downloadBlob(result.blob, result.filename)
   setActionMessage(
    result.formOnly
     ? "Leave form downloaded without supporting documents."
     : "Leave request PDF downloaded."
   )
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
    const uploadedDocument = asRecord(
     await uploadMyLeaveRequestDocument(token, requestId, medicalAttachmentFile)
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
   await patchMyLeaveRequestMedicalDetail(token, requestId, {
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
   await uploadMyLeaveRequestDocument(token, requestId, documentFile)
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
   const result = await downloadMyLeaveRequestDocument(token, requestId, documentId)
   downloadBlob(result.blob, result.filename)
   setActionMessage("Supporting document downloaded.")
  } catch (errorObject) {
   setActionError(errorObject instanceof Error ? errorObject.message : "Failed to download supporting document.")
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

 const totalDays = readNumber(detail, ["total_days", "days", "number_of_days", "duration_days"])
 const startDate = readString(detail, ["start_date"])
 const endDate = readString(detail, ["end_date"])
 const tone = statusTone(status)
 const evidenceMessage = leaveEvidenceMessage(detail)

 const employee = asRecord(detail?.employee)
 const employeeName =
  readString(employee, ["full_name", "name", "display_name"]) ||
  [readString(employee, ["first_name"]), readString(employee, ["middle_name"]), readString(employee, ["last_name"])]
   .filter(Boolean)
   .join(" ") ||
  readString(detail, ["employee_name"])
 const employeeNumber =
  readString(employee, ["employee_no", "employee_number", "code"]) || readString(detail, ["employee_no"])
 const department =
  readString(asRecord(employee?.department), ["name"]) ||
  readString(employee, ["department_name"]) ||
  readString(detail, ["department_name"])
 const position =
  readString(asRecord(employee?.position), ["name", "title"]) ||
  readString(asRecord(employee?.designation), ["name", "title"]) ||
  readString(employee, ["position_name", "designation", "job_title"])
 const branch = readString(asRecord(employee?.branch), ["name"]) || readString(employee, ["branch_name"])
 const durationType = readString(detail, ["duration_type"])
 const halfDaySession = readString(detail, ["half_day_session"])
 const startTime = readString(detail, ["start_time"])
 const endTime = readString(detail, ["end_time"])
 const appliedAt = readString(detail, ["applied_at", "submitted_at"])
 const createdAt = readString(detail, ["created_at"])
 const approvedAt = readString(detail, ["approved_at"])
 const cancelledAt = readString(detail, ["cancelled_at"])
 const rejectionReason = readString(detail, ["rejection_reason"])
 const returnReason = readString(detail, ["return_reason"])
 const evidenceDueAt = readString(detail, ["evidence_due_at"])
 const evidenceReceivedAt = readString(detail, ["evidence_received_at"])
 const evidenceRequired = detail?.evidence_required === true
 const workflow = React.useMemo(() => buildLeaveWorkflowSummary(detail), [detail])

 const updateMedical = (key: keyof ReturnType<typeof createEmptyMedicalForm>, value: string) =>
  setMedicalForm((current) => ({ ...current, [key]: value }))

 const sections = [
  "Employee information",
  "Leave application details",
  "Approval progress",
  ...(showMedicalDetail ? ["Medical information"] : []),
  "Signatures",
  "Supporting documents",
 ]
 const letter = (title: string) => String.fromCharCode(65 + sections.indexOf(title))

 return (
  <Dialog open={open} onOpenChange={onOpenChange}>
   <DialogPopup className="h-dvh w-[100vw] max-w-none" bodyClassName="!gap-0 !p-0 bg-muted/30" showCloseButton={false}>
    {/* Sticky page bar */}
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
     <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
       <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={tone} label={formatStatusLabel(status)} />
        <span className="font-mono text-xs text-muted-foreground">{requestLabel}</span>
       </div>
       <DialogTitle className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">{leaveType}</DialogTitle>
       <DialogDescription className="sr-only">
        Leave application form, approvals, signatures and documents.
       </DialogDescription>
      </div>
      <div className="flex shrink-0 items-center gap-2">
       <Button type="button" disabled={busyAction !== null || loading} onClick={() => void handleDownloadPdf()}>
        <Download className="size-4" />
        <span className="hidden sm:inline">{busyAction === "pdf" ? "Downloading…" : "Download PDF"}</span>
       </Button>
       <Button type="button" variant="outline" aria-label="Close" onClick={() => onOpenChange(false)}>
        <X className="size-4" />
        <span className="hidden sm:inline">Close</span>
       </Button>
      </div>
     </div>
    </header>

    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
     {loading ? (
      <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
       <FluentLoadingIndicator className="h-6 w-6 animate-spin text-primary" />
       Loading request…
      </div>
     ) : null}

     {!loading && error ? <Notice tone="warn">{error} Showing the last available request data.</Notice> : null}
     {!loading && actionError ? <Notice tone="bad">{actionError}</Notice> : null}
     {!loading && actionMessage ? <Notice tone="good">{actionMessage}</Notice> : null}

     {!loading ? (
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
       {/* Form title block */}
       <div className="border-b border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-6 text-center sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Leave application form</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{leaveType}</h2>
        <dl className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
         <SummaryStat icon={<CalendarDays className="size-4" />} label="Starts" value={startDate || "—"} />
         <SummaryStat icon={<CalendarDays className="size-4" />} label="Ends" value={endDate || "—"} />
         <SummaryStat
          icon={<Clock className="size-4" />}
          label="Days requested"
          value={totalDays !== null ? `${totalDays} day${totalDays === 1 ? "" : "s"}` : "—"}
         />
         <SummaryStat
          icon={<CircleCheck className="size-4" />}
          label="Approvals"
          value={workflow.totalCount ? `${workflow.approvedCount} of ${workflow.totalCount}` : "—"}
         />
        </dl>
       </div>

       {rejectionReason || returnReason || evidenceMessage ? (
        <div className="space-y-2 border-b border-border px-5 py-4 sm:px-8">
         {rejectionReason ? <Notice tone="bad">Rejection reason: {rejectionReason}</Notice> : null}
         {returnReason ? <Notice tone="warn">Returned for changes: {returnReason}</Notice> : null}
         {evidenceMessage ? <Notice tone="neutral">{evidenceMessage}</Notice> : null}
        </div>
       ) : null}

       <div className="divide-y divide-border">
        <FormSection letter={letter("Employee information")} title="Employee information">
         <FieldGrid>
          <Field label="Employee full name" value={employeeName} />
          <Field label="Employee number" value={employeeNumber} />
          <Field label="Department" value={department} />
          <Field label="Position / designation" value={position} />
          <Field label="Branch / office" value={branch} />
         </FieldGrid>
        </FormSection>

        <FormSection letter={letter("Leave application details")} title="Leave application details">
         <FieldGrid>
          <Field label="Leave type" value={leaveType} />
          <Field label="Reference" value={requestLabel} mono />
          <Field label="Leave start date" value={startDate} />
          <Field label="Leave end date" value={endDate} />
          <Field label="Total days requested" value={totalDays !== null ? `${totalDays}` : ""} />
          <Field label="Duration" value={durationType ? formatStatusLabel(durationType) : ""} />
          {halfDaySession ? <Field label="Half-day session" value={formatStatusLabel(halfDaySession)} /> : null}
          {startTime || endTime ? (
           <Field label="Time" value={[startTime, endTime].filter(Boolean).join(" – ")} />
          ) : null}
          <Field label="Date of application" value={formatDateTime(appliedAt) || "Not yet submitted"} />
          <Field label="Created" value={formatDateTime(createdAt)} />
          {approvedAt ? <Field label="Approved on" value={formatDateTime(approvedAt)} /> : null}
          {cancelledAt ? <Field label="Cancelled on" value={formatDateTime(cancelledAt)} /> : null}
          {evidenceRequired ? (
           <Field
            label="Supporting evidence"
            value={
             evidenceReceivedAt
              ? `Received ${formatDateTime(evidenceReceivedAt)}`
              : evidenceDueAt
               ? `Due ${formatDateTime(evidenceDueAt)}`
               : "Required"
            }
           />
          ) : null}
         </FieldGrid>
         <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Reason for leave</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
           {requestReason || "No reason recorded"}
          </p>
         </div>
        </FormSection>

        <FormSection letter={letter("Approval progress")} title="Approval progress">
         <LeaveWorkflowProgress row={detail} />
         {workflow.approvals.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
           <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
             <tr>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Approver</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Decision date</th>
              <th className="px-3 py-2 font-medium">Comments</th>
             </tr>
            </thead>
            <tbody className="divide-y divide-border">
             {workflow.approvals.map((item, index) => (
              <tr
               key={`${item.id ?? "approval"}-${index}`}
               className={item.isCurrentLevel ? "bg-primary/5" : undefined}
              >
               <td className="px-3 py-2.5 align-top font-medium">{item.level}</td>
               <td className="px-3 py-2.5 align-top">
                <p className="font-medium text-foreground">{item.name}</p>
                {item.roleLabel ? <p className="text-xs text-muted-foreground">{item.roleLabel}</p> : null}
               </td>
               <td className="px-3 py-2.5 align-top">
                <StatusPill tone={statusTone(item.status)} label={formatStatusLabel(item.status)} />
               </td>
               <td className="px-3 py-2.5 align-top text-muted-foreground">{formatDateTime(item.actedAt) || "—"}</td>
               <td className="whitespace-pre-wrap px-3 py-2.5 align-top text-muted-foreground">{item.comments || "—"}</td>
              </tr>
             ))}
            </tbody>
           </table>
          </div>
         ) : null}
        </FormSection>

        {showMedicalDetail ? (
         <FormSection
          letter={letter("Medical information")}
          title="Medical information"
          icon={<Stethoscope className="size-4" />}
          description="Keep treatment details and the medical attachment in sync with this request."
         >
          <div className="grid gap-3 sm:grid-cols-2">
           {(
            [
             ["sickness_nature", "Sickness nature"],
             ["doctor_name", "Doctor name"],
             ["doctor_phone", "Doctor phone"],
             ["hospital_name", "Hospital name"],
            ] as const
           ).map(([key, label]) => (
            <label key={key} className="grid gap-1.5">
             <span className="text-xs font-medium text-muted-foreground">{label}</span>
             <Input
              type={key === "doctor_phone" ? "tel" : "text"}
              value={medicalForm[key]}
              onChange={(event) => updateMedical(key, event.target.value)}
             />
            </label>
           ))}
           <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Treatment start</span>
            <DatePickerPresets
             value={medicalForm.treatment_start_date}
             placeholder="Select treatment start"
             onChange={(value) => updateMedical("treatment_start_date", value)}
            />
           </label>
           <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Treatment end</span>
            <DatePickerPresets
             value={medicalForm.treatment_end_date}
             placeholder="Select treatment end"
             onChange={(value) => updateMedical("treatment_end_date", value)}
            />
           </label>
           <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Medical attachment</span>
            <Input
             ref={medicalAttachmentInputRef}
             type="file"
             accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
             className="h-auto py-2"
             onChange={(event) => setMedicalAttachmentFile(event.target.files?.[0] ?? null)}
            />
            <span className="text-xs font-normal text-muted-foreground">
             {medicalAttachmentFile
              ? `Ready to upload when you save: ${medicalAttachmentFile.name}`
              : medicalForm.attachment_url
               ? "A medical attachment is already saved. Choose another file to replace it."
               : "PDF, image, Word, Excel, or text file (up to 10 MB)."}
            </span>
           </label>
          </div>
          {medicalDetail && !medicalForm.attachment_url ? (
           <p className="mt-2 text-xs text-muted-foreground">
            Existing medical detail saved on {formatDateTime(readString(medicalDetail, ["created_at"])) || "record"}.
           </p>
          ) : null}
          <div className="mt-4 flex justify-end">
           <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            disabled={busyAction !== null}
            onClick={() => void handleSaveMedicalDetail()}
           >
            {busyAction === "medical" ? "Saving…" : "Save medical details"}
           </Button>
          </div>
         </FormSection>
        ) : null}

        <FormSection letter={letter("Signatures")} title="Signatures">
         {requestId !== null && token ? (
          <LeaveSignaturesPanel
           key={String(requestId)}
           token={token}
           requestId={Number(requestId)}
           currentCompanyUserId={null}
           isApplicant
           selfService
           status={readString(detail, ["status"])}
          />
         ) : (
          <p className="text-sm text-muted-foreground">Signatures are unavailable.</p>
         )}
        </FormSection>

        <FormSection
         letter={letter("Supporting documents")}
         title="Supporting documents"
         icon={<Paperclip className="size-4" />}
         description="Attach files that support this request."
         count={documents.length}
        >
         {documents.length > 0 ? (
          <ul className="mb-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
           {documents.map((documentRow, index) => (
            <li
             key={`leave-document-${readNumber(documentRow, ["id"]) ?? index}`}
             className="flex items-center gap-3 px-3 py-2.5"
            >
             <FileText className="size-5 shrink-0 text-muted-foreground" />
             <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
               {readString(documentRow, ["file_name", "original_file_name"]) || "Supporting document"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
               {readString(documentRow, ["file_type", "mime_type"]) || "File"} · uploaded{" "}
               {formatDateTime(readString(documentRow, ["uploaded_at", "created_at"])) || "-"}
              </p>
             </div>
             <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Download document"
              disabled={busyAction !== null}
              onClick={() => void handleDownloadDocument(documentRow)}
             >
              <Download className="size-4" />
              <span className="hidden sm:inline">Download</span>
             </Button>
            </li>
           ))}
          </ul>
         ) : null}

         <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
          <Upload className="size-5 text-muted-foreground" />
          <span className="max-w-full truncate text-sm font-medium text-foreground">
           {documentFile ? documentFile.name : "Click to choose a file"}
          </span>
          <span className="text-xs text-muted-foreground">
           {documentFile ? "Ready to upload" : "PDF, image, Word, Excel or text"}
          </span>
          <input
           key={documentFile ? "has-file" : "no-file"}
           type="file"
           className="sr-only"
           onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
          />
         </label>
         {documentFile ? (
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
           <Button type="button" variant="ghost" size="sm" disabled={busyAction !== null} onClick={() => setDocumentFile(null)}>
            Cancel
           </Button>
           <Button type="button" size="sm" disabled={busyAction !== null} onClick={() => void handleUploadDocument()}>
            {busyAction === "document" ? "Uploading…" : "Upload document"}
           </Button>
          </div>
         ) : null}
        </FormSection>
       </div>

       <footer className="border-t border-border bg-muted/20 px-5 py-3 text-center text-xs text-muted-foreground sm:px-8">
        Leave application reference: <span className="font-mono">{requestLabel}</span>
       </footer>
      </article>
     ) : null}
    </div>
   </DialogPopup>
  </Dialog>
 )
}

function StatusPill({ tone, label }: { tone: ReturnType<typeof statusTone>; label: string }) {
 return (
  <span
   className={cn(
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
    tone === "good"
     ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
     : tone === "bad"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      : tone === "warn"
       ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
       : "bg-muted text-muted-foreground"
   )}
  >
   <span className="size-1.5 rounded-full bg-current" />
   {label}
  </span>
 )
}

function Notice({ tone, children }: { tone: "good" | "bad" | "warn" | "neutral"; children: React.ReactNode }) {
 const Icon = tone === "good" ? CircleCheck : CircleAlert
 return (
  <div
   role={tone === "bad" ? "alert" : "status"}
   className={cn(
    "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
    tone === "good"
     ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
     : tone === "bad"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200"
      : tone === "warn"
       ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
       : "border-border bg-muted/40 text-muted-foreground"
   )}
  >
   <Icon className="mt-0.5 size-4 shrink-0" />
   <span className="whitespace-pre-wrap">{children}</span>
  </div>
 )
}

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
 return (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-xs">
   <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
   <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
   </div>
  </div>
 )
}

function FormSection({
 letter,
 title,
 description,
 icon,
 count,
 children,
}: {
 letter: string
 title: string
 description?: string
 icon?: React.ReactNode
 count?: number
 children: React.ReactNode
}) {
 return (
  <section className="px-5 py-6 sm:px-8">
   <div className="mb-4 flex items-start gap-3">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
     {letter}
    </span>
    <div className="min-w-0 flex-1">
     <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      {title}
      {count ? (
       <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium normal-case text-muted-foreground">
        {count}
       </span>
      ) : null}
     </h3>
     {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
   </div>
   {children}
  </section>
 )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
 return (
  <dl className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 [&>div]:border-b [&>div]:border-border sm:[&>div:nth-child(odd)]:border-r">
   {children}
  </dl>
 )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
 return (
  <div className="-mb-px px-4 py-3">
   <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
   <dd
    className={cn(
     "mt-0.5 break-words text-sm font-medium text-foreground",
     mono && "font-mono",
     !value && "font-normal italic text-muted-foreground"
    )}
   >
    {value || "Not recorded"}
   </dd>
  </div>
 )
}
