"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { CheckCircle2Icon, CircleIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ROUTES } from "@/utils/constants"
import { validatePasswordPolicy } from "@/utils/validators"

interface ResetPasswordFormProps {
  token: string
  onSubmit: (payload: { token: string; newPassword: string }) => Promise<void>
  loading?: boolean
  error?: string | null
  success?: string | null
  tokenMissing?: boolean
}

type PasswordField = "next" | "confirm"

const POLICY_CHECKS = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "number", label: "One number", test: (v: string) => /[0-9]/.test(v) },
  {
    id: "special",
    label: "One special character",
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
] as const

function strengthScore(password: string) {
  return POLICY_CHECKS.reduce((score, check) => score + (check.test(password) ? 1 : 0), 0)
}

function strengthLabel(score: number) {
  if (score <= 1) return { label: "Weak", className: "text-rose-600 dark:text-rose-400" }
  if (score <= 3) return { label: "Fair", className: "text-amber-600 dark:text-amber-400" }
  if (score === 4) return { label: "Good", className: "text-sky-600 dark:text-sky-400" }
  return { label: "Strong", className: "text-emerald-600 dark:text-emerald-400" }
}

function strengthBarClass(score: number, index: number) {
  if (index >= score) return "bg-muted"
  if (score <= 1) return "bg-rose-500"
  if (score <= 3) return "bg-amber-500"
  if (score === 4) return "bg-sky-500"
  return "bg-emerald-500"
}

export function ResetPasswordForm({
  token,
  onSubmit,
  loading = false,
  error,
  success,
  tokenMissing = false,
}: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [visible, setVisible] = React.useState<Record<PasswordField, boolean>>({
    next: false,
    confirm: false,
  })

  const score = strengthScore(newPassword)
  const strength = strengthLabel(score)
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length > 0

  const toggleVisible = (field: PasswordField) => {
    setVisible((current) => ({ ...current, [field]: !current[field] }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldError(null)

    if (!token.trim()) {
      setFieldError("Reset token is missing. Open the link from your email again.")
      return
    }

    const issues = validatePasswordPolicy(newPassword)
    if (issues.length > 0) {
      setFieldError(issues[0])
      return
    }

    if (newPassword !== confirmPassword) {
      setFieldError("New password and confirmation do not match.")
      return
    }

    await onSubmit({ token: token.trim(), newPassword })
  }

  if (tokenMissing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-3 text-[12px] leading-relaxed text-rose-800 dark:text-rose-200">
          This page needs a valid reset link from your email. Request a new link if yours is
          missing or expired.
        </div>
        <Link
          href={ROUTES.forgotPassword}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95"
        >
          Request reset link
        </Link>
        <Link
          href={ROUTES.login}
          className="inline-flex h-9 w-full items-center justify-center text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-[12px] leading-relaxed text-emerald-900 dark:text-emerald-100">
          {success}
        </div>
        <Link
          href={ROUTES.login}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95"
        >
          Sign in with new password
        </Link>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Choose a new password for your account. This link can only be used once.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="reset-new-password" className="text-xs font-medium">
          New password
        </Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="reset-new-password"
            type={visible.next ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            className="password-reveal-managed h-10 pl-9 pr-10"
            placeholder="Create a strong password"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => toggleVisible("next")}
            aria-label={visible.next ? "Hide new password" : "Show new password"}
          >
            {visible.next ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">Password strength</p>
            <p className={cn("text-[11px] font-semibold", strength.className)}>
              {newPassword ? strength.label : "—"}
            </p>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className={cn("h-1 rounded-full transition-colors", strengthBarClass(score, index))}
              />
            ))}
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {POLICY_CHECKS.map((check) => {
              const passed = check.test(newPassword)
              return (
                <li
                  key={check.id}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px]",
                    passed
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground"
                  )}
                >
                  {passed ? (
                    <CheckCircle2Icon className="size-3 shrink-0" />
                  ) : (
                    <CircleIcon className="size-3 shrink-0" />
                  )}
                  {check.label}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm-password" className="text-xs font-medium">
          Confirm new password
        </Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="reset-confirm-password"
            type={visible.confirm ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            className={cn(
              "password-reveal-managed h-10 pl-9 pr-10",
              confirmPassword &&
                (passwordsMatch
                  ? "border-emerald-500/50 focus-visible:border-emerald-500"
                  : "border-rose-500/50 focus-visible:border-rose-500")
            )}
            placeholder="Re-enter new password"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => toggleVisible("confirm")}
            aria-label={visible.confirm ? "Hide confirmation" : "Show confirmation"}
          >
            {visible.confirm ? (
              <EyeOffIcon className="size-3.5" />
            ) : (
              <EyeIcon className="size-3.5" />
            )}
          </button>
        </div>
        {confirmPassword ? (
          <p
            className={cn(
              "text-[11px]",
              passwordsMatch
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {passwordsMatch ? "Passwords match." : "Passwords do not match yet."}
          </p>
        ) : null}
      </div>

      {fieldError ? (
        <p
          className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300"
          role="alert"
        >
          {fieldError}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-10 w-full gap-2" disabled={loading}>
        {loading ? (
          <FluentLoadingIndicator className="size-4 animate-spin" />
        ) : (
          <ShieldCheckIcon className="size-4" />
        )}
        {loading ? "Updating password…" : "Reset password"}
      </Button>

      <Link
        href={ROUTES.login}
        className="inline-flex h-9 w-full items-center justify-center text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        Back to sign in
      </Link>
    </form>
  )
}
