import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Describe what you need help with." }, { status: 400 })
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const summary = typeof record.summary === "string" ? record.summary.trim() : ""
  const transcript = Array.isArray(record.transcript)
    ? record.transcript
        .map((entry) => {
          if (!entry || typeof entry !== "object") return ""
          const role = (entry as Record<string, unknown>).role
          const content = (entry as Record<string, unknown>).content
          if (typeof content !== "string" || !content.trim()) return ""
          return `${role === "assistant" ? "Assistant" : "You"}: ${content.trim()}`
        })
        .filter(Boolean)
    : []

  if (!summary && transcript.length === 0) {
    return NextResponse.json({ error: "Add a short note or chat first." }, { status: 400 })
  }

  const ticketId = `IT-${Date.now().toString(36).toUpperCase()}`
  console.info("[support-escalate]", ticketId, summary || transcript.at(-1))

  return NextResponse.json({
    ticketId,
    message: "IT support has the conversation and will follow up.",
  })
}
