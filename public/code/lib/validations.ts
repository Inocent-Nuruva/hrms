// ─────────────────────────────────────────────────────────────────────────────
// lib/validations.ts
// Zod schemas for all auth-flow inputs
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Email ────────────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .min(1, "Email address is required")
  .email("Please enter a valid email address")
  .toLowerCase()
  .trim();

// ── Phone (E.164 / Tanzania +255 format) ─────────────────────────────────────

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform((v) => v.replace(/\s+/g, ""))          // strip spaces
  .refine(
    (v) => /^\+?[0-9]{9,15}$/.test(v),
    "Please enter a valid phone number (e.g. +255 7XX XXX XXX)"
  );

// ── Contact (email OR phone) ──────────────────────────────────────────────────

export const contactSchema = z.union([emailSchema, phoneSchema]);

// ── Send-OTP form ─────────────────────────────────────────────────────────────

export const sendOTPSchema = z.object({
  contact: z.string().min(1, "Contact is required"),
  method: z.enum(["email", "phone"]),
}).superRefine(({ contact, method }, ctx) => {
  if (method === "email") {
    const result = emailSchema.safeParse(contact);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact"],
        message: result.error.errors[0]?.message ?? "Invalid email",
      });
    }
  } else {
    const result = phoneSchema.safeParse(contact);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact"],
        message: result.error.errors[0]?.message ?? "Invalid phone number",
      });
    }
  }
});

export type SendOTPInput = z.infer<typeof sendOTPSchema>;

// ── OTP code ──────────────────────────────────────────────────────────────────

export const otpCodeSchema = z
  .string()
  .length(6, "Verification code must be 6 digits")
  .regex(/^\d{6}$/, "Verification code must contain only digits");

// ── Verify-OTP form ───────────────────────────────────────────────────────────

export const verifyOTPSchema = z.object({
  contact: z.string().min(1, "Contact is required"),
  otp: otpCodeSchema,
});

export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;
