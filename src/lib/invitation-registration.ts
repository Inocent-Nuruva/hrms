// Rules for the invitation registration page. Invitees who already have an
// account (e.g. in another company) confirm with their current password, which
// may predate today's strength policy, so only new accounts are checked here.

export type InvitationRegistrationMode = "create" | "existing"

/**
 * Reads the registration token from the link's query string. The page then
 * removes it from the address bar so it does not linger in history, get
 * copied with the URL, or leak through the Referer header.
 */
export function readInvitationToken(
  query: Record<string, string | string[] | undefined>,
): string {
  const value = query.token ?? query.invitation_token
  return typeof value === "string" ? value.trim() : ""
}

/** The query string with the token parameters removed. */
export function queryWithoutToken(
  query: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  const rest: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (key === "token" || key === "invitation_token") continue
    if (value !== undefined) rest[key] = value
  }
  return rest
}

export function registrationMode(invitation: {
  has_existing_account?: boolean | null
}): InvitationRegistrationMode {
  return invitation.has_existing_account ? "existing" : "create"
}

const STRONG_PASSWORD_MESSAGE =
  "Use at least 8 characters with uppercase, lowercase, a number, and a symbol."

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

/** Returns an error message, or null when the form can be submitted. */
export function validateRegistration(
  mode: InvitationRegistrationMode,
  password: string,
  confirmation: string,
): string | null {
  if (mode === "existing") {
    return password ? null : "Enter your current password."
  }
  if (!isStrongPassword(password)) return STRONG_PASSWORD_MESSAGE
  if (password !== confirmation) return "The passwords do not match."
  return null
}

export const registrationCopy = {
  create: {
    passwordLabel: "Create password",
    passwordHint: STRONG_PASSWORD_MESSAGE,
    autoComplete: "new-password",
    submit: "Complete registration",
    submitting: "Creating account…",
    done: "and the password you created",
  },
  existing: {
    passwordLabel: "Current password",
    passwordHint:
      "You already have an account with this email. Enter your current password to join this company — it will not be changed.",
    autoComplete: "current-password",
    submit: "Join company",
    submitting: "Joining…",
    done: "and your existing password",
  },
} as const
