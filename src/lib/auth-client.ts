// ─────────────────────────────────────────────────────────────────────────────
// lib/auth-client.ts
// API client for the ESS auth endpoints
// Replace BASE_URL and implement real fetch calls for production.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SendOTPRequest,
  SendOTPResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
} from "../types/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const MOCK_DELAY_MS = 1500; // simulated network latency in dev/mock mode
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true";

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",            // send cookies for session-based auth
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json?.message ?? message;
    } catch {}
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function mockSendOTP(req: SendOTPRequest): SendOTPResponse {
  console.info(`[mock] OTP sent to ${req.contact} via ${req.method}`);
  return { success: true, message: "OTP sent successfully", otpSent: true, expiresInSeconds: 600 };
}

function mockVerifyOTP(req: VerifyOTPRequest): VerifyOTPResponse {
  // Accept any 6-digit code in mock mode
  if (req.otp.length === 6) {
    return {
      success: true,
      token: "mock-jwt-token-" + Date.now(),
      redirectUrl: "/onboarding/dashboard",
      user: {
        id: "emp_mock_001",
        fullName: "New Employee",
        email: req.contact.includes("@") ? req.contact : "employee@alliance.co.tz",
        phone: req.contact.includes("@") ? undefined : req.contact,
        employeeId: "EMP-2025-001",
        department: "Human Resources",
        onboardingStatus: "in_progress",
      },
    };
  }
  throw new Error("Invalid OTP code");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a one-time passcode to the given contact.
 *
 * POST /api/auth/send-otp
 * Body: { contact: string, method: "email" | "phone" }
 */
export async function sendOTP(req: SendOTPRequest): Promise<SendOTPResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return mockSendOTP(req);
  }
  return apiFetch<SendOTPResponse>("/api/auth/send-otp", req);
}

/**
 * Verify the one-time passcode and exchange it for a session token.
 *
 * POST /api/auth/verify-otp
 * Body: { contact: string, otp: string }
 */
export async function verifyOTP(req: VerifyOTPRequest): Promise<VerifyOTPResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return mockVerifyOTP(req);
  }
  return apiFetch<VerifyOTPResponse>("/api/auth/verify-otp", req);
}

/**
 * Store the auth token returned by verifyOTP.
 * Adjust storage strategy to match your session/cookie setup.
 */
export function storeToken(token: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("ess_auth_token", token);
  }
}

/**
 * Retrieve the stored auth token.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("ess_auth_token");
}

/**
 * Clear the stored auth token (logout).
 */
export function clearToken(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("ess_auth_token");
  }
}
