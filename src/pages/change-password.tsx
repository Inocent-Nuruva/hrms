import * as React from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import { KeyRoundIcon } from "lucide-react"

import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import { ErrorAlertOverlay } from "@/components/error-alert-overlay"
import { SuccessAlertOverlay } from "@/components/success-alert-overlay"
import { BorderBeam } from "@/components/ui/border-beam"
import { Toaster } from "@/components/ui/sonner"
import { useAuth } from "@/hooks/useAuth"
import { authService } from "@/services/authService"
import { ROUTES } from "@/utils/constants"

/**
 * Avoid SSR/client mismatch: router.query and localStorage-backed auth are not
 * available the same way on the server as on the first client paint.
 */
function useClientReady() {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    setReady(true)
  }, [])
  return ready
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const clientReady = useClientReady()
  const { tokens, user, refreshCurrentUser, clearSession } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleUseDifferentAccount = React.useCallback(() => {
    clearSession()
    void router.replace(ROUTES.login)
  }, [clearSession, router])

  // Only evaluate after mount so SSR HTML matches the first client render.
  const requiresPasswordChange = React.useMemo(() => {
    if (!clientReady || !router.isReady) return false
    return router.query.required === "1" || user?.requiresPasswordChange === true
  }, [clientReady, router.isReady, router.query.required, user?.requiresPasswordChange])

  const handleSubmit = async (payload: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => {
    if (!tokens?.accessToken) {
      setError("Your session is missing. Please sign in again.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await authService.changePassword(payload, tokens.accessToken)
      await refreshCurrentUser()
      void router.push(ROUTES.dashboard)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.")
    } finally {
      setIsLoading(false)
    }
  }

  const title = requiresPasswordChange ? "Set a new password" : "Change password"
  const subtitle = requiresPasswordChange
    ? "Change the temporary password you received before you can continue."
    : "Keep your ESS account secure with a strong personal password."
  const copyrightYear = clientReady ? new Date().getFullYear() : 2026

  return (
    <>
      <Head>
        <title>{title} | Alliance HRMS</title>
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
              {/* Brand panel */}
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
                      Strong passwords protect payroll, leave, and employee records across your
                      organization.
                    </p>
                  </div>

                  <div className="shrink-0 text-center text-xs text-white/60">
                    © {copyrightYear} Alliance Insurance Corporation Ltd
                  </div>
                </div>

                <div className="absolute inset-0 bg-[radial-gradient(#fff_0.8px,transparent_1px)] bg-[length:5px_5px] opacity-10" />
              </div>

              {/* Form panel */}
              <div className="col-span-3 flex items-center bg-background p-4 md:p-6 lg:p-8 dark:bg-card">
                <div className="mx-auto w-full max-w-[380px]">
                  <div className="mb-5 md:hidden">
                    <div className="mb-3 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/alliance-logo.png"
                        alt="Alliance Insurance"
                        className="h-7 w-auto dark:brightness-0 dark:invert"
                      />
                    </div>
                  </div>

                  <div className="mb-5 space-y-1.5">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary md:hidden">
                      <KeyRoundIcon className="size-5" />
                    </div>
                    {/*
                      suppressHydrationWarning: query/user may resolve after mount;
                      we also gate requiresPasswordChange until clientReady.
                    */}
                    <h1
                      className="text-xl font-semibold tracking-tight text-foreground"
                      suppressHydrationWarning
                    >
                      {clientReady && router.isReady ? title : "Change password"}
                    </h1>
                    <p
                      className="text-sm leading-relaxed text-muted-foreground"
                      suppressHydrationWarning
                    >
                      {clientReady && router.isReady
                        ? subtitle
                        : "Keep your ESS account secure with a strong personal password."}
                    </p>
                  </div>

                  {clientReady && router.isReady ? (
                    <ChangePasswordForm
                      onSubmit={handleSubmit}
                      loading={isLoading}
                      error={error}
                      requiredMode={requiresPasswordChange}
                      onUseDifferentAccount={
                        requiresPasswordChange ? handleUseDifferentAccount : undefined
                      }
                    />
                  ) : (
                    <div className="space-y-3" aria-hidden>
                      <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
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
