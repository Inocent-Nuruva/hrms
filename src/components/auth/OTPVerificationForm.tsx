"use client";

import { useState, useEffect, useRef } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import type { ContactMethod } from "@/types/auth";

interface OTPVerificationFormProps {
  sentTo: string;
  method: ContactMethod;
  onVerify: (otp: string) => void;
  onResend: () => void;
  onChangeContact: () => void;
  isLoading?: boolean;
  resendCooldownSeconds?: number;
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.18 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ResendIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: muted ? 0.5 : 1 }}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        border: "2.5px solid rgba(255,255,255,0.3)",
        borderTopColor: "white",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

function slotStyle(filled: boolean): React.CSSProperties {
  return {
    width: 52,
    height: 58,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "var(--font)",
    color: "#1a1f36",
    border: `2px solid ${filled ? "#303194" : "#e5e7eb"}`,
    borderRadius: 12,
    background: filled ? "#eef0fb" : "white",
    outline: "none",
    transition: "border-color 0.15s, background 0.15s",
    cursor: "text",
  };
}

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

  useEffect(() => {
    startCountdown();
    return () => stopCountdown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCountdown() {
    setResendTimer(resendCooldownSeconds);
    stopCountdown();
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { stopCountdown(); return 0; }
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

  const canVerify = !isLoading && otp.length === 6;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* "Code sent to" chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          background: "#f0f2f8",
          borderRadius: 10,
          border: "1px solid #e2e5f0",
        }}
      >
        <div style={{ color: "#303194", flexShrink: 0 }}>
          {method === "email" ? <EmailIcon /> : <PhoneIcon />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 1 }}>
            Code sent to
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#1a1f36",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sentTo}
          </div>
        </div>
        <button
          type="button"
          onClick={onChangeContact}
          style={{
            border: "none",
            background: "none",
            color: "#303194",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font)",
            flexShrink: 0,
          }}
        >
          Change
        </button>
      </div>

      {/* OTP field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#1a1f36" }}>
            Verification Code
          </label>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendTimer > 0}
            style={{
              border: "none",
              background: "none",
              color: resendTimer > 0 ? "#9ca3af" : "#303194",
              fontSize: 12,
              fontWeight: 600,
              cursor: resendTimer > 0 ? "not-allowed" : "pointer",
              fontFamily: "var(--font)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <ResendIcon muted={resendTimer > 0} />
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
          </button>
        </div>

        {/* 6-slot OTP — styled per design */}
        <div style={{ padding: "20px 0 8px", display: "flex", justifyContent: "center" }}>
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            onComplete={handleOTPComplete}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} style={slotStyle(!!otp[0])} />
              <InputOTPSlot index={1} style={slotStyle(!!otp[1])} />
              <InputOTPSlot index={2} style={slotStyle(!!otp[2])} />
            </InputOTPGroup>
            <InputOTPSeparator style={{ margin: "0 8px", width: 20, height: 2, background: "#d1d5db", borderRadius: 2 }} />
            <InputOTPGroup>
              <InputOTPSlot index={3} style={slotStyle(!!otp[3])} />
              <InputOTPSlot index={4} style={slotStyle(!!otp[4])} />
              <InputOTPSlot index={5} style={slotStyle(!!otp[5])} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <p style={{ fontSize: 12, textAlign: "center", color: "#9ca3af", margin: 0 }}>
          Enter the 6-digit code — it expires in 10 minutes
        </p>
      </div>

      {/* Verify button */}
      <button
        type="button"
        onClick={() => onVerify(otp)}
        disabled={!canVerify}
        style={{
          width: "100%",
          padding: 14,
          background: canVerify ? "#ed4348" : "rgba(237,67,72,0.38)",
          color: "white",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "var(--font)",
          cursor: canVerify ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: canVerify ? "0 4px 14px rgba(237,67,72,0.40)" : "none",
          transition: "all 0.2s",
        }}
      >
        {isLoading ? (
          <>
            <SpinnerIcon />
            Verifying…
          </>
        ) : (
          "Verify & Sign In"
        )}
      </button>
    </div>
  );
}
