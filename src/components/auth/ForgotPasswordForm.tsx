"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROUTES } from "@/utils/constants"
import { isValidEmail } from "@/utils/validators"

interface ForgotPasswordFormProps {
  onSubmit: (payload: { email: string }) => Promise<void>
  loading?: boolean
  error?: string | null
  success?: string | null
  defaultEmail?: string
}

export function ForgotPasswordForm({
  onSubmit,
  loading = false,
  error,
  success,
  defaultEmail = "",
}: ForgotPasswordFormProps) {
  const [email, setEmail] = React.useState(defaultEmail)
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (defaultEmail.trim()) {
      setEmail(defaultEmail.trim())
    }
  }, [defaultEmail])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldError(null)
    const normalized = email.trim().toLowerCase()
    if (!normalized || !isValidEmail(normalized)) {
      setFieldError("Enter a valid work email address.")
      return
    }
    await onSubmit({ email: normalized })
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-[12px] leading-relaxed text-emerald-900 dark:text-emerald-100">
          {success}
        </div>
        <Link
          href={ROUTES.login}
          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Enter the email for your account. If it matches a user, we&apos;ll send a reset link.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="forgot-email" className="text-xs font-medium">
          Email
        </Label>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (fieldError) setFieldError(null)
            }}
            required
            className="h-10 pl-9"
            placeholder="you@company.com"
          />
        </div>
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
        {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <MailIcon className="size-4" />}
        {loading ? "Sending…" : "Send reset link"}
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
