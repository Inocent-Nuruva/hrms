// ─────────────────────────────────────────────────────────────────────────────
// types/auth.ts
// TypeScript interfaces for the ESS Magic-Link + OTP auth flow
// ─────────────────────────────────────────────────────────────────────────────

export type ContactMethod = "email" | "phone";

export type LoginStep = "request" | "verify" | "done";

// ── Request payload ──────────────────────────────────────────────────────────

export interface SendOTPRequest {
  contact: string;          // email address OR phone number
  method: ContactMethod;    // which channel to use
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  otpSent: true;
  expiresInSeconds?: number; // default 600 (10 min)
}

// ── Verify payload ───────────────────────────────────────────────────────────

export interface VerifyOTPRequest {
  contact: string;
  otp: string;              // 6-digit code
}

export interface VerifyOTPResponse {
  success: boolean;
  token?: string;           // JWT / session token
  redirectUrl?: string;     // e.g. "/onboarding/dashboard"
  user?: AuthUser;
}

// ── User shape returned after successful login ────────────────────────────────

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  employeeId: string;
  department?: string;
  onboardingStatus: OnboardingStatus;
}

export type OnboardingStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "completed";

// ── Form state ───────────────────────────────────────────────────────────────

export interface LoginFormState {
  step: LoginStep;
  contactMethod: ContactMethod;
  contactValue: string;
  otpCode: string;
  isLoading: boolean;
  resendTimer: number;        // seconds remaining before resend allowed
  sentTo: string;             // the address/number the OTP was actually sent to
  error: string | null;
}

// ── Hook return types ────────────────────────────────────────────────────────

export interface UseMagicLinkReturn {
  sendOTP: (contact: string, method: ContactMethod) => Promise<SendOTPResponse>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

export interface UseOTPVerificationReturn {
  verifyOTP: (contact: string, otp: string) => Promise<VerifyOTPResponse>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}
