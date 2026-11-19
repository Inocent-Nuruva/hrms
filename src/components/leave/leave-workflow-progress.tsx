"use client"
import { downloadLeavePdfWithFallback } from "@/lib/leave-pdf-download"

import { leaveEvidenceMessage } from "@/lib/leave-evidence"
import { LeaveSignaturesPanel } from "./leave-signatures-panel"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { CircleAlert, CircleCheck, Download, FileText, Paperclip, Stethoscope } from "lucide-react"
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

type DetailTab = "overview" | "approvals" | "documents" | "medical"

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
 const [tab, setTab] = React.useState<DetailTab>("overview")

 React.useEffect(() => {
 if (!open) {
 return
 }

 setDetail(fallbackRow ?? null)
 setTab("overview")
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

 const tabs: Array<{ key: DetailTab; label: string; badge?: number }> = [
  { key: "overview", label: "Overview" },
  { key: "approvals", label: "Approvals", badge: workflow.totalCount || undefined },
  { key: "documents", label: "Documents", badge: documents.length || undefined },
  ...(showMedicalDetail ? [{ key: "medical" as const, label: "Medical" }] : []),
 ]
 const activeTab = tabs.some((t) => t.key === tab) ? tab : "overview"
 const fact = (label: string, value: string) => (
  <div className="min-w-0">
   <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
   <p className="truncate text-sm font-semibold text-foreground">{value}</p>
  </div>
 )
 const shortDate = (value: string) => formatDateTime(value).split(",")[0] || value || "—"
 const sectionTitle = (title: string) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
 )

 return (
  <Dialog open={open} onOpenChange={onOpenChange}>
   <DialogPopup
    from="bottom"
    className="w-[calc(100%-1rem)] max-w-2xl !p-0 sm:max-w-3xl"
    bodyClassName="!gap-0 !max-h-[94dvh] overscroll-contain"
   >
    {/* Header: same shape as the HR leave request preview */}
    <header className="space-y-3 border-b border-border px-4 pb-3 pt-4 pr-12 text-left sm:px-6">
     <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
       <DialogTitle className="text-lg leading-snug">{requestLabel}</DialogTitle>
       <StatusPill tone={tone} label={formatStatusLabel(status)} />
      </div>
      <DialogDescription className="text-sm">
       {[employeeName, leaveType].filter(Boolean).join(" · ")}
      </DialogDescription>
     </div>
     <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 px-3 py-2.5 sm:grid-cols-4">
      {fact("Period", startDate || endDate ? `${shortDate(startDate)} – ${shortDate(endDate)}` : "—")}
      {fact("Days", totalDays !== null ? `${totalDays} day${totalDays === 1 ? "" : "s"}` : "—")}
      {fact("Duration", durationType ? formatStatusLabel(durationType) : "Full day")}
      {fact("Applied", formatDateTime(appliedAt) || "Not yet submitted")}
     </div>
     <div className="-mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Leave request sections">
      {tabs.map((t) => (
       <button
        key={t.key}
        type="button"
        role="tab"
        aria-selected={activeTab === t.key}
        onClick={() => setTab(t.key)}
        className={cn(
         "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
         activeTab === t.key
          ? "border-primary font-semibold text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
        )}
       >
        {t.label}
        {t.badge ? (
         <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{t.badge}</span>
        ) : null}
       </button>
      ))}
     </div>
    </header>

    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
     {loading ? (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
       <FluentLoadingIndicator className="h-6 w-6 animate-spin text-primary" />
       Loading request…
      </div>
     ) : null}

     {!loading && error ? <Notice tone="warn">{error} Showing the last available request data.</Notice> : null}
     {!loading && actionError ? <Notice tone="bad">{actionError}</Notice> : null}
     {!loading && actionMessage ? <Notice tone="good">{actionMessage}</Notice> : null}

     {!loading && activeTab === "overview" ? (
      <>
       {rejectionReason ? <Notice tone="bad">Rejection reason: {rejectionReason}</Notice> : null}
       {returnReason ? <Notice tone="warn">Returned for changes: {returnReason}</Notice> : null}

       <section className="space-y-1.5">
        {sectionTitle("Reason")}
        <p className="whitespace-pre-wrap rounded-lg border border-border px-3 py-2.5 text-sm text-foreground">
         {requestReason || "No reason given."}
        </p>
       </section>

       <section className="space-y-1.5">
        {sectionTitle("Leave details")}
        <FieldGrid>
         <Field label="Leave type" value={leaveType} />
         <Field label="Reference" value={requestLabel} mono />
         <Field label="Start date" value={startDate} />
         <Field label="End date" value={endDate} />
         {halfDaySession ? <Field label="Half-day session" value={formatStatusLabel(halfDaySession)} /> : null}
         {startTime || endTime ? <Field label="Time" value={[startTime, endTime].filter(Boolean).join(" – ")} /> : null}
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
       </section>

       <section className="space-y-1.5">
        {sectionTitle("Employee")}
        <FieldGrid>
         <Field label="Full name" value={employeeName} />
         <Field label="Employee number" value={employeeNumber} />
         <Field label="Department" value={department} />
         <Field label="Position" value={position} />
         {branch ? <Field label="Branch / office" value={branch} /> : null}
        </FieldGrid>
       </section>

       <section className="space-y-2">
        {sectionTitle("Status and follow-up")}
        <p role="status" className="text-sm text-muted-foreground">
         {evidenceMessage || "No follow-up needed."}
        </p>
       </section>
      </>
     ) : null}

     {!loading && activeTab === "approvals" ? (
      <div className="space-y-4">
       <LeaveWorkflowProgress row={detail} />
       {workflow.approvals.length > 0 ? (
        <ol className="divide-y divide-border rounded-lg border border-border">
         {workflow.approvals.map((item, index) => (
          <li
           key={`${item.id ?? "approval"}-${index}`}
           className={cn("flex items-start gap-3 px-3 py-2.5", item.isCurrentLevel && "bg-primary/5")}
          >
           <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {item.level}
           </span>
           <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
             <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
             <StatusPill tone={statusTone(item.status)} label={formatStatusLabel(item.status)} />
            </div>
            <p className="text-xs text-muted-foreground">
             {[item.roleLabel, formatDateTime(item.actedAt)].filter(Boolean).join(" · ") || "Awaiting decision"}
            </p>
            {item.comments ? (
             <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.comments}</p>
            ) : null}
           </div>
          </li>
         ))}
        </ol>
       ) : null}
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
       ) : null}
      </div>
     ) : null}

     {!loading && activeTab === "documents" ? (
      <section className="space-y-3">
       <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted">
         <Paperclip className="size-4" />
         {documentFile ? "Change file" : "Attach file"}
         <input
          key={documentFile ? "has-file" : "no-file"}
          type="file"
          className="sr-only"
          onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
         />
        </label>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
         {documentFile ? documentFile.name : "PDF, image or other supporting document."}
        </p>
        <Button
         type="button"
         size="sm"
         disabled={busyAction !== null || !documentFile}
         onClick={() => void handleUploadDocument()}
        >
         {busyAction === "document" ? "Uploading…" : "Upload"}
        </Button>
       </div>
       {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
         No supporting documents attached yet.
        </p>
       ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
         {documents.map((documentRow, index) => {
          const fileName = readString(documentRow, ["file_name", "original_file_name"]) || "Supporting document"
          return (
           <li
            key={`leave-document-${readNumber(documentRow, ["id"]) ?? index}`}
            className="flex items-center gap-3 px-3 py-2.5"
           >
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
             <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
             <p className="truncate text-xs text-muted-foreground">
              Uploaded {formatDateTime(readString(documentRow, ["uploaded_at", "created_at"])) || "—"}
             </p>
            </div>
            <button
             type="button"
             className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
             disabled={busyAction !== null}
             aria-label={`Download ${fileName}`}
             title="Download"
             onClick={() => void handleDownloadDocument(documentRow)}
            >
             <Download className="size-4" />
            </button>
           </li>
          )
         })}
        </ul>
       )}
      </section>
     ) : null}

     {!loading && activeTab === "medical" && showMedicalDetail ? (
      <section className="grid gap-3 rounded-lg border border-border/70 p-3">
       <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
         <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Stethoscope className="size-4 text-muted-foreground" />
          Medical detail
         </p>
         <p className="text-[11px] text-muted-foreground">
          Save treatment details and upload a supporting medical attachment.
         </p>
        </div>
        <Button
         type="button"
         size="sm"
         variant="outline"
         disabled={busyAction !== null}
         onClick={() => void handleSaveMedicalDetail()}
        >
         {busyAction === "medical" ? "Saving…" : "Save medical detail"}
        </Button>
       </div>
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
        <p className="text-xs text-muted-foreground">
         Existing medical detail saved on {formatDateTime(readString(medicalDetail, ["created_at"])) || "record"}.
        </p>
       ) : null}
      </section>
     ) : null}
    </div>

    <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
     <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
      Close
     </Button>
     <Button type="button" disabled={busyAction !== null || loading} onClick={() => void handleDownloadPdf()}>
      <Download className="size-4" />
      {busyAction === "pdf" ? "Downloading…" : "Download PDF"}
     </Button>
    </footer>
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
