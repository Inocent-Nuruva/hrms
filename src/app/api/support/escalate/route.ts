import "server-only";

import { ContractError, errorResponse, HttpError, readLimitedBody } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escalationUrl(): URL {
  const configured = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:4000";
  let origin: URL;
  try { origin = new URL(configured); }
  catch { throw new HttpError(503, "INTERNAL_BACKEND_URL must be an absolute HTTP(S) URL."); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.search || origin.hash || !["/", "/api", "/api/"].includes(origin.pathname)) {
    throw new HttpError(503, "INTERNAL_BACKEND_URL must identify an absolute backend origin.");
  }
  const destination = new URL("/api/support/escalate", origin.origin);
  if (destination.origin !== origin.origin) throw new HttpError(503, "Invalid support service destination.");
  return destination;
}

function backendMessage(payload: Record<string, unknown>, fallback: string): string {
  for (const key of ["message", "error"]) {
    const candidate = payload[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 2_000);
    if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === "string")) {
      return candidate.join(". ").slice(0, 2_000) || fallback;
    }
  }
  return fallback;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization) || authorization.length > 16_384) {
      throw new HttpError(401, "Sign in to send this chat to IT support.");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new HttpError(415, "Send your support request as JSON.");
    }
    const destination = escalationUrl();
    if (destination.origin === new URL(request.url).origin) {
      throw new HttpError(503, "The support backend cannot point to this frontend.");
    }
    const bytes = await readLimitedBody(request, 320_000);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new HttpError(400, "Describe what you need help with using valid JSON."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "A support request object is required.");
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
    const response = await fetch(destination, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    const responseBytes = await readLimitedBody(new Request("http://internal/escalation-result", {
      method: "POST", body: response.body, signal, duplex: "half",
    } as RequestInit & { duplex: "half" }), 256_000);
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes)); }
    catch { throw new ContractError("The support service returned an invalid response."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ContractError("The support service returned an invalid response.");
    }
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? response.status : 502;
      const message = status === 502 ? "The support service is temporarily unavailable."
        : backendMessage(payload as Record<string, unknown>, "Could not email IT support.");
      const result = Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
      const retryAfter = response.headers.get("retry-after");
      if (status === 429 && retryAfter && /^\d{1,6}$/.test(retryAfter)) result.headers.set("Retry-After", retryAfter);
      return result;
    }
    return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
