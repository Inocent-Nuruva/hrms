import { NextResponse } from "next/server"

import { findSupportPages, localSupportAnswer, SUPPORT_KNOWLEDGE } from "@/lib/support-knowledge"

export const dynamic = "force-dynamic"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

function readText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim()
  }
  const output = Array.isArray(record.output) ? record.output : []
  const parts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const content = (item as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block || typeof block !== "object") continue
      const text = (block as Record<string, unknown>).text
      if (typeof text === "string" && text.trim()) parts.push(text.trim())
    }
  }
  return parts.join("\n")
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a question." }, { status: 400 })
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const messages = Array.isArray(record.messages) ? record.messages : []
  const history = messages
    .map((entry): ChatMessage | null => {
      if (!entry || typeof entry !== "object") return null
      const role = (entry as Record<string, unknown>).role
      const content = (entry as Record<string, unknown>).content
      if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) {
        return null
      }
      return { role, content: content.trim() }
    })
    .filter((entry): entry is ChatMessage => Boolean(entry))
    .slice(-12)

  const userTurns = history.filter((entry) => entry.role === "user")
  const question = userTurns.at(-1)?.content ?? ""
  const previousQuestion = userTurns.at(-2)?.content ?? ""
  if (!question) {
    return NextResponse.json({ error: "Send a question." }, { status: 400 })
  }

  const local = localSupportAnswer(question, previousQuestion)
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ ...local, source: "guide" })
  }

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        store: false,
        input: [
          { role: "system", content: SUPPORT_KNOWLEDGE },
          ...history.map((entry) => ({ role: entry.role, content: entry.content })),
        ],
      }),
    })
    const payload = (await response.json()) as unknown
    if (!response.ok) {
      return NextResponse.json({ ...local, source: "guide" })
    }
    const reply = readText(payload)
    if (!reply) {
      return NextResponse.json({ ...local, source: "guide" })
    }
    const links = findSupportPages(`${previousQuestion} ${question} ${reply}`, 4).map((page) => ({
      title: page.title,
      url: page.url,
    }))
    return NextResponse.json({ reply, links, source: "assistant" })
  } catch {
    return NextResponse.json({ ...local, source: "guide" })
  }
}
