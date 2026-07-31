import type { OnboardingStep } from "@/types";
import { env } from "@/lib/env";

/** Normalize API base (strip trailing /api if someone set full API root). */
export function resolveApiBaseUrl() {
  return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api$/i, "")
}

export const API_BASE_URL = resolveApiBaseUrl()

export const AUTH_STORAGE_KEYS = {
  tokens: "ess.auth.tokens",
  user: "ess.auth.user",
  rememberMe: "ess.auth.rememberMe",
  rememberedEmail: "ess.auth.rememberedEmail",
} as const;

export const ROUTES = {
  login: "/login",
  changePassword: "/change-password",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  onboarding: "/onboarding",
} as const;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "profile",
    title: "Profile Information",
    description: "Complete and confirm your personal profile details.",
    route: "/onboarding/profile",
  },
  {
    id: "documents",
    title: "Document Upload",
    description: "Upload required HR and compliance documents.",
    route: "/onboarding/documents",
  },
  {
    id: "banking",
    title: "Banking & Payroll",
    description: "Provide payroll and banking information for salary processing.",
    route: "/onboarding/banking",
  },
  {
    id: "review",
    title: "Final Review",
    description: "Review details and submit your onboarding package.",
    route: "/onboarding/review",
  },
];
