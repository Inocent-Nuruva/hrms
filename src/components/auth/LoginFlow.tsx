"use client";

import { FormEvent, useEffect, useState } from "react";
import { showSuccessAlert } from "@/lib/success-alert";
import { showErrorAlert } from "@/lib/error-alert";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";

interface LoginFlowProps {
  defaultEmail?: string;
  onSuccess?: (redirectUrl: string) => void;
}

export function LoginFlow({ defaultEmail = "", onSuccess }: LoginFlowProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false);
  const { login, isLoading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rememberedFlag = window.localStorage.getItem(AUTH_STORAGE_KEYS.rememberMe);
    const rememberedEmail = window.localStorage.getItem(AUTH_STORAGE_KEYS.rememberedEmail) ?? "";
    const shouldRemember = rememberedFlag === null ? true : rememberedFlag === "true";

    setRememberMe(shouldRemember);

    if (!defaultEmail && shouldRemember && rememberedEmail.trim()) {
      setEmail(rememberedEmail);
    }
  }, [defaultEmail]);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setLoginError(null);

    if (!normalizedEmail) {
      const message = "Email is required.";
      setLoginError(message);
      showErrorAlert(message, "Invalid credentials");
      return;
    }
    if (!password) {
      const message = "Password is required.";
      setLoginError(message);
      showErrorAlert(message, "Invalid credentials");
      return;
    }

    try {
      const response = await login({
        email: normalizedEmail,
        password,
      });

      if (response.requiresOtp) {
        const message = "This admin login accepts only email and password.";
        setLoginError(message);
        showErrorAlert(message, "Invalid credentials");
        return;
      }

      if (!response.tokens) {
        const message = "Login response did not include tokens.";
        setLoginError(message);
        showErrorAlert(message, "Invalid credentials");
        return;
      }

      if (typeof window !== "undefined") {
        if (rememberMe) {
          window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "true");
          window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberedEmail, normalizedEmail);
        } else {
          window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "false");
          window.localStorage.removeItem(AUTH_STORAGE_KEYS.rememberedEmail);
        }
      }

      setIsDone(true);
      showSuccessAlert("Login successful! Redirecting…", "Success");
      const redirect = "/dashboard";
      setTimeout(() => {
        if (onSuccess) onSuccess(redirect);
        else window.location.href = redirect;
      }, 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      setLoginError(message);
      showErrorAlert(message, "Invalid credentials");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <div
      style={{
        width: "100%",
      }}
    >
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
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1a1f36" }}>Email</label>
              <input
                className="transition-[box-shadow,border-color] focus:outline-none focus:ring-4 focus:ring-[#303194]/20 focus:border-[#303194]"
                type="email"
                value={email}
                autoComplete="username"
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (loginError) setLoginError(null);
                }}
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
                  className="transition-[box-shadow,border-color] focus:outline-none focus:ring-4 focus:ring-[#303194]/20 focus:border-[#303194]"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (loginError) setLoginError(null);
                  }}
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

            {loginError ? (
              <p
                style={{
                  margin: 0,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {loginError}
              </p>
            ) : null}

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
                onCheckedChange={(checked) => {
                  const nextValue = Boolean(checked);
                  setRememberMe(nextValue);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, String(nextValue));
                    if (!nextValue) {
                      window.localStorage.removeItem(AUTH_STORAGE_KEYS.rememberedEmail);
                    }
                  }
                }}
                className="border-[#c8d0ea] data-checked:border-[#303194] data-checked:bg-[#303194]"
              />
              Remember me
            </label>

            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => setIsHoveringSubmit(true)}
              onMouseLeave={() => setIsHoveringSubmit(false)}
              style={{
                position: "relative",
                overflow: "hidden",
                width: "100%",
                padding: 14,
                background: isLoading
                  ? "rgba(48,49,148,0.65)"
                  : isHoveringSubmit
                    ? "white"
                    : "#303194",
                color: isHoveringSubmit ? "#303194" : "white",
                border: "1px solid #303194",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--font)",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: isLoading ? "none" : "0 4px 14px rgba(48,49,148,0.4)",
                transition: "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {!isLoading ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: isHoveringSubmit ? "115%" : "-40%",
                    zIndex: 1,
                    height: "100%",
                    width: "35%",
                    transform: "skewX(-12deg)",
                    background: "rgba(255,255,255,0.25)",
                    opacity: isHoveringSubmit ? 1 : 0,
                    pointerEvents: "none",
                    transition: "all 0.5s",
                  }}
                />
              ) : null}
              <span style={{ position: "relative", zIndex: 2 }}>
              {isLoading ? "Signing in..." : "Sign In"}
              </span>
            </button>
          </form>
        ) : null}
      </div>

      {!isDone ? (
        <div
          style={{
            borderTop: "1px solid rgba(148, 163, 184, 0.25)",
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
      ) : null}
    </div>
  );
}
