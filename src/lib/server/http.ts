export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class ContractError extends HttpError {
  constructor(message: string) {
    super(502, message);
    this.name = "ContractError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")) {
    return Response.json({ error: "The request timed out or was cancelled." }, {
      status: error.name === "TimeoutError" ? 504 : 408,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json({ error: "The service is temporarily unavailable." }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export function backendUrl(path: string): URL {
  const configured = process.env.INTERNAL_BACKEND_URL?.trim() ||
    process.env.BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const origin = !configured || configured === "/api"
    ? process.env.APP_ENV === "uat" ? "http://127.0.0.1:9999" : "http://127.0.0.1:8888"
    : configured;
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new HttpError(503, "The backend origin is not configured correctly.");
  }
  const url = new URL(path, base.origin);
  if (!path.startsWith("/api/") || url.origin !== base.origin) {
    throw new HttpError(503, "The backend path is not configured correctly.");
  }
  return url;
}

/** Checks actual bytes before retaining each chunk; Content-Length is only an early rejection. */
export async function readLimitedBody(
  request: Request, maxBytes: number, timeoutMs = 15_000,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new HttpError(400, "Invalid content length.");
    if (Number(length) > maxBytes) throw new HttpError(413, "Request body is too large.");
  }
  if (request.headers.get("content-encoding") &&
      request.headers.get("content-encoding")?.toLowerCase() !== "identity") {
    throw new HttpError(415, "Compressed request bodies are not supported.");
  }
  if (!request.body) throw new HttpError(400, "Request body is required.");
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
  signal.throwIfAborted();
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (value.byteLength > maxBytes - size) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, "Request body is too large.");
      }
      size += value.byteLength;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
