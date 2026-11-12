import { adminRequest } from "@/lib/admin-api"

export type KpiDefinitionForm = {
  code: string; name: string; description?: string; category: string; strategicObjective?: string;
  measurementType: string; measurementUnit?: string; direction: string; frequency: string; ownerEmployeeId?: number;
}
export type KpiDefinition = { id: number; code: string; status: string; currentVersion?: KpiVersion | null; draftVersion?: KpiVersion | null; versions?: KpiVersion[] }
export type KpiVersion = { id: number; version: number; name: string; description: string | null; category: string; strategicObjective: string | null; measurementType: string; measurementUnit: string | null; direction: string; frequency: string; publishedAt: string | null }
export type KpiTemplate = KpiDefinitionForm & { id: number; status: string; departmentClassification: string | null }
export type KpiPeriod = { id: number; label: string; frequency: string; startDate: string; endDate: string; timezone: string | null }
export type KpiAssignment = { id: number; periodId: number; subjectType: string; subjectId: number; organizationSnapshot?: { departmentId?: number | null; branchId?: number | null }; status: string; managerEmployeeId: number | null; definitionVersion: KpiVersion; period: KpiPeriod; currentTarget: { revision: number; target: Record<string, unknown> } | null; targetHistory?: { revision: number; target: Record<string, unknown>; reason: string; changedAt: string }[] }
const root = "/api/hr/kpi"
export const kpiApi = {
  definitions: (token: string, search = "") => adminRequest<KpiDefinition[]>(`${root}/definitions?search=${encodeURIComponent(search)}`, { token }),
  definition: (token: string, id: number) => adminRequest<KpiDefinition>(`${root}/definitions/${id}`, { token }),
  createDefinition: (token: string, body: KpiDefinitionForm) => adminRequest<KpiDefinition>(`${root}/definitions`, { token, method: "POST", body }),
  updateDefinition: (token: string, id: number, body: KpiDefinitionForm) => adminRequest<KpiDefinition>(`${root}/definitions/${id}/draft`, { token, method: "PATCH", body }),
  publishDefinition: (token: string, id: number) => adminRequest<KpiDefinition>(`${root}/definitions/${id}/publish`, { token, method: "POST" }),
  archiveDefinition: (token: string, id: number) => adminRequest<KpiDefinition>(`${root}/definitions/${id}`, { token, method: "DELETE" }),
  reviseDefinition: (token: string, id: number) => adminRequest<KpiVersion>(`${root}/definitions/${id}/revisions`, { token, method: "POST" }),
  templates: (token: string, search = "") => adminRequest<KpiTemplate[]>(`${root}/templates?search=${encodeURIComponent(search)}`, { token }),
  createTemplate: (token: string, body: KpiDefinitionForm & { departmentClassification?: string }) => adminRequest<KpiTemplate>(`${root}/templates`, { token, method: "POST", body }),
  updateTemplate: (token: string, id: number, body: KpiDefinitionForm & { departmentClassification?: string }) => adminRequest<KpiTemplate>(`${root}/templates/${id}`, { token, method: "PATCH", body }),
  publishTemplate: (token: string, id: number) => adminRequest<KpiTemplate>(`${root}/templates/${id}/publish`, { token, method: "POST" }),
  createFromTemplate: (token: string, id: number, code: string) => adminRequest<KpiDefinition>(`${root}/templates/${id}/definitions`, { token, method: "POST", body: { code } }),
  periods: (token: string) => adminRequest<KpiPeriod[]>(`${root}/periods`, { token }),
  createPeriod: (token: string, body: { frequency: string; label: string; startDate: string; endDate: string }) => adminRequest<KpiPeriod>(`${root}/periods`, { token, method: "POST", body }),
  assignments: (token: string) => adminRequest<KpiAssignment[]>(`${root}/assignments`, { token }),
  createAssignment: (token: string, body: { definitionId: number; periodId: number; subjectType: string; subjectId: number; managerEmployeeId?: number; target: Record<string, unknown> }) => adminRequest<KpiAssignment>(`${root}/assignments`, { token, method: "POST", body }),
  assignment: (token: string, id: number) => adminRequest<KpiAssignment>(`${root}/assignments/${id}`, { token }),
  updateAssignment: (token: string, id: number, body: { status?: string; managerEmployeeId?: number }) => adminRequest<KpiAssignment>(`${root}/assignments/${id}`, { token, method: "PATCH", body }),
  reviseTarget: (token: string, id: number, target: Record<string, unknown>, reason: string) => adminRequest<KpiAssignment>(`${root}/assignments/${id}/targets`, { token, method: "POST", body: { target, reason } }),
  mine: (token: string) => adminRequest<KpiAssignment[]>(`${root}/me/assignments`, { token }),
}
