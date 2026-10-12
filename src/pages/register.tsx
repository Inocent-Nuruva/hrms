import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { CheckCircle2Icon, UserRoundCheckIcon } from "lucide-react";
import {
  acceptEmployeeInvitation,
  getPublicEmployeeInvitation,
  type PublicEmployeeInvitation,
} from "@/lib/admin-api"
import {
  queryWithoutToken,
  readInvitationToken,
  registrationCopy,
  registrationMode,
  validateRegistration,
} from "@/lib/invitation-registration"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback
}

export default function InvitationRegistrationPage() {
  const router = useRouter()
  const [invitation, setInvitation] =
    React.useState<PublicEmployeeInvitation | null>(null)
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [complete, setComplete] = React.useState(false)
  const [error, setError] = React.useState("")

  // Captured once, then removed from the address bar (see below).
  const [token, setToken] = React.useState<string | null>(null)

  const mode = invitation ? registrationMode(invitation) : "create"
  const copy = registrationCopy[mode]

  React.useEffect(() => {
    if (!router.isReady || token !== null) return
    const fromLink = readInvitationToken(router.query)
    setToken(fromLink)
    if (fromLink) {
      void router.replace(
        { pathname: router.pathname, query: queryWithoutToken(router.query) },
        undefined,
        { shallow: true },
      )
    }
  }, [router, token])

  React.useEffect(() => {
    if (token === null) return
    if (!token) {
      setError(
        "This invitation link is incomplete. Ask HR to send a new invitation.",
      )
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    void getPublicEmployeeInvitation(token)
      .then((result) => {
        if (active) setInvitation(result)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            messageFrom(loadError, "This invitation is no longer available."),
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const validationError = validateRegistration(mode, password, confirmation)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!token) return

    setSubmitting(true)
    try {
      await acceptEmployeeInvitation(token, password)
      setComplete(true)
    } catch (submitError: unknown) {
      setError(messageFrom(submitError, "Registration could not be completed."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        {/* Never send the registration link (with its token) as a Referer. */}
        <meta name="referrer" content="no-referrer" />
      </Head>
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-slate-100 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="fixed right-4 top-4 z-20">
        <ThemeTogglerButton
          variant="outline"
          size="icon-sm"
          modes={["light", "dark", "system"]}
          className="bg-card/90 shadow-sm backdrop-blur-sm"
        />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {complete ? (
                <CheckCircle2Icon className="size-6" />
              ) : (
                <UserRoundCheckIcon className="size-6" />
              )}
            </div>
            <CardTitle>
              {complete
                ? "Registration complete"
                : "Complete your registration"}
            </CardTitle>
            <CardDescription>
              {complete
                ? "Your employee account is ready."
                : invitation
                  ? `${invitation.company_name} invited you to join its employee portal.`
                  : "Checking your invitation…"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <FluentLoadingIndicator className="size-4 animate-spin" />
                Checking invitation
              </div>
            ) : complete ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  You can now sign in using {invitation?.email} {copy.done}.
                </p>
                <Button
                  render={
                    <Link
                      href={`/login?email=${encodeURIComponent(invitation?.email ?? "")}`}
                    />
                  }
                  className="w-full"
                >
                  Continue to sign in
                </Button>
              </div>
            ) : invitation ? (
              <form onSubmit={submit} className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    {invitation.first_name} {invitation.last_name}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {invitation.email}
                  </p>
                  <p className="text-muted-foreground">{invitation.phone}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{copy.passwordLabel}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={copy.autoComplete}
                    minLength={mode === "create" ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {copy.passwordHint}
                  </p>
                  {mode === "existing" ? (
                    <Link
                      href={`/forgot-password?email=${encodeURIComponent(invitation.email)}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  ) : null}
                </div>

                {mode === "create" ? (
                  <div className="space-y-2">
                    <Label htmlFor="password-confirmation">
                      Confirm password
                    </Label>
                    <Input
                      id="password-confirmation"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      required
                    />
                  </div>
                ) : null}

                {error ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? (
                    <FluentLoadingIndicator className="size-4 animate-spin" />
                  ) : null}
                  {submitting ? copy.submitting : copy.submit}
                </Button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error || "This invitation is no longer available."}
                </p>
                <Link
                  href="/login"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Return to sign in
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
