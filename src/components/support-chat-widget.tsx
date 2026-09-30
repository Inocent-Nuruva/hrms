"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { HeadphonesIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import { Button } from "@/components/ui/button"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"

type SupportLink = { title: string; url: string }

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  links?: SupportLink[]
}

const SUPPORT_WIDGET_POSITION_KEY = "hrms.support.widget.position"
const SUPPORT_WIDGET_SIZE = 48
const SUPPORT_WIDGET_MARGIN = 16

type SupportWidgetPosition = {
  left: number
  top: number
}

function defaultSupportWidgetPosition() {
  return {
    left: Math.max(SUPPORT_WIDGET_MARGIN, window.innerWidth - SUPPORT_WIDGET_SIZE - SUPPORT_WIDGET_MARGIN),
    top: Math.max(SUPPORT_WIDGET_MARGIN, window.innerHeight - SUPPORT_WIDGET_SIZE - SUPPORT_WIDGET_MARGIN),
  }
}

function clampSupportWidgetPosition(position: SupportWidgetPosition) {
  if (typeof window === "undefined") {
    return position
  }
  return {
    left: Math.min(
      Math.max(SUPPORT_WIDGET_MARGIN, position.left),
      Math.max(SUPPORT_WIDGET_MARGIN, window.innerWidth - SUPPORT_WIDGET_SIZE - SUPPORT_WIDGET_MARGIN),
    ),
    top: Math.min(
      Math.max(SUPPORT_WIDGET_MARGIN, position.top),
      Math.max(SUPPORT_WIDGET_MARGIN, window.innerHeight - SUPPORT_WIDGET_SIZE - SUPPORT_WIDGET_MARGIN),
    ),
  }
}

function readStoredSupportWidgetPosition() {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.localStorage.getItem(SUPPORT_WIDGET_POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SupportWidgetPosition>
    if (typeof parsed.left !== "number" || typeof parsed.top !== "number") {
      return null
    }
    return clampSupportWidgetPosition({ left: parsed.left, top: parsed.top })
  } catch {
    return null
  }
}

function renderMessageBody(content: string) {
  const parts = content.split(/(\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (!match) return <React.Fragment key={index}>{part}</React.Fragment>
    const [, label, href] = match
    if (!href.startsWith("/")) return <React.Fragment key={index}>{label}</React.Fragment>
    return (
      <Link key={index} href={href} className="font-medium text-primary underline underline-offset-2">
        {label}
      </Link>
    )
  })
}

export function SupportChatWidget() {
  const actor = useDashboardActor()
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<SupportWidgetPosition | null>(null)
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 })
  const [input, setInput] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [escalating, setEscalating] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi. Ask me where to go in HRMS — leave, payroll, attendance, SMS, clock-in — and I will point you there. If I cannot help, tap Escalate to IT support.",
    },
  ])
  const scrollerRef = React.useRef<HTMLDivElement | null>(null)
  const dragStateRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    startLeft: number
    startTop: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = React.useRef(false)
  const alignPanelToLeft = Boolean(position && position.left < viewport.width / 2)
  const openPanelBelow = Boolean(position && position.top < viewport.height / 2)
  const widgetPositionStyle: React.CSSProperties = position
    ? { left: position.left, top: position.top }
    : { right: SUPPORT_WIDGET_MARGIN, bottom: SUPPORT_WIDGET_MARGIN }

  React.useEffect(() => {
    if (!open) return
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight })
  }, [messages, open])

  React.useEffect(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight })
    setPosition(readStoredSupportWidgetPosition() ?? defaultSupportWidgetPosition())
  }, [])

  React.useEffect(() => {
    if (!position) {
      return
    }
    window.localStorage.setItem(SUPPORT_WIDGET_POSITION_KEY, JSON.stringify(position))
  }, [position])

  React.useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      setPosition((current) => (current ? clampSupportWidgetPosition(current) : current))
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const beginDrag = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return
      }
      if (!position) {
        return
      }
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: position.left,
        startTop: position.top,
        moved: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [position],
  )

  const continueDrag = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragState.moved = true
      suppressClickRef.current = true
    }
    setPosition(
      clampSupportWidgetPosition({
        left: dragState.startLeft + deltaX,
        top: dragState.startTop + deltaY,
      }),
    )
  }, [])

  const endDrag = React.useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    suppressClickRef.current = dragState.moved
    dragStateRef.current = null
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
  }, [])

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
        body: JSON.stringify({
          messages: nextMessages,
          accessMode: actor.accessMode,
        }),
      })
      const payload = (await response.json()) as { reply?: string; links?: SupportLink[]; error?: string }
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Could not get an answer.")
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply as string, links: payload.links ?? [] },
      ])
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
      const token = readStoredSessionTokens().accessToken.trim()
      const response = await fetch("/api/support/escalate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          summary: input.trim() || messages.filter((entry) => entry.role === "user").at(-1)?.content || "",
          transcript: messages.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
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
    <div
      className="pointer-events-none fixed z-[80] size-12"
      style={widgetPositionStyle}
    >
      {open ? (
        <div
          className={cn(
            "pointer-events-auto absolute flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
            openPanelBelow ? "top-[calc(100%+0.75rem)]" : "bottom-[calc(100%+0.75rem)]",
            alignPanelToLeft ? "left-0" : "right-0",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Help and IT support</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This part is under development. Ask where a page is or how to use it. Escalate emails IT.
              </p>
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
                <div className="whitespace-pre-wrap">{renderMessageBody(message.content)}</div>
                {message.links && message.links.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.links.map((link) => (
                      <Link
                        key={link.url}
                        href={link.url}
                        className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
                      >
                        {link.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FluentLoadingIndicator className="size-3.5 animate-spin" />
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
                {busy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void escalate()}
              disabled={escalating}
            >
              {escalating ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <HeadphonesIcon className="size-4" />}
              Escalate to IT support
            </Button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="pointer-events-auto inline-flex size-12 touch-none items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:brightness-95 active:cursor-grabbing"
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          setOpen((current) => !current)
        }}
        aria-label={open ? "Close help chat" : "Open help chat"}
        title="Drag to move. Click to open help chat."
      >
        {open ? <XIcon className="size-5" /> : <HeadphonesIcon className="size-5" />}
      </button>
    </div>
  )
}
