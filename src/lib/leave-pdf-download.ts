"use client"

import { fluentConfirm } from "@/components/ui/fluent-dialog-service"

type LeavePdfResult = { blob: Blob; filename: string; contentType: string | null }
type LeavePdfDownloader = (options: {
  attachments?: "include" | "exclude"
}) => Promise<LeavePdfResult>

/**
 * Downloads the complete Leave Application PDF (form + supporting documents).
 * If an attachment cannot be read, the API refuses with
 * LEAVE_PDF_ATTACHMENT_FAILED instead of producing an incomplete "complete"
 * file; the user is told which document failed and may take the form only.
 * Returns null when the user declines the fallback.
 */
export async function downloadLeavePdfWithFallback(
  download: LeavePdfDownloader,
): Promise<(LeavePdfResult & { formOnly: boolean }) | null> {
  try {
    return { ...(await download({ attachments: "include" })), formOnly: false }
  } catch (error) {
    const payload = (error as { payload?: { code?: string; message?: unknown } })
      ?.payload
    if (payload?.code !== "LEAVE_PDF_ATTACHMENT_FAILED") throw error
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "A supporting document could not be included."
    const formOnly = await fluentConfirm(
      `${message}\n\nDownload the leave form without its supporting documents?`,
      { title: "Supporting document unavailable", confirmLabel: "Download form only" },
    )
    if (!formOnly) return null
    return { ...(await download({ attachments: "exclude" })), formOnly: true }
  }
}
