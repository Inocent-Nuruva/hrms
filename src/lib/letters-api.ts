import { adminRequest } from "@/lib/admin-api"
import { API_BASE_URL } from "@/utils/constants"

/** Employee Letters module client (contract: /api/letters/*). */

export const LETTER_TYPES = [
  "OFFER",
  "APPOINTMENT",
  "CONFIRMATION",
  "PROBATION_EXTENSION",
  "PROBATION_NOT_CONFIRMED",
  "PROMOTION",
  "SALARY_INCREMENT",
  "TRANSFER",
  "EMPLOYMENT_VERIFICATION",
  "CONTRACT_RENEWAL",
  "ACTING_APPOINTMENT",
  "WARNING",
  "TERMINATION",
  "CERTIFICATE_OF_SERVICE",
  "CUSTOM",
] as const
export type LetterType = (typeof LETTER_TYPES)[number]

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  OFFER: "Employment offer letter",
  APPOINTMENT: "Appointment letter",
  CONFIRMATION: "Employment confirmation letter",
  PROBATION_EXTENSION: "Probation extension letter",
  PROBATION_NOT_CONFIRMED: "Probation outcome letter (not confirmed)",
  PROMOTION: "Promotion letter",
  SALARY_INCREMENT: "Salary increment letter",
  TRANSFER: "Employee transfer letter",
  EMPLOYMENT_VERIFICATION: "Employment verification letter",
  CONTRACT_RENEWAL: "Contract renewal letter",
  ACTING_APPOINTMENT: "Acting appointment letter",
  WARNING: "Warning letter",
  TERMINATION: "Termination letter",
  CERTIFICATE_OF_SERVICE: "Certificate of service",
  CUSTOM: "Custom letter",
}

export function letterTypeLabel(type: string | null | undefined) {
  return (type && LETTER_TYPE_LABELS[type as LetterType]) || type || "Letter"
}

export function isLetterType(value: string | null | undefined): value is LetterType {
  return Boolean(value && (LETTER_TYPES as readonly string[]).includes(value))
}

export type LetterStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ISSUED"
  | "CANCELLED"
  | "SUPERSEDED"

export const LETTER_STATUSES: LetterStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ISSUED",
  "CANCELLED",
  "SUPERSEDED",
]

export type LetterStatusTone = "neutral" | "primary" | "success" | "warning" | "danger"

export const LETTER_STATUS_META: Record<LetterStatus, { label: string; tone: LetterStatusTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "primary" },
  REJECTED: { label: "Rejected", tone: "danger" },
  ISSUED: { label: "Issued", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  SUPERSEDED: { label: "Superseded", tone: "neutral" },
}

export function letterStatusMeta(status: string | null | undefined): { label: string; tone: LetterStatusTone } {
  return LETTER_STATUS_META[status as LetterStatus] ?? { label: status || "Unknown", tone: "neutral" }
}

export type LetterExtraFieldKind = "text" | "textarea" | "date" | "money" | "number" | "select"
export type LetterExtraField = {
  key: string
  label: string
  kind: LetterExtraFieldKind
  required: boolean
  options?: string[] | Array<{ value: string; label: string }>
}
export type LetterTypeInfo = {
  type: LetterType
  label: string
  recipient: "employee" | "candidate_or_employee"
  default_requires_approval: boolean
  extra_fields: LetterExtraField[]
}
export type LetterPlaceholder = { key: string; label: string; group: string; confidential: boolean }
export type LetterCatalogue = { letter_types: LetterTypeInfo[]; placeholders: LetterPlaceholder[] }

export type RecipientKind = "employee" | "candidate"
export type LetterRecipient = {
  kind: RecipientKind
  id: number
  name: string
  employee_no: string | null
  department: string | null
  position: string | null
  email: string | null
  status: string | null
}

export type LetterTemplate = {
  id: number
  letter_type: LetterType
  name: string
  subject: string
  salutation: string
  body: string
  closing: string
  signatory_id: number | null
  signatory_name: string | null
  signatory_title: string | null
  requires_approval: boolean
  include_acknowledgement: boolean
  is_active: boolean
  is_default: boolean
  current_version: number
  updated_at: string
  updated_by_name: string | null
  versions?: LetterTemplateVersion[]
}
export type LetterTemplateVersion = {
  id: number
  version: number
  created_at: string
  created_by_name?: string | null
  snapshot?: Partial<LetterTemplate>
}
export type LetterTemplateInput = Partial<
  Pick<
    LetterTemplate,
    | "letter_type"
    | "name"
    | "subject"
    | "salutation"
    | "body"
    | "closing"
    | "signatory_id"
    | "signatory_name"
    | "signatory_title"
    | "requires_approval"
    | "include_acknowledgement"
    | "is_active"
    | "is_default"
  >
>

export type LetterCan = {
  edit: boolean
  submit: boolean
  approve: boolean
  reject: boolean
  issue: boolean
  cancel: boolean
  revise: boolean
  download: boolean
}
export type LetterEvent = {
  id: number
  action: string
  actor_name?: string | null
  note: string | null
  created_at: string
}
export type Letter = {
  id: number
  reference_no: string
  letter_type: LetterType
  letter_type_label: string
  status: LetterStatus
  template_id: number | null
  template_version: number | null
  template_name: string | null
  employee_id: number | null
  candidate_id: number | null
  recipient_kind: RecipientKind
  recipient_name: string
  employee_no: string | null
  recipient_address?: string | null
  subject: string
  salutation: string
  body: string
  closing: string
  extra_values: Record<string, string>
  signatory_name: string | null
  signatory_title: string | null
  requires_approval: boolean
  include_acknowledgement: boolean
  missing_placeholders: string[]
  submitted_at: string | null
  submitted_by_name: string | null
  approved_at: string | null
  approved_by_name: string | null
  rejected_at: string | null
  rejection_reason: string | null
  issued_at: string | null
  issued_by_name: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  revision_of_letter_id: number | null
  superseded_by_letter_id: number | null
  document_id: number | null
  emailed_at: string | null
  created_at: string
  updated_at: string
  can: LetterCan
  events?: LetterEvent[]
}
export type LetterListMeta = { total: number; page: number; limit: number; totalPages?: number }
export type LetterInput = {
  letter_type?: LetterType
  template_id?: number
  employee_id?: number
  candidate_id?: number
  extra_values?: Record<string, string>
  subject?: string
  salutation?: string
  body?: string
  closing?: string
  recipient_address?: string
}

const BASE = "/api/letters"
const post = <T>(token: string, path: string, body: unknown = {}) =>
  adminRequest<T>(path, { method: "POST", token, body, dedupe: false })
const patch = <T>(token: string, path: string, body: unknown) =>
  adminRequest<T>(path, { method: "PATCH", token, body, dedupe: false })

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

export const getLetterCatalogue = (token: string) =>
  adminRequest<LetterCatalogue>(`${BASE}/catalogue`, { token, cacheTtlMs: 60_000 })

export const searchLetterRecipients = (
  token: string,
  q: string,
  kind: RecipientKind | "any" = "employee",
  limit = 10,
  signal?: AbortSignal,
) => adminRequest<LetterRecipient[]>(`${BASE}/recipients/search${query({ q, kind, limit })}`, { token, signal })

export const getRecipientValues = (token: string, kind: RecipientKind, id: number) =>
  adminRequest<{ values: Record<string, string>; missing: string[] }>(`${BASE}/recipients/${kind}/${id}/values`, { token })

// Templates
export const listLetterTemplates = (
  token: string,
  params: { letter_type?: LetterType | ""; include_inactive?: boolean } = {},
) => adminRequest<LetterTemplate[]>(`${BASE}/templates${query(params)}`, { token })
export const getLetterTemplate = (token: string, id: number) =>
  adminRequest<LetterTemplate>(`${BASE}/templates/${id}`, { token })
export const createLetterTemplate = (token: string, body: LetterTemplateInput) =>
  post<LetterTemplate>(token, `${BASE}/templates`, body)
export const updateLetterTemplate = (token: string, id: number, body: LetterTemplateInput) =>
  patch<LetterTemplate>(token, `${BASE}/templates/${id}`, body)
export const duplicateLetterTemplate = (token: string, id: number) =>
  post<LetterTemplate>(token, `${BASE}/templates/${id}/duplicate`)
export const activateLetterTemplate = (token: string, id: number) =>
  post<LetterTemplate>(token, `${BASE}/templates/${id}/activate`)
export const deactivateLetterTemplate = (token: string, id: number) =>
  post<LetterTemplate>(token, `${BASE}/templates/${id}/deactivate`)
export const setDefaultLetterTemplate = (token: string, id: number) =>
  post<LetterTemplate>(token, `${BASE}/templates/${id}/default`)
export const listLetterTemplateVersions = (token: string, id: number) =>
  adminRequest<LetterTemplateVersion[]>(`${BASE}/templates/${id}/versions`, { token })

// Letters
export const listLetters = (
  token: string,
  params: {
    status?: LetterStatus | ""
    letter_type?: LetterType | ""
    employee_id?: number
    candidate_id?: number
    search?: string
    page?: number
    limit?: number
  } = {},
) => adminRequest<{ data: Letter[]; meta: LetterListMeta }>(`${BASE}${query(params)}`, { token })
export const getLetter = (token: string, id: number) => adminRequest<Letter>(`${BASE}/${id}`, { token })
export const createLetter = (token: string, body: LetterInput) => post<Letter>(token, BASE, body)
export const updateLetter = (token: string, id: number, body: LetterInput) => patch<Letter>(token, `${BASE}/${id}`, body)
export const submitLetter = (token: string, id: number) => post<Letter>(token, `${BASE}/${id}/submit`)
export const approveLetter = (token: string, id: number, note?: string) =>
  post<Letter>(token, `${BASE}/${id}/approve`, note ? { note } : {})
export const rejectLetter = (token: string, id: number, reason: string) =>
  post<Letter>(token, `${BASE}/${id}/reject`, { reason })
export const issueLetter = (token: string, id: number, sendEmail: boolean) =>
  post<Letter>(token, `${BASE}/${id}/issue`, { send_email: sendEmail })
export const cancelLetter = (token: string, id: number, reason: string) =>
  post<Letter>(token, `${BASE}/${id}/cancel`, { reason })
export const reviseLetter = (token: string, id: number) => post<Letter>(token, `${BASE}/${id}/revise`)

/** Error from a PDF endpoint; `missing` lists unresolved placeholders when the API reports them. */
export class LetterPdfError extends Error {
  status: number
  missing: string[]
  constructor(message: string, status: number, missing: string[] = []) {
    super(message)
    this.status = status
    this.missing = missing
  }
}

async function fetchPdf(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  })
  if (!response.ok) {
    let message = "The letter PDF could not be produced"
    let missing: string[] = []
    try {
      const payload = (await response.json()) as { message?: unknown; missing_placeholders?: unknown }
      if (typeof payload.message === "string") message = payload.message
      else if (Array.isArray(payload.message)) message = payload.message.join(", ")
      if (Array.isArray(payload.missing_placeholders)) missing = payload.missing_placeholders.map(String)
    } catch {
      /* not JSON */
    }
    throw new LetterPdfError(message, response.status, missing)
  }
  const fileName = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "letter.pdf"
  return { blob: await response.blob(), fileName }
}

export const previewLetterTemplatePdf = (
  token: string,
  id: number,
  body: { employee_id?: number; candidate_id?: number; extra_values?: Record<string, string> } = {},
) => fetchPdf(token, `${BASE}/templates/${id}/preview`, { method: "POST", body: JSON.stringify(body) })
export const previewLetterPdf = (token: string, id: number) => fetchPdf(token, `${BASE}/${id}/preview`)
export const downloadLetterPdf = (token: string, id: number) => fetchPdf(token, `${BASE}/${id}/download`)

/** Placeholder keys used in a text, in first-seen order. */
export function placeholdersIn(...texts: Array<string | null | undefined>) {
  const keys: string[] = []
  for (const text of texts) {
    for (const match of (text ?? "").matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
      if (!keys.includes(match[1])) keys.push(match[1])
    }
  }
  return keys
}
