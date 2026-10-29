import { z } from "zod";
import { ApiError, RecordSchema } from "@/lib/request-json";
export const FinanceInputSchema = z.object({
  product_id: z.number().int().positive(),
  requested_amount: z
    .string()
    .max(18)
    .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/),
  requested_term_months: z.number().int().min(1).max(600),
  purpose: z.string().trim().min(1),
});
export const FinanceCheckpointSchema = z.object({
  payload: FinanceInputSchema,
  form: z.record(z.string(), z.string()),
  requiredDocuments: z.array(z.string()),
  guarantorIds: z.array(z.number().int().positive()),
  autoSubmit: z.boolean(),
  draftId: z.string().nullable(),
  startedAt: z.number(),
  creationPending: z.boolean(),
  completedDocuments: z.array(z.string()),
  completedGuarantors: z.array(z.number().int().positive()),
  submitted: z.boolean(),
});
export type FinanceCheckpoint = z.output<typeof FinanceCheckpointSchema>;
type RecordData = z.output<typeof RecordSchema>;
export interface FinanceWorkflowApi {
  create: (payload: z.output<typeof FinanceInputSchema>) => Promise<string>;
  applications: () => Promise<RecordData[]>;
  documents: (id: string) => Promise<RecordData[]>;
  guarantors: (id: string) => Promise<RecordData[]>;
  upload: (id: string, type: string, file: File) => Promise<unknown>;
  addGuarantor: (id: string, employeeId: number) => Promise<unknown>;
  submit: (id: string) => Promise<unknown>;
}

const GUARANTOR_FORM_PREFIX = "GUARANTOR_FORM::";

function completedDocumentKey(row: RecordData) {
  const type = String(row.documentType ?? row.document_type ?? "")
    .trim()
    .toUpperCase();
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const guarantorId = Number(
    metadata.guarantor_employee_id ?? metadata.guarantorEmployeeId,
  );
  if (
    type === "GUARANTOR_FORM" &&
    Number.isSafeInteger(guarantorId) &&
    guarantorId > 0
  ) {
    return `${GUARANTOR_FORM_PREFIX}${guarantorId}`;
  }
  return type;
}
function amountKey(value: unknown): string | null {
  const parsed = z
    .string()
    .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
    .safeParse(value);
  if (!parsed.success) return null;
  const [whole, fraction = ""] = parsed.data.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export async function resumeFinanceDraft(
  initial: FinanceCheckpoint,
  files: Record<string, File | null>,
  api: FinanceWorkflowApi,
  save: (checkpoint: FinanceCheckpoint) => void,
  isActive: () => boolean,
): Promise<FinanceCheckpoint> {
  let state = FinanceCheckpointSchema.parse(initial);
  const check = () => {
    if (!isActive())
      throw new DOMException("Finance workflow superseded.", "AbortError");
  };
  const commit = (next: FinanceCheckpoint) => {
    check();
    state = next;
    save(state);
  };
  check();
  if (!state.draftId) {
    if (state.creationPending) {
      const rows = await api.applications();
      check();
      const matches = rows.filter((row) => {
        const created = Date.parse(
          String(row.createdAt ?? row.created_at ?? ""),
        );
        return (
          Number(row.productId ?? row.product_id) ===
            state.payload.product_id &&
          amountKey(row.requestedAmount ?? row.requested_amount) ===
            amountKey(state.payload.requested_amount) &&
          Number(row.requestedTermMonths ?? row.requested_term_months) ===
            state.payload.requested_term_months &&
          row.purpose === state.payload.purpose &&
          Number.isFinite(created) &&
          created >= state.startedAt - 5_000
        );
      });
      if (matches.length !== 1 || !matches[0].id) {
        throw new Error(
          "The draft creation result is unconfirmed. Refresh your applications and retry recovery; a second draft will not be created.",
        );
      }
      commit({
        ...state,
        draftId: String(matches[0].id),
        creationPending: false,
      });
    } else {
      commit({ ...state, creationPending: true });
      let draftId: string;
      try {
        draftId = await api.create(state.payload);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 408
        ) {
          commit({ ...state, creationPending: false });
        }
        throw error;
      }
      check();
      if (!draftId)
        throw new Error(
          "The server did not identify the created draft. Retry recovery.",
        );
      commit({ ...state, draftId, creationPending: false });
    }
  }
  const id = state.draftId!;
  const [documents, guarantors, applications] = await Promise.all([
    api.documents(id),
    api.guarantors(id),
    api.applications(),
  ]);
  check();
  const current = applications.find((row) => String(row.id) === id);
  if (!current)
    throw new Error("The saved application is no longer available.");
  const status = String(current.status ?? "").toUpperCase();
  if (!["DRAFT", "RETURNED_FOR_CORRECTION"].includes(status)) {
    if (["WITHDRAWN", "REJECTED", "CANCELLED", "EXPIRED"].includes(status)) {
      throw new Error(
        "This application cannot be resumed. Review it in your applications.",
      );
    }
    commit({ ...state, submitted: true });
    return state;
  }
  commit({
    ...state,
    completedDocuments: documents
      .filter(
        (row) =>
          !["REJECTED", "DELETED"].includes(String(row.status).toUpperCase()),
      )
      .map(completedDocumentKey),
    completedGuarantors: guarantors
      .map((row) =>
        Number(row.guarantorEmployeeId ?? row.guarantor_employee_id),
      )
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  });
  for (const type of state.requiredDocuments) {
    check();
    if (state.completedDocuments.includes(type)) continue;
    const file = files[type];
    if (!file)
      throw new Error(
        `Choose the missing ${type} document to continue your draft.`,
      );
    await api.upload(id, type, file);
    check();
    commit({
      ...state,
      completedDocuments: [...state.completedDocuments, type],
    });
  }
  for (const employeeId of state.guarantorIds) {
    check();
    if (state.completedGuarantors.includes(employeeId)) continue;
    await api.addGuarantor(id, employeeId);
    check();
    commit({
      ...state,
      completedGuarantors: [...state.completedGuarantors, employeeId],
    });
  }
  if (state.autoSubmit && !state.submitted) {
    await api.submit(id);
    check();
    commit({ ...state, submitted: true });
  }
  return state;
}
