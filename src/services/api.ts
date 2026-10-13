import { z } from "zod";
import { API_BASE_URL } from "@/utils/constants";
import { requestJson } from "@/lib/request-json";

export { ApiError } from "@/lib/request-json";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}
function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  const { method = "GET", body, token, headers, signal } = options;
  return requestJson(buildUrl(path), schema, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}
