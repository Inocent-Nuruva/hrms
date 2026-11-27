import { env } from "@/lib/env";

export type LetterVerificationStatus = "valid" | "cancelled" | "superseded" | "revoked" | "not_found";

/** Public, redacted lookup result: never contains the body, salary or reasons. */
export type PublicLetterVerification = {
  status: LetterVerificationStatus;
  company_name: string;
  company_logo: string | null;
  reference_no: string;
  letter_type_label: string;
  issued_at: string | null;
  recipient_name: string;
  employee_no: string | null;
  checked_at: string;
};

export type LetterVerificationResult =
  | { kind: "found"; data: PublicLetterVerification }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "error" };

/** 32 random bytes, base64url without padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function apiUrl(path: string) {
  const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "").replace(/\/api$/i, "");
  return `${base}/api${path}`;
}

/**
 * Public, unauthenticated lookup of an issued letter. The token travels in the
 * body so it stays out of access logs; no auth headers or cookies are sent.
 */
export async function lookupLetterVerification(
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<LetterVerificationResult> {
  if (!TOKEN_PATTERN.test(token)) return { kind: "not_found" };
  try {
    const response = await fetcher(apiUrl("/letters/verification/lookup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "omit",
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 400) return { kind: "not_found" };
    if (response.status === 429) return { kind: "rate_limited" };
    if (!response.ok) return { kind: "error" };
    const payload = (await response.json()) as PublicLetterVerification | { data: PublicLetterVerification };
    const data = ("data" in payload && payload.data ? payload.data : payload) as PublicLetterVerification;
    if (!data || data.status === "not_found") return { kind: "not_found" };
    return { kind: "found", data };
  } catch {
    return { kind: "error" };
  }
}
