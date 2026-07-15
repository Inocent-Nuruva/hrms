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
  const [inputsMounted, setInputsMounted] = useState(false);
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

  useEffect(() => {
    const t = setTimeout(() => setInputsMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

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
    <div className="w-full">
      {!isDone ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            className="space-y-1"
            style={{
              opacity: inputsMounted ? 1 : 0,
              transform: inputsMounted ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 220ms ease, transform 220ms ease",
              transitionDelay: "60ms",
            }}
          >
            <label className="text-[10px] font-medium text-foreground">Email</label>
            <input
              type="email"
              value={email}
              autoComplete="username"
              onChange={(event) => {
                setEmail(event.target.value);
                if (loginError) setLoginError(null);
              }}
              placeholder="admin@company.com"
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div
            className="space-y-1"
            style={{
              opacity: inputsMounted ? 1 : 0,
              transform: inputsMounted ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 220ms ease, transform 220ms ease",
              transitionDelay: "140ms",
            }}
          >
            <label className="text-[10px] font-medium text-foreground">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (loginError) setLoginError(null);
                }}
                placeholder="Enter password"
                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 pr-9 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
          </div>

          {loginError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-[10px] text-destructive">
              {loginError}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px]">
            <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
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
                className="data-checked:bg-[#303194] data-checked:border-[#303194] focus-visible:ring-[#303194]/50"
              />
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#303194] px-3 text-[10px] font-semibold text-white transition-all hover:bg-[#252882] active:scale-[0.985] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
