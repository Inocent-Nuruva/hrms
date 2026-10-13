import { ApiError } from "@/lib/request-json";

export function workflowFailure(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401)
      return "Your session has expired. Sign in again to continue this workflow.";
    if (cause.status === 403)
      return "Your account cannot access this part of the workflow. Ask your administrator to grant the required module permissions.";
    if (cause.status === 404)
      return "This workflow or referenced record is unavailable. Refresh, then ask HR to check the module and cycle setup if it remains unavailable.";
    if (cause.status === 409) return cause.message;
  }
  return cause instanceof Error ? cause.message : fallback;
}
