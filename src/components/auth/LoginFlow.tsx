"use client";

import { FormEvent, useEffect, useState } from "react";
import { showErrorAlert } from "@/lib/error-alert";
import { EyeIcon, EyeOffIcon, ShieldCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { SecurityScanLoader } from "@/components/ui/security-scan-loader";
import { useAuth } from "@/hooks/useAuth";
import {
  markDashboardFromLogin,
  prefetchDashboardWarmCache,
} from "@/lib/dashboard-warm-cache";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";

interface LoginFlowProps {
  defaultEmail?: string;
  onSuccess?: (redirectUrl: string) => void;
}

type LoginStep = "credentials" | "two-factor";

/** TOTP (6 digits) or backup codes: 10 hex / 5-5 hex per API pattern. */
function normalizeTwoFactorCode(value: string) {
  const trimmed = value.trim();
  if (/^\d{0,6}$/.test(trimmed.replace(/\s/g, ""))) {
    return trimmed.replace(/\D/g, "").slice(0, 6);
  }
  // Allow backup-code shape while typing (hex + optional dash).
  return trimmed.replace(/[^A-Fa-f0-9-]/g, "").slice(0, 11);
}

function isValidTwoFactorCode(value: string) {
  return /^(\d{6}|[A-Fa-f0-9]{10}|[A-Fa-f0-9]{5}-[A-Fa-f0-9]{5})$/.test(value.trim());
}

export function LoginFlow({ defaultEmail = "", onSuccess }: LoginFlowProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const [inputsMounted, setInputsMounted] = useState(false);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const { login, completeOtpLogin, isLoading } = useAuth();

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

  const finishLogin = async (accessToken: string, normalizedEmail: string) => {
    if (typeof window !== "undefined") {
      if (rememberMe) {
        window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "true");
        window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberedEmail, normalizedEmail);
      } else {
        window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "false");
        window.localStorage.removeItem(AUTH_STORAGE_KEYS.rememberedEmail);
      }
    }

    // Hide form; keep loader only here while dashboard data is prefetched.
    setIsDone(true);
    markDashboardFromLogin();

    try {
      // Cap wait so a slow network still opens the app; snapshot is best-effort.
      await Promise.race([
        prefetchDashboardWarmCache(accessToken),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 10_000);
        }),
      ]);
    } catch {
      // Still redirect — dashboard will load normally if warm cache failed.
    }

    const redirect = "/dashboard";
    if (onSuccess) onSuccess(redirect);
    else window.location.href = redirect;
  };

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
        if (!response.tempToken) {
          const message =
            "Two-factor authentication is required, but no temporary token was returned. Please try again.";
          setLoginError(message);
          showErrorAlert(message, "2FA required");
          return;
        }
        setTempToken(response.tempToken);
        setTwoFactorCode("");
        setStep("two-factor");
        setLoginError(null);
        return;
      }

      if (!response.tokens) {
        const message = "Login response did not include tokens.";
        setLoginError(message);
        showErrorAlert(message, "Invalid credentials");
        return;
      }

      await finishLogin(response.tokens.accessToken, normalizedEmail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      setLoginError(message);
      showErrorAlert(message, "Invalid credentials");
    }
  };

  const handleVerifyTwoFactor = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setLoginError(null);

    if (!tempToken) {
      const message = "Your 2FA session expired. Please sign in again.";
      setLoginError(message);
      showErrorAlert(message, "2FA expired");
      setStep("credentials");
      return;
    }

    const code = twoFactorCode.trim();
    if (!isValidTwoFactorCode(code)) {
      const message = "Enter a valid 6-digit authenticator code or backup code.";
      setLoginError(message);
      showErrorAlert(message, "Invalid code");
      return;
    }

    try {
      const response = await completeOtpLogin(tempToken, code);
      await finishLogin(response.tokens.accessToken, normalizedEmail);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "2FA verification failed. Please try again.";
      setLoginError(message);
      showErrorAlert(message, "2FA verification failed");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "two-factor") {
      void handleVerifyTwoFactor();
      return;
    }
    void handleLogin();
  };

  const handleBackToCredentials = () => {
    setStep("credentials");
    setTempToken(null);
    setTwoFactorCode("");
    setLoginError(null);
  };

  if (isDone) {
    return (
      <div
        className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 py-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <SecurityScanLoader />
        <div className="space-y-1 text-center">
          <p className="text-xs font-medium text-foreground">Checking your access…</p>
          <p className="text-[10px] text-muted-foreground">
            Verifying permissions and signing you in securely
          </p>
        </div>
      </div>
    );
  }

  if (step === "two-factor") {
    return (
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-medium text-foreground">Two-factor authentication</p>
              <p className="text-[10px] text-muted-foreground">
                Enter the code from your authenticator app
                {email.trim() ? (
                  <>
                    {" "}
                    for <span className="font-medium text-foreground">{email.trim()}</span>
                  </>
                ) : null}
                .
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="two-factor-code" className="text-[10px] font-medium text-foreground">
              Authentication code
            </label>
            <input
              id="two-factor-code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              value={twoFactorCode}
              onChange={(event) => {
                setTwoFactorCode(normalizeTwoFactorCode(event.target.value));
                if (loginError) setLoginError(null);
              }}
              placeholder="123456"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-center font-mono text-sm tracking-[0.25em] text-foreground ring-offset-background placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
            <p className="text-[10px] text-muted-foreground">
              6-digit app code, or a backup code if you have one.
            </p>
          </div>

          {loginError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[10px] text-destructive dark:border-destructive/40 dark:bg-destructive/15">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !isValidTwoFactorCode(twoFactorCode)}
            className="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-[10px] font-semibold text-primary-foreground transition-all hover:bg-[var(--brand-blue-dark)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Verifying..." : "Verify & continue"}
          </button>

          <button
            type="button"
            onClick={handleBackToCredentials}
            disabled={isLoading}
            className="inline-flex h-8 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-[10px] font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
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
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:placeholder:text-muted-foreground/70"
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
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 pr-9 text-xs text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:placeholder:text-muted-foreground/70"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
            </button>
          </div>
        </div>

        {loginError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[10px] text-destructive dark:border-destructive/40 dark:bg-destructive/15">
            {loginError}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px]">
          <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
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
              className="data-checked:border-primary data-checked:bg-primary focus-visible:ring-primary/50"
            />
            Remember me
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-[10px] font-semibold text-primary-foreground transition-all hover:bg-[var(--brand-blue-dark)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
