import * as React from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import { KeyRoundIcon } from "lucide-react"

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import { ErrorAlertOverlay } from "@/components/error-alert-overlay"
import { SuccessAlertOverlay } from "@/components/success-alert-overlay"
import { BorderBeam } from "@/components/ui/border-beam"
import { Toaster } from "@/components/ui/sonner"
import { authService } from "@/services/authService"
import { ApiError } from "@/services/api"
import { showSuccessAlert } from "@/lib/success-alert"

function useClientReady() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    setReady(true)
  }, [])
  return ready
}

function readTokenFromQuery(query: Record<string, string | string[] | undefined>): string {
  const raw = query.token ?? query.reset_token ?? query.resetToken
  if (typeof raw === "string") return raw.trim()
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim()
  return ""
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const clientReady = useClientReady()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const token = React.useMemo(() => {
    if (!clientReady || !router.isReady) return ""
    return readTokenFromQuery(router.query as Record<string, string | string[] | undefined>)
  }, [clientReady, router.isReady, router.query])

  const tokenMissing = clientReady && router.isReady && !token

  const handleSubmit = async (payload: { token: string; newPassword: string }) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await authService.resetPassword({
        token: payload.token,
        new_password: payload.newPassword,
      })
      setSuccess("Password reset successful. You can sign in with your new password.")
      showSuccessAlert("Password reset successful.")
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 410) {
        setError(
          err.message ||
            "This reset link has expired or is no longer available. Request a new one."
        )
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to reset password. Check the form and try again."
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const copyrightYear = clientReady ? new Date().getFullYear() : 2026

  return (
    <>
      <Head>
        <title>Reset password | Alliance HRMS</title>
      </Head>

      <Toaster position="top-right" />
      <SuccessAlertOverlay />
      <ErrorAlertOverlay />

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

      <div
        className="relative flex min-h-screen items-center justify-center p-3 md:p-4 lg:p-6"
        style={{ zIndex: 1 }}
      >
        <div className="w-full max-w-[920px] animate-card-entrance">
          <div className="relative overflow-hidden rounded-xl p-[2px] shadow-sm md:rounded-2xl dark:shadow-none">
            <BorderBeam duration={5} colorFrom="#ffffff" colorTo="#a5b4fc" />

            <div className="relative z-10 overflow-hidden rounded-[10px] bg-card text-card-foreground md:grid md:min-h-[520px] md:grid-cols-5 md:rounded-[14px]">
              <div className="relative col-span-2 hidden overflow-hidden bg-gradient-to-br from-[#303194] to-[#252882] p-8 text-white md:flex lg:p-10">
                <div className="relative z-10 flex w-full flex-col">
                  <div className="shrink-0">
                    <span className="text-sm font-semibold tracking-tight">Alliance HRMS</span>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
                      <KeyRoundIcon className="size-6" />
                    </div>
                    <p className="max-w-[28ch] text-sm leading-relaxed text-white/75">
                      Set a new password using the secure token from your email. Links expire for
                      your protection.
                    </p>
                  </div>
                  <div className="shrink-0 text-center text-xs text-white/60">
                    © {copyrightYear} Alliance Insurance Corporation Ltd
                  </div>
                </div>
                <div className="absolute inset-0 bg-[radial-gradient(#fff_0.8px,transparent_1px)] bg-[length:5px_5px] opacity-10" />
              </div>

              <div className="col-span-3 flex items-center bg-background p-4 md:p-6 lg:p-8 dark:bg-card">
                <div className="mx-auto w-full max-w-[380px]">
                  <div className="mb-5 space-y-1.5">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary md:hidden">
                      <KeyRoundIcon className="size-5" />
                    </div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                      Reset password
                    </h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Choose a strong password to replace the old one.
                    </p>
                  </div>

                  {clientReady && router.isReady ? (
                    <ResetPasswordForm
                      token={token}
                      tokenMissing={tokenMissing}
                      onSubmit={handleSubmit}
                      loading={isLoading}
                      error={error}
                      success={success}
                    />
                  ) : (
                    <div className="space-y-3" aria-hidden>
                      <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
                      <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
                      <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
                      <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[10px] text-muted-foreground md:hidden">
            © {copyrightYear} Alliance Insurance Corporation Ltd
          </p>
        </div>
      </div>
    </>
  )
}
