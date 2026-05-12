// ─────────────────────────────────────────────────────────────────────────────
// components/auth/OTPVerificationForm.tsx
// Step 2: 6-digit OTP entry, resend cooldown, verify button
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, Loader2, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

import type { ContactMethod } from "@/types/auth";

// ── Props ─────────────────────────────────────────────────────────────────────

interface OTPVerificationFormProps {
  sentTo: string;                           // address/number OTP was sent to
  method: ContactMethod;
  onVerify: (otp: string) => void;
  onResend: () => void;
  onChangeContact: () => void;
  isLoading?: boolean;
  resendCooldownSeconds?: number;           // default 30
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OTPVerificationForm({
  sentTo,
  method,
  onVerify,
  onResend,
  onChangeContact,
  isLoading = false,
  resendCooldownSeconds = 30,
}: OTPVerificationFormProps) {
  const [otp, setOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(resendCooldownSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start countdown on mount
  useEffect(() => {
    startCountdown();
    return () => stopCountdown();
  }, []);

  function startCountdown() {
    setResendTimer(resendCooldownSeconds);
    stopCountdown();
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          stopCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopCountdown() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const handleResend = () => {
    if (resendTimer > 0) return;
    onResend();
    startCountdown();
  };

  const handleOTPComplete = (value: string) => {
    setOtp(value);
    onVerify(value);
  };

  const ContactIcon = method === "email" ? Mail : Phone;

  return (
    <div className="space-y-6">

      {/* "Sent to" chip */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <ContactIcon className="h-4 w-4 shrink-0 text-[#303194]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Code sent to
          </p>
          <p className="truncate text-sm font-semibold text-slate-800">{sentTo}</p>
        </div>
        <button
          type="button"
          onClick={onChangeContact}
          className="shrink-0 text-xs font-semibold text-[#303194] hover:underline"
        >
          Change
        </button>
      </div>

      {/* OTP field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Verification Code</Label>

          {/* Resend button */}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="flex items-center gap-1 text-xs font-semibold text-[#303194] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${resendTimer > 0 ? "opacity-50" : ""}`} />
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
          </button>
        </div>

        {/* 6-slot OTP input */}
        <div className="flex justify-center py-4">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            onComplete={handleOTPComplete}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="h-12 w-11 rounded-lg border-slate-200 text-xl" />
              <InputOTPSlot index={1} className="h-12 w-11 rounded-lg border-slate-200 text-xl" />
              <InputOTPSlot index={2} className="h-12 w-11 rounded-lg border-slate-200 text-xl" />
            </InputOTPGroup>
            <InputOTPSeparator className="mx-2 text-slate-300" />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="h-12 w-11 rounded-lg border-slate-200 text-xl" />
              <InputOTPSlot index={4} className="h-12 w-11 rounded-lg border-slate-200 text-xl" />
              <InputOTPSlot index={5} className="h-12 w-11 rounded-lg border-slate-200 text-xl" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <p className="text-center text-xs text-slate-400">
          Enter the 6-digit code — it expires in 10 minutes
        </p>
      </div>

      {/* Verify button */}
      <Button
        type="button"
        onClick={() => onVerify(otp)}
        disabled={isLoading || otp.length !== 6}
        className="w-full bg-[#ed4348] hover:bg-[#d93a3f] text-white rounded-lg py-6 font-semibold disabled:opacity-40"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verifying…
          </>
        ) : (
          "Verify & Sign In"
        )}
      </Button>
    </div>
  );
}
