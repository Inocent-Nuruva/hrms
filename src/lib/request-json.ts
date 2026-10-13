import { z } from "zod";

export class ContractError extends Error {
  readonly status = 502;
  readonly statusCode = 502;
  constructor(
    message: string,
    public readonly issues: readonly z.core.$ZodIssue[] = [],
  ) {
    super(message);
    this.name = "ContractError";
  }
}
export class ApiError extends Error {
  readonly status: number;
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, string | string[]>,
    public readonly payload?: unknown,
    public readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = statusCode;
  }
}
export const RecordSchema = z.record(z.string(), z.unknown());
// Structural wire contract for endpoints whose domain fields remain dynamic.
// Invalid JSON, scalar HTML/text bodies, mixed record arrays and nonfinite numbers never succeed.
export const ApiResponseSchema = z.union([
  RecordSchema,
  z.array(RecordSchema),
  z.array(z.string().min(1)),
  z.null(),
  z.undefined(),
]);
export const EmptyResponseSchema = z.union([RecordSchema, z.undefined()]);

function record(value: unknown): Record<string, unknown> {
  return RecordSchema.safeParse(value).success ? RecordSchema.parse(value) : {};
}
function errorMessage(payload: unknown, status: number): string {
  const data = record(payload);
  const validation = record(data.errors).validation;
  const lines = Array.isArray(validation)
    ? validation.filter((value): value is string => typeof value === "string")
    : [];
  if (lines.length) return lines.join(". ");
  if (Array.isArray(data.message))
    return data.message.filter((value) => typeof value === "string").join(". ");
  if (typeof data.message === "string" && data.message.trim())
    return data.message;
  return status === 410
    ? "This reset link has expired or is no longer valid."
    : `Request failed with status ${status}`;
}

export async function requestJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<z.output<S>> {
  const response = await fetch(path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let raw: unknown;
  if (!text.trim()) raw = undefined;
  else {
    try {
      raw = JSON.parse(text);
    } catch {
      if (response.ok) throw new ContractError("The service returned an invalid JSON response.");
      raw = { message: text.slice(0, 2_000) };
    }
  }
  if (!response.ok) {
    const details = z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .safeParse(record(raw).details);
    throw new ApiError(
      errorMessage(raw, response.status),
      response.status,
      details.success ? details.data : undefined,
      raw,
      response.headers.get("retry-after"),
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new ContractError(
      "The service response does not match its expected contract.",
      result.error.issues,
    );
  return result.data;
}
