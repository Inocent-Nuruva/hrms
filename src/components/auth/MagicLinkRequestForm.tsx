"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { sendOTPSchema, type SendOTPInput } from "@/lib/validations";
import type { ContactMethod } from "@/types/auth";

interface MagicLinkRequestFormProps {
  defaultContact?: string;
  onSuccess: (contact: string, method: ContactMethod) => void;
  isLoading?: boolean;
}

function EmailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.18 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
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

export function MagicLinkRequestForm({
  defaultContact = "",
  onSuccess,
  isLoading = false,
}: MagicLinkRequestFormProps) {
  const [method, setMethod] = useState<ContactMethod>("email");
  const [inputFocused, setInputFocused] = useState(false);

  const form = useForm<SendOTPInput>({
    resolver: zodResolver(sendOTPSchema),
    defaultValues: { contact: defaultContact, method: "email" },
  });

  const onSubmit = (values: SendOTPInput) => {
    onSuccess(values.contact, values.method);
  };

  const handleMethodChange = (m: ContactMethod) => {
    setMethod(m);
    form.setValue("method", m);
    form.setValue("contact", "");
    form.clearErrors("contact");
  };

  const contactError = form.formState.errors.contact?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 20 }} noValidate>

      {/* Email / SMS segmented toggle */}
      <div
        style={{
          display: "flex",
          background: "#f1f3f9",
          borderRadius: 10,
          padding: 4,
          gap: 4,
        }}
      >
        {(["email", "phone"] as ContactMethod[]).map((m) => {
          const active = method === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleMethodChange(m)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                fontFamily: "var(--font)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                background: active ? "white" : "transparent",
                color: active ? "#303194" : "#9ca3af",
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {m === "email" ? <EmailIcon /> : <PhoneIcon />}
              {m === "email" ? "Email" : "SMS"}
            </button>
          );
        })}
      </div>

      {/* Contact input */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#1a1f36" }}>
          {method === "email" ? "Email Address" : "Phone Number"}
        </label>

        <div style={{ position: "relative" }}>
          {/* Leading icon */}
          <div
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: inputFocused ? "#303194" : "#9ca3af",
              transition: "color 0.15s",
              pointerEvents: "none",
            }}
          >
            {method === "email" ? <EmailIcon /> : <PhoneIcon />}
          </div>

          <input
            {...form.register("contact")}
            type={method === "email" ? "email" : "tel"}
            placeholder={method === "email" ? "you@alliance.co.tz" : "+255 7XX XXX XXX"}
            autoFocus
            autoComplete={method === "email" ? "email" : "tel"}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => e.key === "Enter" && form.handleSubmit(onSubmit)()}
            style={{
              width: "100%",
              padding: "12px 14px 12px 42px",
              border: `2px solid ${inputFocused ? "#303194" : "#e5e7eb"}`,
              borderRadius: 10,
              fontSize: 14,
              fontFamily: "var(--font)",
              color: "#1a1f36",
              background: inputFocused ? "white" : "#fafafa",
              outline: "none",
              transition: "border-color 0.15s, background 0.15s",
            }}
          />
        </div>

        {contactError ? (
          <p style={{ fontSize: 12, color: "#ed4348", margin: 0 }}>{contactError}</p>
        ) : (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            {method === "email"
              ? "A 6-digit code will be sent to your email"
              : "A 6-digit code will be sent via SMS"}
          </p>
        )}
      </div>

      {/* Hidden method field */}
      <input type="hidden" {...form.register("method")} />

      {/* Send button */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: "100%",
          padding: 14,
          background: isLoading ? "rgba(237,67,72,0.6)" : "#ed4348",
          color: "white",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "var(--font)",
          cursor: isLoading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: isLoading ? "none" : "0 4px 14px rgba(237,67,72,0.40)",
          transition: "all 0.2s",
        }}
      >
        {isLoading ? (
          <>
            <SpinnerIcon />
            Sending…
          </>
        ) : (
          <>
            Send Magic Link
            <ArrowRightIcon />
          </>
        )}
      </button>
    </form>
  );
}
