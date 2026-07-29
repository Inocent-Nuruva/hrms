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
import { env } from "./env";

const MOCK_DELAY_MS = env.NEXT_PUBLIC_MOCK_AUTH_DELAY_MS; // simulated network latency in dev/mock mode
const USE_MOCK = env.NEXT_PUBLIC_USE_MOCK_AUTH;

function unsupportedAuthFlow(message: string): never {
  throw new Error(message)
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
 * This legacy OTP helper flow is not exposed by the current backend API.
 */
export async function sendOTP(req: SendOTPRequest): Promise<SendOTPResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return mockSendOTP(req);
  }
  unsupportedAuthFlow(
    "Verification code delivery is not available in the current API. Use the main login and onboarding flow instead."
  );
}

/**
 * Verify the one-time passcode and exchange it for a session token.
 *
 * This legacy OTP verification flow is not exposed by the current backend API.
 */
export async function verifyOTP(req: VerifyOTPRequest): Promise<VerifyOTPResponse> {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS);
    return mockVerifyOTP(req);
  }
  unsupportedAuthFlow(
    "Verification code confirmation is not available in the current API. Use the main login and onboarding flow instead."
  );
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
