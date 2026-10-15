import { z } from "zod";
import { backendUrl, ContractError, HttpError, readLimitedBody } from "./http";

const Snapshot = z.object({
  id: z.number().int().positive().safe(),
  companyId: z.number().int().positive().safe().optional(),
  employeeId: z.number().int().positive().safe().optional(),
  scope: z.enum(["platform", "company"]),
  userType: z.enum(["OWNER", "COMPANY_USER"]),
  dashboardType: z.enum(["admin", "employee"]).optional(),
  roles: z.array(z.string()).max(1_000),
  permissions: z.array(z.string()).max(10_000),
});

export type ServerSession = z.infer<typeof Snapshot> & { accessToken: string };

/** Uses the live Nest JWT/session guard. Never trusts decoded JWTs or browser actor metadata. */
export async function requireSession(request: Request): Promise<ServerSession> {
  const authorization = request.headers.get("authorization");
  let token: string;
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization);
    if (!match) throw new HttpError(401, "A valid bearer session is required.");
    token = match[1];
  } else {
    // Cookie-authenticated mutations require the browser's same-origin provenance.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      throw new HttpError(403, "A same-origin request is required.");
    }
    const cookie = request.headers.get("cookie")?.split(";")
      .map((entry) => entry.trim()).find((entry) => entry.startsWith("hrms_dashboard_token="));
    try { token = cookie ? decodeURIComponent(cookie.slice("hrms_dashboard_token=".length)) : ""; }
    catch { throw new HttpError(401, "A valid session is required."); }
  }
  if (!token || token.length > 16_384) throw new HttpError(401, "Sign in to continue.");
  const response = await fetch(backendUrl("/api/auth/session"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(response.status, "Your session does not authorize this request.");
    }
    throw new HttpError(503, "Session verification is temporarily unavailable.");
  }
  const bytes = await readLimitedBody(new Request("http://internal/session", {
    method: "POST", body: response.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" }), 512_000);
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ContractError("The session service returned an invalid response."); }
  const parsed = Snapshot.safeParse(payload);
  if (!parsed.success) throw new ContractError("The session service returned an invalid snapshot.");
  return { ...parsed.data, accessToken: token };
}
