import { ONBOARDING_STEPS } from "./constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function hasMinLength(value: string, minLength: number): boolean {
  return value.trim().length >= minLength;
}

export function validatePasswordPolicy(password: string): string[] {
  const issues: string[] = [];

  if (password.length < 8) {
    issues.push("Password must be at least 8 characters.");
  }

  if (!/[A-Z]/.test(password)) {
    issues.push("Password must include an uppercase letter.");
  }

  if (!/[a-z]/.test(password)) {
    issues.push("Password must include a lowercase letter.");
  }

  if (!/[0-9]/.test(password)) {
    issues.push("Password must include a number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push("Password must include a special character.");
  }

  return issues;
}

export function isOnboardingStep(step: string): boolean {
  return ONBOARDING_STEPS.some((item) => item.id === step);
}
