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

async function parseError(response: Response): Promise<ApiError> {
  let payload: ApiErrorResponse | null = null;

  try {
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text) as ApiErrorResponse;
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
  const message = payload?.message || fallback;
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
