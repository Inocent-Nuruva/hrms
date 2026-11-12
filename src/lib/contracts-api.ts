import { adminRequest } from "@/lib/admin-api"
import { API_BASE_URL, AUTH_STORAGE_KEYS } from "@/utils/constants"

export type ContractStatus =
  | "DRAFT"
  | "PENDING_HR_SIGNATURE"
  | "PENDING_EMPLOYEE_SIGNATURE"
  | "PENDING_VERIFICATION"
  | "SIGNED"
  | "CANCELLED"
  | "SUPERSEDED"
  | "TERMINATED"
  | "ISSUED"

export type ContractValidity =
  | "NOT_EFFECTIVE"
  | "NOT_STARTED"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "SUPERSEDED"
  | "TERMINATED"

export type ContractType = "UNSPECIFIED" | "FIXED_TERM" | "SPECIFIC_TASK"

export type ContractSection = {
  id: string
  heading: string
  body: string
  /** Template rule: true = may be left out of a contract; false = required. */
  optional?: boolean
  /** false = left out of this contract (or off by default in a template). */
  enabled?: boolean
  /** false = wording fixed by the template. */
  editable?: boolean
}

export type ContractRow = {
  id: number
  employeeId: number
  version: number
  referenceNo: string
  title: string
  contractType: ContractType
  startDate: string
  endDate: string | null
  status: ContractStatus
  validity?: ContractValidity
  employeeName?: string | null
  employeeNo?: string | null
  signatoryName?: string | null
  assignedSignatoryId: number | null
  jobTitle: string | null
  departmentName: string | null
  workLocation: string | null
  reportingManagerName: string | null
  probationMonths: number | null
  hoursOfWork: string | null
  salaryAmount: string | null
  salaryCurrency: string | null
  payFrequency: string | null
  benefits: string | null
  sections: ContractSection[]
  particulars: Record<string, unknown>
  documentId: number | null
  baseDocumentId: number | null
  baseDocumentSha256: string | null
  companySignedDocumentId: number | null
  companySignedSha256: string | null
  finalDocumentId: number | null
  pendingUploadDocumentId: number | null
  sentAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  lastRejectionReason: string | null
  endedAt: string | null
  endReason: string | null
  amendmentReason: string | null
  sourceMovementId: number | null
  templateId?: number | null
  /** D4: salary masked for this user. */
  salaryHidden?: boolean
  updatedAt: string
  createdAt: string
}

export type ContractSignatureRow = {
  id: number
  party: "COMPANY" | "EMPLOYEE"
  method: string
  verificationMethod: string
  signerName: string
  signerTitle: string | null
  signedAt: string
  verificationOutcome: string | null
  rejectionReason: string | null
}

export type ContractFileRow = {
  id: number
  document_type: string | null
  title: string
  file_name: string
  mime_type: string | null
  sha256: string | null
  created_at: string
  current: boolean
}

export type ContractDetail = ContractRow & {
  signatory: { id: number; displayName: string; jobTitle: string; isActive: boolean } | null
  signatures: ContractSignatureRow[]
  allowedActions: string[]
  canManage: boolean
  files: ContractFileRow[]
  signing: {
    my_party: "COMPANY" | "EMPLOYEE" | null
    digital_signing_enabled: boolean
    paper_signing_enabled: boolean
    current_document_id: number | null
    current_document_sha256: string | null
  }
}

export type Signatory = {
  id: number
  employeeId: number
  displayName: string
  jobTitle: string
  scopeNote: string | null
  isActive: boolean
  designatedAt: string
  revokedAt: string | null
  revokeReason: string | null
  employeeName: string | null
  employeeNo: string | null
  pendingCount: number
}

export type CompanyLegal = {
  legal_name: string | null
  address: string | null
  registration_number: string | null
  tin: string | null
  phone: string | null
  email: string | null
}

export type SignatoryRule = { signatory_id: number; grade_ids: number[]; position_ids: number[]; label: string | null }

export type ContractSettings = {
  digital_signing_enabled: boolean
  paper_signing_enabled: boolean
  default_signatory_id: number | null
  backup_signatory_id: number | null
  signatory_rules: SignatoryRule[]
  annual_leave_days: number
  notice_period: string
  governing_law: string
}

export type ContractSettingsResponse = { company_name: string; legal: CompanyLegal; contract_settings: ContractSettings }

export type ContractTemplate = {
  contract_type: ContractType
  label: string
  id: number | null
  title: string
  sections: ContractSection[]
  version: number
  is_default: boolean
  updated_at: string | null
}

export type PayrollContractWarnings = {
  payroll_run_id: number
  period_end_date: string
  warnings: Array<{
    employee_id: number
    employee_name: string
    employee_no: string | null
    code: "NO_SIGNED_CONTRACT" | "CONTRACT_EXPIRED" | "CONTRACT_EXPIRING"
    message: string
    contract_id: number | null
    end_date: string | null
  }>
  warnings_hash: string
  acknowledged: boolean
  acknowledged_at: string | null
}

export const CONTRACT_TOKENS = [
  "company_legal_name",
  "company_address",
  "company_registration_number",
  "company_tin",
  "employee_name",
  "employee_number",
  "employee_dob",
  "employee_age",
  "employee_sex",
  "employee_address",
  "employee_id_number",
  "employee_phone",
  "employee_email",
  "place_of_recruitment",
  "work_location",
  "job_title",
  "department",
  "reporting_manager",
  "job_description",
  "contract_type",
  "start_date",
  "end_date",
  "probation_months",
  "hours_of_work",
  "salary",
  "currency",
  "pay_frequency",
  "remuneration_method",
  "benefits",
  "annual_leave_days",
  "notice_period",
  "governing_law",
  "reference_no",
  "signatory_name",
  "signatory_title",
  "issue_date",
] as const

/** Access token from local storage (same source as the other dashboard views). */
export function readAccessToken(): string {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem("hrms.admin.accessToken")?.trim()
  if (direct) return direct
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens) ?? "{}") as Record<string, unknown>
    return String(stored.accessToken ?? stored.access_token ?? "")
  } catch {
    return ""
  }
}

const BASE = "/api/employment-contracts"
const post = <T>(token: string, path: string, body: unknown = {}) =>
  adminRequest<T>(path, { method: "POST", token, body, dedupe: false })
const patch = <T>(token: string, path: string, body: unknown) =>
  adminRequest<T>(path, { method: "PATCH", token, body, dedupe: false })
const put = <T>(token: string, path: string, body: unknown) =>
  adminRequest<T>(path, { method: "PUT", token, body, dedupe: false })

export function listContracts(
  token: string,
  query: { page?: number; limit?: number; q?: string; status?: string; validity?: string; employee_id?: number } = {},
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value))
  return adminRequest<{ data: ContractRow[]; total: number; page: number; limit: number }>(
    `${BASE}${params.size ? `?${params.toString()}` : ""}`,
    { token },
  )
}

export const getContract = (token: string, id: number) => adminRequest<ContractDetail>(`${BASE}/${id}`, { token })
export const listMyContracts = (token: string) => adminRequest<ContractRow[]>(`${BASE}/me`, { token })
export const getContractPrefill = (token: string, employeeId: number) =>
  adminRequest<Record<string, unknown>>(`${BASE}/prefill/${employeeId}`, { token })
export const createContractDraft = (token: string, body: Record<string, unknown>) => post<ContractRow>(token, BASE, body)
export const updateContractDraft = (token: string, id: number, body: Record<string, unknown>) =>
  patch<ContractRow>(token, `${BASE}/${id}`, body)
export const previewContract = (token: string, id: number) =>
  post<{ content_base64: string; file_name: string; missing_fields: string[] }>(token, `${BASE}/${id}/preview`)
export const sendContract = (token: string, id: number, assignedSignatoryId?: number | null) =>
  post<ContractRow>(token, `${BASE}/${id}/send`, assignedSignatoryId ? { assigned_signatory_id: assignedSignatoryId } : {})
export const cancelContract = (token: string, id: number, reason: string) =>
  post<ContractRow>(token, `${BASE}/${id}/cancel`, { reason })
export const renewContract = (
  token: string,
  id: number,
  body: { kind: "RENEWAL" | "AMENDMENT"; reason: string; start_date?: string; end_date?: string; contract_type?: ContractType; source_movement_id?: number },
) => post<ContractRow>(token, `${BASE}/${id}/renew`, body)
export const reassignContractSignatory = (token: string, id: number, signatoryId: number) =>
  patch<ContractRow>(token, `${BASE}/${id}/signatory`, { signatory_id: signatoryId })
export const verifyContractUpload = (token: string, id: number, outcome: "ACCEPT" | "REJECT", reason?: string) =>
  post<ContractRow>(token, `${BASE}/${id}/verify`, { outcome, reason })
export const attachContractPdf = (token: string, id: number, file: Base64File) =>
  post<Record<string, unknown>>(token, `${BASE}/${id}/document`, file)

export const requestSigningCode = (token: string, id: number) =>
  post<{ method: "TOTP" | "EMAIL_OTP"; party: "COMPANY" | "EMPLOYEE"; masked_email?: string; document_sha256: string }>(
    token,
    `${BASE}/${id}/sign/challenge`,
  )
export const signContractDigitally = (
  token: string,
  id: number,
  body: {
    document_sha256: string
    signature: { kind: "TYPED"; text: string } | { kind: "DRAWN"; png_base64: string }
    code: string
    consent: true
  },
) => post<ContractRow>(token, `${BASE}/${id}/sign`, body)
export const uploadSignedContract = (
  token: string,
  id: number,
  body: { file: Base64File; document_sha256: string; attest_on_behalf?: boolean },
) => post<ContractRow>(token, `${BASE}/${id}/signed-upload`, body)

export const getContractSettings = (token: string) => adminRequest<ContractSettingsResponse>(`${BASE}/settings`, { token })
export const updateCompanyLegal = (token: string, body: Partial<CompanyLegal>) =>
  put<ContractSettingsResponse>(token, `${BASE}/settings/legal`, body)
export const updateContractSigningSettings = (token: string, body: Partial<ContractSettings>) =>
  put<ContractSettingsResponse>(token, `${BASE}/settings/signing`, body)
export const listContractTemplates = (token: string) => adminRequest<ContractTemplate[]>(`${BASE}/templates`, { token })
export const saveContractTemplate = (
  token: string,
  body: { contract_type: ContractType; title: string; sections: ContractSection[] },
) => put<ContractTemplate>(token, `${BASE}/templates`, body)

export const listSignatories = (token: string) => adminRequest<Signatory[]>("/api/contract-signatories", { token })
export const mySignatoryStatus = (token: string) =>
  adminRequest<{ signatory: Signatory | null; pending: number }>("/api/contract-signatories/me", { token })
export const createSignatory = (
  token: string,
  body: { employee_id: number; display_name?: string; job_title?: string; scope_note?: string },
) => post<Signatory>(token, "/api/contract-signatories", body)
export const updateSignatory = (token: string, id: number, body: { display_name?: string; job_title?: string; scope_note?: string }) =>
  patch<Signatory>(token, `/api/contract-signatories/${id}`, body)
export const revokeSignatory = (token: string, id: number, reason: string) =>
  post<Signatory>(token, `/api/contract-signatories/${id}/revoke`, { reason })
export const reactivateSignatory = (token: string, id: number) =>
  post<Signatory>(token, `/api/contract-signatories/${id}/reactivate`)

export const getPayrollContractWarnings = (token: string, runId: number) =>
  adminRequest<PayrollContractWarnings>(`${BASE}/payroll-runs/${runId}/warnings`, { token })
export const acknowledgePayrollContractWarnings = (token: string, runId: number, warningsHash: string, note?: string) =>
  post<PayrollContractWarnings>(token, `${BASE}/payroll-runs/${runId}/warnings/acknowledge`, {
    warnings_hash: warningsHash,
    note,
  })

export type Base64File = { fileName: string; fileSize: number; mimeType: string; fileString: string }

export async function fileToBase64(file: File): Promise<Base64File> {
  const fileString = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "")
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"))
    reader.readAsDataURL(file)
  })
  return { fileName: file.name, fileSize: file.size, mimeType: file.type || "application/pdf", fileString }
}

/** Downloads a contract file (fingerprint-checked by the server). */
export async function fetchContractFile(token: string, id: number, documentId?: number | null) {
  const path = documentId ? `${BASE}/${id}/files/${documentId}` : `${BASE}/${id}/document`
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    let message = "The contract file could not be opened"
    try {
      const payload = (await response.json()) as { message?: unknown }
      if (typeof payload.message === "string") message = payload.message
    } catch {
      /* not JSON */
    }
    throw new Error(message)
  }
  const fileName =
    /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? `contract-${id}.pdf`
  return { blob: await response.blob(), sha256: response.headers.get("X-Document-SHA256"), fileName }
}

export function base64ToBlob(base64: string, type = "application/pdf") {
  const binary = atob(base64)
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], { type })
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

export type ContractField = {
  key: string
  automatic: string
  override: string | null
  value: string
  used: boolean
  /** Where a live draft took the value from, e.g. "Probation policy: Standard". */
  source?: string | null
  /** Needs HR attention, e.g. probation policy not in whole months. */
  warning?: string | null
  override_reason?: string | null
  /** true once sent: the value is frozen. */
  frozen?: boolean
  /** D4: salary hidden from this user (no payroll permission). */
  hidden?: boolean
  /** With `hidden`: whether a value exists behind the mask. */
  has_value?: boolean
}
export const getContractFields = (token: string, id: number) => adminRequest<ContractField[]>(`${BASE}/${id}/fields`, { token })

/** Plain-language names for template fields. */
export const CONTRACT_FIELD_LABELS: Record<string, string> = {
  company_legal_name: "Company legal name",
  company_address: "Company address",
  company_registration_number: "Company registration number",
  company_tin: "Company TIN",
  employee_name: "Employee full name",
  employee_number: "Employee number",
  employee_dob: "Date of birth",
  employee_age: "Age",
  employee_sex: "Sex",
  employee_address: "Employee address",
  employee_id_number: "ID number (NIDA / passport)",
  employee_phone: "Employee phone",
  employee_email: "Employee email",
  place_of_recruitment: "Place of recruitment",
  work_location: "Place of work",
  job_title: "Job title",
  department: "Department",
  reporting_manager: "Reports to",
  job_description: "Job description",
  contract_type: "Contract type",
  start_date: "Start date",
  end_date: "End date",
  probation_months: "Probation (months)",
  hours_of_work: "Hours of work",
  salary: "Basic salary",
  currency: "Currency",
  pay_frequency: "Pay frequency",
  remuneration_method: "Payment method",
  benefits: "Allowances and benefits",
  annual_leave_days: "Annual leave days",
  notice_period: "Notice period",
  governing_law: "Governing law",
  reference_no: "Contract reference",
  signatory_name: "Company signatory name",
  signatory_title: "Company signatory title",
  issue_date: "Issue date",
  grade: "Grade",
  employment_basis: "Employment basis (full-time / part-time)",
}

export type ContractActivityItem = {
  id: string
  kind: "history" | "security"
  at: string
  action: string
  title: string | null
  detail: string | null
  actor_name: string | null
  outcome: string
  changed_fields: string[]
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}
export const getContractActivity = (token: string, id: number) =>
  adminRequest<{ contract_id: number; items: ContractActivityItem[]; truncated?: boolean }>(`${BASE}/${id}/activity`, { token })

/** New draft copied from an existing contract (same employee). */
export const duplicateContract = (
  token: string,
  source: { id: number; employeeId: number; contractType: ContractType; startDate: string; endDate: string | null },
) =>
  createContractDraft(token, {
    employee_id: source.employeeId,
    contract_type: source.contractType,
    start_date: source.startDate,
    ...(source.endDate ? { end_date: source.endDate } : {}),
    from_contract_id: source.id,
  })

/** Live preview of unsaved editor state (not stored, not audited). */
export const previewContractDraft = (token: string, id: number, body: Record<string, unknown>) =>
  post<{ content_base64: string; file_name: string; missing_fields: string[]; warnings?: Record<string, string> }>(
    token,
    `${BASE}/${id}/preview`,
    body,
  )

export const CONTRACT_REF_KEYS = ["department_id", "position_id", "grade_id", "branch_id", "reports_to_id"] as const
export type ContractRefKey = (typeof CONTRACT_REF_KEYS)[number]
/** Template field each reference fills (override reasons use this key). */
export const CONTRACT_REF_TOKEN: Record<ContractRefKey, string> = {
  department_id: "department",
  position_id: "job_title",
  grade_id: "grade",
  branch_id: "work_location",
  reports_to_id: "reporting_manager",
}
