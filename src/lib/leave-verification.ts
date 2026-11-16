import { env } from "@/lib/env";

export type LeaveVerificationStatus =
  | "valid"
  | "expired"
  | "pending"
  | "returned"
  | "rejected"
  | "cancelled"
  | "revoked";

export type PublicLeaveVerification = {
  verification_status: LeaveVerificationStatus;
  company: { name: string; logo_data_url: string | null };
  employee_name: string;
  employee_no: string;
  department_name: string | null;
  leave_no: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: string;
  approval_status: string;
  approved_at: string | null;
  checked_at: string;
};

export type LeaveVerificationResult =
  | { kind: "found"; data: PublicLeaveVerification }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "error" };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function apiUrl(path: string) {
  const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "").replace(/\/api$/i, "");
  return `${base}/api${path}`;
}

/**
 * Public, unauthenticated lookup. The token is sent in the body so it stays
 * out of API access logs. No auth headers or cookies are attached.
 */
export async function lookupLeaveVerification(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<LeaveVerificationResult> {
  if (!TOKEN_PATTERN.test(token)) return { kind: "not_found" };
  try {
    const response = await fetcher(apiUrl("/leave/verification/lookup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "omit",
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 400) {
      return { kind: "not_found" };
    }
    if (response.status === 429) return { kind: "rate_limited" };
    if (!response.ok) return { kind: "error" };
    const payload = (await response.json()) as
      | PublicLeaveVerification
      | { data: PublicLeaveVerification };
    const data = "data" in payload && payload.data ? payload.data : payload;
    return { kind: "found", data: data as PublicLeaveVerification };
  } catch {
    return { kind: "error" };
  }
}
