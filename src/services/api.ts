import type { ApiErrorResponse } from "@/types";
import { API_BASE_URL } from "@/utils/constants";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  statusCode: number;
  details?: ApiErrorResponse["details"];

  constructor(message: string, statusCode: number, details?: ApiErrorResponse["details"]) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function validationLines(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !("errors" in payload)) {
    return [];
  }
  const validation = (payload as { errors?: { validation?: unknown } }).errors?.validation;
  if (!Array.isArray(validation)) {
    return [];
  }
  return validation.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) {
      return [entry.trim()];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as { property?: unknown; constraints?: unknown };
    const property = typeof record.property === "string" ? record.property : "";
    const constraints =
      record.constraints && typeof record.constraints === "object"
        ? Object.values(record.constraints).filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
    return constraints.map((text) => (property ? `${property}: ${text}` : text));
  });
}

function readableApiMessage(message: string | undefined, validation: string[], fallback: string) {
  const generic = !message || message === "Bad Request" || message === "Validation failed";
  if (generic && validation.length > 0) {
    return validation.join(". ");
  }
  return message || fallback;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: ApiErrorResponse | null = null;
  let raw: unknown = null;

  try {
    const text = await response.text();
    if (text) {
      try {
        raw = JSON.parse(text);
        payload = raw as ApiErrorResponse;
      } catch {
        payload = { message: text };
      }
    }
  } catch {
    payload = null;
  }

  const fallback =
    response.status === 410
      ? "This reset link has expired or is no longer valid."
      : response.status === 400
        ? "Please check the details you entered and try again."
        : `Request failed with status ${response.status}`;
  const message = readableApiMessage(payload?.message, validationLines(raw), fallback);
  return new ApiError(message, response.status, payload?.details);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, headers, signal } = options;

  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  // 204 No Content, or 200/201 with empty body (e.g. "Password reset successful").
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Plain-text success bodies are treated as successful with no payload.
    return undefined as T;
  }
}
