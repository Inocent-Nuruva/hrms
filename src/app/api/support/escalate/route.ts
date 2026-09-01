import { NextResponse } from "next/server"

import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

function backendEscalateUrl() {
  const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "").replace(/\/api$/i, "")
  return `${base}/api/support/escalate`
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Describe what you need help with." }, { status: 400 })
  }

  const authorization = request.headers.get("authorization") ?? ""
  if (!authorization) {
    return NextResponse.json({ error: "Sign in to send this chat to IT support." }, { status: 401 })
  }

  try {
    const response = await fetch(backendEscalateUrl(), {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            (typeof payload.message === "string" && payload.message) ||
            (typeof payload.error === "string" && payload.error) ||
            "Could not email IT support.",
        },
        { status: response.status },
      )
    }
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json(
      { error: "Could not reach the mail service. Check SMTP settings and try again." },
      { status: 502 },
    )
  }
}
