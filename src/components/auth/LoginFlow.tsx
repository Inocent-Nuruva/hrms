"use client";

import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { Button, Checkbox, Field, Input, Link, Spinner } from "@fluentui/react-components";
import { Eye20Regular, EyeOff20Regular } from "@fluentui/react-icons";
import { ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { startBrowserSso } from "@/services/sso";
import { markDashboardFromLogin } from "@/lib/dashboard-login-flag";
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants";
import type { AuthScope, DashboardType } from "@/types";

interface LoginFlowProps {
  initialChallenge?: string;
  defaultEmail?: string;
  nextPath?: string;
  onSuccess?: (redirectUrl: string) => void;
}

function safeNextPath(value: string | undefined) {
  if (!value) return "/dashboard"
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/dashboard"
  }
  if (path.startsWith("/dashboard") || path.startsWith("/onboarding")) {
    return path
  }
  return "/dashboard"
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

function readableAuthError(error: unknown, fallback: string) {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "We couldn’t connect to the sign-in service. Check your connection and try again.";
  }
  if (error instanceof Error && /failed to fetch|network request failed/i.test(error.message)) {
    return "We couldn’t connect to the sign-in service. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

export function LoginFlow({ initialChallenge, defaultEmail = "", nextPath, onSuccess }: LoginFlowProps) {
  const homePath = safeNextPath(nextPath)
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "password" | "code" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [ssoOpen,setSsoOpen]=useState(false);
  const [company,setCompany]=useState("");
  const [ssoBusy,setSsoBusy]=useState(false);
  const [ssoError,setSsoError]=useState("");
  const [isDone, setIsDone] = useState(false);
  const [inputsMounted, setInputsMounted] = useState(false);
  const [step, setStep] = useState<LoginStep>(initialChallenge ? "two-factor" : "credentials");
  const [tempToken, setTempToken] = useState<string | null>(initialChallenge ?? null);
  /** Email bound to the current 2FA challenge — never reuse a previous account's email. */
  const [twoFactorAccountEmail, setTwoFactorAccountEmail] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const { login, completeOtpLogin, isLoading, clearSession } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined" || initialChallenge) {
      return;
    }

    const rememberedFlag = window.localStorage.getItem(AUTH_STORAGE_KEYS.rememberMe);
    const rememberedEmail = window.localStorage.getItem(AUTH_STORAGE_KEYS.rememberedEmail) ?? "";
    const shouldRemember = rememberedFlag === null ? true : rememberedFlag === "true";

    setRememberMe(shouldRemember);

    if (!defaultEmail && shouldRemember && rememberedEmail.trim()) {
      setEmail(rememberedEmail);
    }
  }, [defaultEmail, initialChallenge]);

  useEffect(() => {
    const t = setTimeout(() => setInputsMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const finishLogin = async (
    _accessToken: string,
    normalizedEmail: string,
    redirect: string,
    dashboardType?: DashboardType,
    scope?: AuthScope,
  ) => {
    if (typeof window !== "undefined") {
      if (rememberMe) {
        window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "true");
        window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberedEmail, normalizedEmail);
      } else {
        window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "false");
        window.localStorage.removeItem(AUTH_STORAGE_KEYS.rememberedEmail);
      }
    }

    // Show the access loader, then open the app. Dashboard data loads on the
    // destination page so sign-in does not compile or wait on the admin API.
    setIsDone(true);
    if (redirect === "/dashboard" && dashboardType !== "employee" && scope !== "platform") {
      markDashboardFromLogin();
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 400);
    });

    if (onSuccess) onSuccess(redirect);
    else window.location.href = redirect;
  };

  const showCredentialError = (message: string) => {
    const readable = message
      .replace(/email must be an email/gi, "Enter a valid email address.")
      .replace(/email should not be empty/gi, "Email is required.")
      .replace(/password must be longer than or equal to 6 characters/gi, "Password must be at least 6 characters.")
      .replace(/password should not be empty/gi, "Password is required.")
      .replace(/^Bad Request\.?\s*/i, "")
      .trim();
    const text = readable || "Please check the email and password and try again.";
    const emailOnly = /email/i.test(text) && !/password/i.test(text);
    setErrorField(emailOnly ? "email" : "password");
    setLoginError(text);
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setLoginError(null);
    setErrorField(null);
    // Drop any prior session (e.g. forced password-change then browser Back) so a
    // second account cannot inherit the previous user's identity in the UI/storage.
    clearSession();
    setTempToken(null);
    setTwoFactorAccountEmail("");
    setTwoFactorCode("");
    setStep("credentials");

    if (!normalizedEmail) {
      setErrorField("email");
      setLoginError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorField("email");
      setLoginError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorField("password");
      setLoginError("Password is required.");
      return;
    }
    if (password.length < 6) {
      setErrorField("password");
      setLoginError("Password must be at least 6 characters.");
      return;
    }

    try {
      const response = await login({
        email: normalizedEmail,
        password,
      });

      if (response.requiresOtp) {
        if (!response.tempToken) {
          setErrorField("password");
          setLoginError(
            "Two-factor authentication is required, but no temporary token was returned. Please try again.",
          );
          return;
        }
        // Prefer the email used for this attempt; fall back to API user email if present.
        const challengeEmail =
          (response.user?.email && String(response.user.email).trim()) || normalizedEmail;
        setEmail(challengeEmail);
        setTwoFactorAccountEmail(challengeEmail);
        setTempToken(response.tempToken);
        setTwoFactorCode("");
        setStep("two-factor");
        setLoginError(null);
        setErrorField(null);
        return;
      }

      if (!response.tokens) {
        const message =
          response.message ??
          (response.requiresEmailVerification
            ? "Please verify your email address before continuing."
            : "Login response did not include tokens.");
        showCredentialError(message);
        return;
      }

      if (response.requiresPasswordChange || response.user?.requiresPasswordChange) {
        await finishLogin(
          response.tokens.accessToken,
          normalizedEmail,
          `${ROUTES.changePassword}?required=1&next=${encodeURIComponent(homePath)}`,
          response.dashboardType,
          response.scope,
        );
        return;
      }

      await finishLogin(
        response.tokens.accessToken,
        normalizedEmail,
        homePath,
        response.dashboardType,
        response.scope,
      );
    } catch (err) {
      showCredentialError(readableAuthError(err, "We couldn’t sign you in. Please try again."));
    }
  };

  const handleVerifyTwoFactor = async () => {
    const accountEmail = (twoFactorAccountEmail || email).trim().toLowerCase();
    setLoginError(null);

    if (!tempToken) {
      setErrorField("password");
      setLoginError("Your 2FA session expired. Please sign in again.");
      setStep("credentials");
      setTwoFactorAccountEmail("");
      return;
    }

    const code = twoFactorCode.trim();
    if (!isValidTwoFactorCode(code)) {
      setErrorField("code");
      setLoginError("Enter a valid 6-digit authenticator code or backup code.");
      return;
    }

    try {
      const response = await completeOtpLogin(tempToken, code);
      const completedEmail =
        (response.user?.email && String(response.user.email).trim()) || accountEmail;
      await finishLogin(
        response.tokens.accessToken,
        completedEmail,
        response.user.requiresPasswordChange
          ? `${ROUTES.changePassword}?required=1&next=${encodeURIComponent(homePath)}`
          : homePath,
        response.user.dashboardType,
        response.user.scope,
      );
    } catch (err) {
      setErrorField("code");
      setLoginError(readableAuthError(err, "We couldn’t verify your code. Please try again."));
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

  const handleBackToCredentials = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    // Always leave the OTP step, even if a verify request is in flight.
    const challengeEmail = twoFactorAccountEmail.trim();
    setStep("credentials");
    setTempToken(null);
    setTwoFactorAccountEmail("");
    setTwoFactorCode("");
    setLoginError(null);
    setErrorField(null);
    // Keep the email field on the account that attempted 2FA so the user can retry.
    if (challengeEmail) {
      setEmail(challengeEmail);
    }
  };

  if (isDone) {
    return (
      <div
        className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 py-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Spinner
          size="large"
          appearance="primary"
          labelPosition="below"
          label="Checking your access…"
        />
        <p className="text-center text-sm text-muted-foreground">
          Verifying permissions and signing you in securely
        </p>
      </div>
    );
  }

  if (step === "two-factor") {
    const challengeEmail = (twoFactorAccountEmail || email).trim();
    return (
      <div className="w-full">
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-medium text-foreground">Two-factor authentication</p>
              <p className="text-[10px] text-muted-foreground">
                Enter the code from your authenticator app
                {challengeEmail ? (
                  <>
                    {" "}
                    for <span className="font-medium text-foreground">{challengeEmail}</span>
                  </>
                ) : null}
                .
              </p>
            </div>
          </div>

          <Field
            label="Authentication code"
            hint="6-digit app code, or a backup code if you have one."
            validationState={errorField === "code" ? "error" : "none"}
            validationMessage={errorField === "code" ? loginError ?? undefined : undefined}
          >
            <Input
              id="two-factor-code"
              type="text"
              appearance="outline"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              value={twoFactorCode}
              onChange={(_event, data) => {
                setTwoFactorCode(normalizeTwoFactorCode(data.value));
                if (errorField === "code") {
                  setLoginError(null);
                  setErrorField(null);
                }
              }}
              placeholder="123456"
              className="w-full"
            />
          </Field>

          <Button
            type="submit"
            appearance="primary"
            disabled={isLoading || !isValidTwoFactorCode(twoFactorCode)}
            className="w-full"
          >
            {isLoading ? "Verifying..." : "Verify & continue"}
          </Button>

          <Button
            type="button"
            appearance="secondary"
            onClick={handleBackToCredentials}
            className="w-full"
          >
            Back to sign in
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div
          className="space-y-1"
          style={{
            opacity: inputsMounted ? 1 : 0,
            transform: inputsMounted ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 220ms ease, transform 220ms ease",
            transitionDelay: "60ms",
          }}
        >
          <Field
            label="Email"
            required
            validationState={errorField === "email" ? "error" : "none"}
            validationMessage={errorField === "email" ? loginError ?? undefined : undefined}
          >
            <Input
              type="email"
              appearance="outline"
              value={email}
              autoComplete="username"
              onChange={(_event, data) => {
                setEmail(data.value);
                if (errorField === "email") {
                  setLoginError(null);
                  setErrorField(null);
                }
              }}
              placeholder="admin@company.com"
              className="w-full"
            />
          </Field>
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
          <Field
            label="Password"
            required
            validationState={errorField === "password" ? "error" : "none"}
            validationMessage={errorField === "password" ? loginError ?? undefined : undefined}
          >
            <Input
              type={showPassword ? "text" : "password"}
              appearance="outline"
              value={password}
              autoComplete="current-password"
              onChange={(_event, data) => {
                setPassword(data.value);
                if (errorField === "password") {
                  setLoginError(null);
                  setErrorField(null);
                }
              }}
              placeholder="Enter password"
              className="password-reveal-managed w-full"
              contentAfter={
                <Button
                  type="button"
                  appearance="transparent"
                  size="small"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  icon={showPassword ? <EyeOff20Regular /> : <Eye20Regular />}
                  onClick={() => setShowPassword((current) => !current)}
                />
              }
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Checkbox
            checked={rememberMe}
            size="medium"
            labelPosition="after"
            label={{ children: "Remember me", style: { lineHeight: "20px", whiteSpace: "nowrap" } }}
            onChange={(_event, data) => {
              const nextValue = Boolean(data.checked);
              setRememberMe(nextValue);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, String(nextValue));
                if (!nextValue) {
                  window.localStorage.removeItem(AUTH_STORAGE_KEYS.rememberedEmail);
                }
              }
            }}
          />
          <Link
            href={
              email.trim()
                ? `${ROUTES.forgotPassword}?email=${encodeURIComponent(email.trim().toLowerCase())}`
                : ROUTES.forgotPassword
            }
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" appearance="primary" disabled={isLoading} className="w-full">
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      {ssoOpen ? <form className="mt-3 space-y-2" onSubmit={async event=>{
        event.preventDefault();setSsoBusy(true);setSsoError("");
        try {await startBrowserSso("login",{company:company.trim()});}
        catch(error){setSsoError(readableAuthError(error,"Could not start company sign-in."));setSsoBusy(false);}
      }}>
        <Field label="Company sign-in code" hint="Use the company code supplied by your administrator.">
          <Input required maxLength={120} value={company} onChange={(_,data)=>setCompany(data.value)} />
        </Field>
        {ssoError && <p role="alert" className="text-sm text-destructive">{ssoError}</p>}
        <Button type="submit" className="w-full" disabled={!company.trim()||ssoBusy}>Continue to identity provider</Button>
      </form> : <Button type="button" className="mt-3 w-full" onClick={()=>setSsoOpen(true)}>Sign in with SSO</Button>}

    </div>
  );
}
