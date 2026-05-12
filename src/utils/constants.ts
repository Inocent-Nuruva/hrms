import type { OnboardingStep } from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://192.168.1.30:8888";

export const AUTH_STORAGE_KEYS = {
  tokens: "ess.auth.tokens",
  user: "ess.auth.user",
} as const;

export const ROUTES = {
  login: "/login",
  changePassword: "/change-password",
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
