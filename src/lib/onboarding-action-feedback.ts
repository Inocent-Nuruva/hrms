export function onboardingActionMessage(response: unknown, fallback: string): string {
  if (!response || typeof response !== "object") return fallback
  const activation = (response as Record<string, unknown>).activation
  if (!activation || typeof activation !== "object") return fallback
  const message = (activation as Record<string, unknown>).message
  return typeof message === "string" && message.trim() ? `${fallback} ${message}` : fallback
}
