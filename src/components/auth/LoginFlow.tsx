"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

interface LoginFlowProps {
  defaultEmail?: string;
  onSuccess?: (redirectUrl: string) => void;
}

export function LoginFlow({ defaultEmail = "", onSuccess }: LoginFlowProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Email is required.");
      return;
    }
    if (!password) {
      toast.error("Password is required.");
      return;
    }

    try {
      const response = await login({
        email: normalizedEmail,
        password,
      });

      if (response.requiresOtp) {
        toast.error("This admin login accepts only email and password.");
        return;
      }

      if (!response.tokens) {
        toast.error("Login response did not include tokens.");
        return;
      }

      setIsDone(true);
      toast.success("Login successful! Redirecting…");
      const redirect = "/dashboard";
      setTimeout(() => {
        if (onSuccess) onSuccess(redirect);
        else window.location.href = redirect;
      }, 900);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed. Please try again.");
    }
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 24,
        boxShadow: "0 8px 40px rgba(48,49,148,0.10), 0 2px 8px rgba(0,0,0,0.05)",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 4, background: "linear-gradient(90deg, #303194, #ed4348)" }} />

      <div style={{ padding: "40px 40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#1a1f36",
              lineHeight: 1.2,
              marginBottom: 6,
              margin: "0 0 6px",
            }}
          >
            HRMS Admin Portal
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
            Sign in with your admin credentials
          </p>
        </div>

        {!isDone ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1a1f36" }}>Email</label>
              <input
                type="email"
                value={email}
                autoComplete="username"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@company.com"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 14,
                  fontFamily: "var(--font)",
                  color: "#1a1f36",
                  background: "#fafafa",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1a1f36" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 14px",
                    border: "2px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: "var(--font)",
                    color: "#1a1f36",
                    background: "#fafafa",
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#4b5563",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                className="border-[#c8d0ea] data-checked:border-[#303194] data-checked:bg-[#303194]"
              />
              Remember me
            </label>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => void handleLogin()}
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
                boxShadow: isLoading ? "none" : "0 4px 14px rgba(237,67,72,0.40)",
                transition: "all 0.2s",
              }}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              marginTop: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "#d1fae5",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#1a1f36", marginBottom: 4 }}>
                You&apos;re signed in!
              </p>
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                Redirecting to your admin dashboard…
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid #f3f4f6",
          padding: "14px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
          Email + password authentication
        </span>
      </div>
    </div>
  );
}
