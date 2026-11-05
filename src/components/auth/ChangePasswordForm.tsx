"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { CheckCircle2Icon, CircleIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { validatePasswordPolicy } from "@/utils/validators"

interface ChangePasswordFormProps {
  onSubmit: (payload: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => Promise<void>
  loading?: boolean
  error?: string | null
  compact?: boolean
  requiredMode?: boolean
  /** Sign out and return to login (forced password-change flow). */
  onUseDifferentAccount?: () => void
}

type PasswordField = "current" | "next" | "confirm"

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

export function ChangePasswordForm({
  onSubmit,
  loading = false,
  error,
  requiredMode = false,
  compact = false,
  onUseDifferentAccount,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [fieldError, setFieldError] = React.useState<string | null>(null)
  const [visible, setVisible] = React.useState<Record<PasswordField, boolean>>({
    current: false,
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

    const issues = validatePasswordPolicy(newPassword)
    if (issues.length > 0) {
      setFieldError(issues[0])
      return
    }

    if (newPassword !== confirmPassword) {
      setFieldError("New password and confirmation do not match.")
      return
    }

    if (currentPassword && newPassword === currentPassword) {
      setFieldError("Choose a new password that is different from your current one.")
      return
    }

    await onSubmit({ currentPassword, newPassword, confirmPassword })
  }

  return (
    <form className={cn("flex flex-col", compact ? "gap-3" : "gap-4")} onSubmit={handleSubmit} noValidate>
      {requiredMode && !compact ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-snug text-amber-900 dark:text-amber-100">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p>
            A temporary password was issued for this account. Set a personal password before
            continuing into HRMS.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="currentPassword" className="text-xs font-medium">
          Current password
        </Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="currentPassword"
            type={visible.current ? "text" : "password"}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            className="password-reveal-managed h-10 pl-9 pr-10"
            placeholder="Enter current password"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => toggleVisible("current")}
            aria-label={visible.current ? "Hide current password" : "Show current password"}
          >
            {visible.current ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword" className="text-xs font-medium">
          New password
        </Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="newPassword"
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
                className={cn(
                  "h-1 rounded-full transition-colors",
                  strengthBarClass(score, index)
                )}
              />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-1">
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
                    <CircleIcon className="size-3 shrink-0 opacity-50" />
                  )}
                  {check.label}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-xs font-medium">
          Confirm new password
        </Label>
        <div className="relative">
          <LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
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
        <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300" role="alert">
          {fieldError}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-10 w-full gap-2" disabled={loading}>
        {loading ? (
          <FluentLoadingIndicator className="size-4 animate-spin" />
        ) : (
          <ShieldCheckIcon className="size-4" />
        )}
        {loading ? "Updating password…" : "Update password"}
      </Button>

      {requiredMode && onUseDifferentAccount ? (
        <button
          type="button"
          className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onUseDifferentAccount}
          disabled={loading}
        >
          Use a different account
        </button>
      ) : null}
    </form>
  )
}
