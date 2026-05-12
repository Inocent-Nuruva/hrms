// ─────────────────────────────────────────────────────────────────────────────
// components/auth/LoginFlow.tsx
// Orchestrates the two-step magic-link → OTP verification flow.
// Drop this into any page/layout — it is self-contained.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MagicLinkRequestForm } from "./MagicLinkRequestForm";
import { OTPVerificationForm } from "./OTPVerificationForm";
import { useMagicLink } from "@/hooks/useMagicLink";
import { useOTPVerification } from "@/hooks/useOTPVerification";
import type { ContactMethod, LoginStep } from "@/types/auth";

// ── Step progress indicator ───────────────────────────────────────────────────

function StepDots({ step }: { step: LoginStep }) {
  const index = step === "request" ? 0 : step === "verify" ? 1 : 2;
  return (
    <div className="flex items-center justify-center gap-2 mb-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: i === index ? "24px" : "8px",
            background:
              i < index
                ? "#10b981"
                : i === index
                ? "#303194"
                : "#e5e7eb",
          }}
        />
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface LoginFlowProps {
  /** Pre-fill contact from URL param (?email=...) */
  defaultEmail?: string;
  /** Called after successful verification; override for custom routing */
  onSuccess?: (redirectUrl: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LoginFlow({
  defaultEmail = "",
  onSuccess,
}: LoginFlowProps) {
  const [step, setStep] = useState<LoginStep>("request");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const [contactValue, setContactValue] = useState(defaultEmail);
  const [sentTo, setSentTo] = useState("");

  const { sendOTP, isLoading: isSending } = useMagicLink();
  const { verifyOTP, isLoading: isVerifying } = useOTPVerification();

  // ── Step 1: send OTP ────────────────────────────────────────────────────────

  const handleSendOTP = async (contact: string, method: ContactMethod) => {
    try {
      await sendOTP(contact, method);
      setContactMethod(method);
      setContactValue(contact);
      setSentTo(contact);
      setStep("verify");
      toast.success(`Verification code sent to your ${method}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to send code. Please try again."
      );
    }
  };

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────

  const handleVerifyOTP = async (otp: string) => {
    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }
    try {
      const result = await verifyOTP(sentTo, otp);
      if (result.success) {
        setStep("done");
        toast.success("Login successful! Redirecting…");
        const redirect = result.redirectUrl ?? "/onboarding/dashboard";
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(redirect);
          } else {
            window.location.href = redirect;
          }
        }, 1500);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Invalid code. Please try again."
      );
    }
  };

  // ── Resend ──────────────────────────────────────────────────────────────────

  const handleResend = async () => {
    try {
      await sendOTP(sentTo, contactMethod);
      toast.success(`New code sent to ${sentTo}`);
    } catch {
      toast.error("Could not resend. Please try again.");
    }
  };

  // ── Subtitle copy ───────────────────────────────────────────────────────────

  const subtitle =
    step === "request"
      ? "Sign in to complete your onboarding"
      : step === "verify"
      ? `Enter the code sent to your ${contactMethod}`
      : "Verification complete — welcome aboard!";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Card className="w-full max-w-md mx-auto rounded-2xl shadow-lg border-0 overflow-hidden">
      {/* Top accent gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-[#303194] to-[#ed4348]" />

      <CardHeader className="text-center space-y-2 pt-8 pb-0">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          {/* Replace src with your real logo path */}
          <img
            src="/assets/alliance-logo.png"
            alt="Alliance Insurance"
            className="h-16 w-auto object-contain"
          />
        </div>
        <CardTitle className="text-2xl font-bold text-slate-800">
          Employee Self-Service Portal
        </CardTitle>
        <CardDescription className="text-slate-500">{subtitle}</CardDescription>
        <StepDots step={step} />
      </CardHeader>

      <CardContent className="pt-6 pb-0">
        {step === "request" && (
          <MagicLinkRequestForm
            defaultContact={defaultEmail}
            onSuccess={handleSendOTP}
            isLoading={isSending}
          />
        )}

        {step === "verify" && (
          <OTPVerificationForm
            sentTo={sentTo}
            method={contactMethod}
            onVerify={handleVerifyOTP}
            onResend={handleResend}
            onChangeContact={() => setStep("request")}
            isLoading={isVerifying}
          />
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-7 w-7 text-emerald-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">You're signed in!</p>
              <p className="text-sm text-slate-500">Redirecting to your dashboard…</p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-center pb-8 pt-6">
        {step !== "done" && (
          <a
            href="/help"
            className="text-sm font-medium text-[#303194] hover:underline"
          >
            Need help? Contact HR
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
