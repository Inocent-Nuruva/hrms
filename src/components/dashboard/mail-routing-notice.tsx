"use client"

import * as React from "react"
import { getMailRouting } from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"

export function MailRoutingNotice({ platform = false }: { platform?: boolean }) {
  const [status, setStatus] = React.useState<Awaited<ReturnType<typeof getMailRouting>> | null>(null)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    let active = true
    getMailRouting(readStoredSessionTokens().accessToken, platform).then(result => {
      if (active) { setStatus(result); setFailed(false) }
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [platform])
  const detail = failed ? "Email routing status is unavailable." : !status ? "Checking recipient routing…" :
    status.mode === "redirected" ? `Recipient override is on. Outgoing email is redirected to ${status.test_recipient_count} configured test recipient${status.test_recipient_count === 1 ? "" : "s"}.` :
    status.mode === "blocked" ? "Recipient override is on. Email is blocked until the installation administrator configures valid test recipients." :
    "Recipient override is off. Email uses the intended recipients."
  return <section aria-label="Email routing" className="rounded-xl border border-border bg-card px-4 py-3 text-sm" role="status">
    <h2 className="font-semibold">Email routing</h2><p>{detail}</p>
  </section>
}
