import { adminRequest } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
export type Question = {
  id: string
  label: string
  type:
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multiple_choice"
    | "yes_no"
    | "rating"
    | "number"
    | "date"
  required: boolean
  category?: string
  options?: string[]
}
export type FormDefinition = {
  title: string
  description: string
  kind: "survey" | "poll" | "data_collection"
  responseMode: "identified" | "anonymous"
  satisfaction: boolean
  questions: Question[]
  audience: { type: "all" | "branches" | "departments"; ids: number[] }
  schedule: {
    frequency: "once" | "weekly" | "monthly"
    timezone: string
    startDate: string
    time: string
    dayOfMonth?: number
    useLastDay?: boolean
    openDays: number
    endDate?: string
    occurrences?: number
    reminderDays?: number
  }
}
export type FeedbackForm = {
  id: string
  definition: FormDefinition
  status: string
  displayStatus?: string
  publishedMode: string | null
  nextOpenAt: string | null
  roundCount: number
}
export type FeedbackRound = {
  id: string
  definition: FormDefinition
  opensAt: string
  closesAt: string
  submitted?: boolean | number
  eligible?: number
}
export type Page<T> = { rows: T[]; total: number; page: number; limit: number }
export type Results = Page<{
  answers: Record<string, unknown>
  employee?: { id: number; name: string; employeeNo: string } | null
}> & {
  round: FeedbackRound
  eligible: number
  withheld: boolean
  summary: { question: string; answer: unknown; count: string }[]
}
export function formsRequest<T>(
  path: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: unknown,
) {
  return adminRequest<T>(`/api/${path}`, {
    token: readStoredSessionTokens().accessToken,
    method,
    body,
  })
}
export const identityNotice = (mode: FormDefinition["responseMode"]) =>
  mode === "anonymous"
    ? "Your identity is not linked to your answers. Your response is final and cannot be changed after submission. Avoid including identifying details in your answers."
    : "Your name and employee details will be included with your response. Review your answers before submitting."
export const newDefinition = (): FormDefinition => ({
  title: "",
  description: "",
  kind: "survey",
  responseMode: "anonymous",
  satisfaction: false,
  questions: [],
  audience: { type: "all", ids: [] },
  schedule: {
    frequency: "once",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    startDate: new Date().toLocaleDateString("en-CA"),
    time: "09:00",
    openDays: 7,
    dayOfMonth: 23,
    useLastDay: true,
  },
})
