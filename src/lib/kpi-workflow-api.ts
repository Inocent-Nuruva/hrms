import { adminRequest } from "@/lib/admin-api"

export type KpiWorkflowStageId = "setup" | "define" | "assign" | "track" | "submit" | "review" | "approve" | "close"
export type KpiWorkflowStage = { id: KpiWorkflowStageId; name: string; description: string; roles: string[]; next: KpiWorkflowStageId[] }
export type KpiWorkflowAction = { id: string; stage: KpiWorkflowStageId; title: string; description: string; owner: string; href: string; recordId?: number; dueDate?: string | null; blocked?: boolean; reason?: string; resolveHref?: string }
export type KpiWorkflowRecord = { kind: "definition" | "assignment" | "achievement" | "scorecard" | "evaluation"; id: number; stage: KpiWorkflowStageId; status: string; href: string; owner: string; blockedReason?: string }
export type KpiWorkflowWaitingStep = { id: string; title: string; status: "complete" | "pending" | "unavailable"; owner: string; explanation: string; reminderKey?: string; reminderBlockedReason?: string; reminderStatus?: "none" | "active" | "closed_unresolved" | "no_recipient" }
export type KpiWorkflowGuidance = { stages: KpiWorkflowStage[]; actions: KpiWorkflowAction[]; records: KpiWorkflowRecord[]; waiting?: KpiWorkflowWaitingStep[]; updatedAt: string }

export const kpiWorkflowApi = {
  guidance: (token: string) => adminRequest<KpiWorkflowGuidance>("/api/hr/kpi/workflow/guidance", { token, dedupe: false }),
  remindHr: (token: string, reminderKey: string) => adminRequest<{ message: string; reminderStatus: "active" | "closed_unresolved"; actionItemId: number; notificationId?: number; channel?: string }>("/api/hr/kpi/workflow/remind-hr", { token, method: "POST", body: { reminderKey } }),
}
