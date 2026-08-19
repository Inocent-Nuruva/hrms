"use client"

import * as React from "react"
import { HeadphonesIcon, Loader2Icon, SendIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export function SupportChatWidget() {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [escalating, setEscalating] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "I can help you find pages and how to use HRMS. Ask a question, or send this chat to IT support.",
    },
  ])
  const scrollerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight })
  }, [messages, open])

  async function sendMessage() {
    const question = input.trim()
    if (!question || busy) return
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }]
    setMessages(nextMessages)
    setInput("")
    setBusy(true)
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const payload = (await response.json()) as { reply?: string; error?: string }
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Could not get an answer.")
      }
      setMessages((current) => [...current, { role: "assistant", content: payload.reply as string }])
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not get an answer."
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `${message} You can still escalate this to IT support.` },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function escalate() {
    setEscalating(true)
    try {
      const response = await fetch("/api/support/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: input.trim() || messages.filter((entry) => entry.role === "user").at(-1)?.content || "",
          transcript: messages,
        }),
      })
      const payload = (await response.json()) as { ticketId?: string; message?: string; error?: string }
      if (!response.ok || !payload.ticketId) {
        throw new Error(payload.error || "Could not reach IT support.")
      }
      const note = `IT support ticket ${payload.ticketId} is open. ${payload.message ?? ""}`.trim()
      setMessages((current) => [...current, { role: "assistant", content: note }])
      toast.success(`Ticket ${payload.ticketId} sent to IT support.`)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not reach IT support.")
    } finally {
      setEscalating(false)
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex flex-col items-end gap-3">
      {open ? (
        <div className="pointer-events-auto flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Help and IT support</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Ask where something is, or pass this chat to IT.</p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close help"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "ml-auto bg-primary text-white"
                    : "bg-muted/60 text-foreground",
                )}
              >
                {message.content}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                Looking that up…
              </div>
            ) : null}
          </div>
          <div className="space-y-2 border-t border-border p-3">
            <div className="flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Where do I request leave?"
                disabled={busy}
              />
              <Button type="button" size="icon" onClick={() => void sendMessage()} disabled={busy || !input.trim()}>
                {busy ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void escalate()}
              disabled={escalating}
            >
              {escalating ? <Loader2Icon className="size-4 animate-spin" /> : <HeadphonesIcon className="size-4" />}
              Escalate to IT support
            </Button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="pointer-events-auto inline-flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:brightness-95"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close help chat" : "Open help chat"}
      >
        {open ? <XIcon className="size-5" /> : <HeadphonesIcon className="size-5" />}
      </button>
    </div>
  )
}
