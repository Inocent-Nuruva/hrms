import * as React from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { CheckCircle2Icon, Loader2Icon, MailCheckIcon } from "lucide-react"

import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster } from "@/components/ui/sonner"
import { showSuccessAlert } from "@/lib/success-alert"
import { authService } from "@/services/authService"
import { ApiError } from "@/services/api"
import { ROUTES } from "@/utils/constants"
import { isValidEmail } from "@/utils/validators"

function readQueryString(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value.trim()
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim()
  }
  return ""
}

export default function VerifyEmailPage() {
  const router = useRouter()
  const [status, setStatus] = React.useState<"idle" | "verifying" | "success" | "error">("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [resendEmail, setResendEmail] = React.useState("")
  const [resendBusy, setResendBusy] = React.useState(false)
  const [resendSuccess, setResendSuccess] = React.useState<string | null>(null)
  const verifyAttemptedRef = React.useRef(false)

  const token = React.useMemo(
    () => readQueryString(router.query.token ?? router.query.verification_token ?? router.query.verificationToken),
    [router.query]
  )

  React.useEffect(() => {
    const email = readQueryString(router.query.email)
    if (email) {
      setResendEmail(email)
    }
  }, [router.query])

  React.useEffect(() => {
    if (!router.isReady || !token || verifyAttemptedRef.current) {
      return
    }

    verifyAttemptedRef.current = true
    setStatus("verifying")
    setError(null)

    void authService
      .verifyEmail(token)
      .then(() => {
        setStatus("success")
        showSuccessAlert("Email verified successfully.")
      })
      .catch((errorObject) => {
        const message =
          errorObject instanceof ApiError && errorObject.statusCode === 410
            ? errorObject.message || "This verification link has expired. Request a new one below."
            : errorObject instanceof Error
              ? errorObject.message
              : "We could not verify this email address."
        setError(message)
        setStatus("error")
      })
  }, [router.isReady, token])

  const handleResend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResendSuccess(null)
    setError(null)

    const normalizedEmail = resendEmail.trim().toLowerCase()
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      setError("Enter a valid work email address.")
      return
    }

    setResendBusy(true)
    try {
      await authService.resendVerification(normalizedEmail)
      const message = `A new verification link was sent to ${normalizedEmail}.`
      setResendSuccess(message)
      showSuccessAlert(message)
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not resend the verification email right now."
      )
    } finally {
      setResendBusy(false)
    }
  }

  const copyrightYear = new Date().getFullYear()

  return (
    <>
      <Head>
        <title>Verify email | Alliance HRMS</title>
      </Head>

      <Toaster position="top-right" />

      <div className="pointer-events-none fixed inset-0 bg-background" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      <div className="fixed right-3 top-3 z-20 md:right-4 md:top-4">
        <ThemeTogglerButton
          variant="outline"
          size="icon-sm"
          modes={["light", "dark", "system"]}
          className="border-border bg-card/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted"
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-3 md:p-4 lg:p-6">
        <div className="w-full max-w-[720px] animate-card-entrance">
          <div className="relative overflow-hidden rounded-xl p-[2px] shadow-sm md:rounded-2xl dark:shadow-none">
            <BorderBeam duration={5} colorFrom="#ffffff" colorTo="#a5b4fc" />
            <div className="relative z-10 overflow-hidden rounded-[10px] bg-card text-card-foreground md:rounded-[14px]">
              <div className="grid gap-6 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-8">
                <div className="space-y-4">
                  <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {status === "verifying" ? (
                      <Loader2Icon className="size-5 animate-spin" />
                    ) : (
                      <MailCheckIcon className="size-5" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                      Verify your email
                    </h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      We&apos;re confirming that the verification link belongs to your account.
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {status === "verifying" ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                          Verifying your email address...
                        </div>
                      ) : null}
                      {status === "success" ? (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-emerald-700 dark:text-emerald-300">
                          <div className="flex items-center gap-2 font-medium">
                            <CheckCircle2Icon className="size-4" />
                            Email verified successfully.
                          </div>
                          <p className="mt-2 text-sm">
                            You can now sign in and use recovery/security notifications with this email.
                          </p>
                        </div>
                      ) : null}
                      {status === "idle" && !token ? (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-amber-800 dark:text-amber-200">
                          Open this page from the verification link in your email, or request a fresh link.
                        </div>
                      ) : null}
                      {status === "error" && error ? (
                        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-rose-700 dark:text-rose-300">
                          {error}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Need a new link?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <form className="space-y-4" onSubmit={handleResend} noValidate>
                        <div className="space-y-1.5">
                          <Label htmlFor="verify-email-address">Email</Label>
                          <Input
                            id="verify-email-address"
                            type="email"
                            autoComplete="email"
                            value={resendEmail}
                            onChange={(event) => setResendEmail(event.target.value)}
                            placeholder="you@company.com"
                          />
                        </div>

                        {resendSuccess ? (
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                            {resendSuccess}
                          </div>
                        ) : null}

                        <Button type="submit" className="w-full gap-2" disabled={resendBusy}>
                          {resendBusy ? <Loader2Icon className="size-4 animate-spin" /> : <MailCheckIcon className="size-4" />}
                          {resendBusy ? "Sending..." : "Resend verification email"}
                        </Button>
                      </form>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Link
                          href={ROUTES.login}
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Back to sign in
                        </Link>
                        <Link
                          href={ROUTES.forgotPassword}
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Reset password
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            © {copyrightYear} Alliance Insurance Corporation Ltd
          </p>
        </div>
      </div>
    </>
  )
}
