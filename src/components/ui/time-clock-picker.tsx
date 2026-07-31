"use client"

import * as React from "react"
import { Clock3Icon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type TimeClockPickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Accessible name for the trigger. */
  "aria-label"?: string
  id?: string
  /** Minute step on the dial (Google-style often uses 5). */
  minuteStep?: number
}

type DialMode = "hour" | "minute"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function parseHhMm(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function formatHhMm(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`
}

function angleForValue(value: number, count: number) {
  // 0 at top, clockwise — same as a clock face.
  return (value / count) * 360 - 90
}

function pointOnCircle(cx: number, cy: number, r: number, value: number, count: number) {
  const rad = (angleForValue(value, count) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function valueFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  count: number
) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  if (deg < 0) deg += 360
  const raw = Math.round((deg / 360) * count) % count
  return raw
}

/**
 * Compact Google/Material-style analog clock time picker.
 * Value format: `HH:mm` (24-hour), empty string allowed.
 */
export function TimeClockPicker({
  value,
  onChange,
  placeholder = "—:—",
  className,
  "aria-label": ariaLabel = "Select time",
  id,
  minuteStep = 5,
}: TimeClockPickerProps) {
  const parsed = parseHhMm(value)
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<DialMode>("hour")
  const [hour, setHour] = React.useState(parsed?.hour ?? 9)
  const [minute, setMinute] = React.useState(parsed?.minute ?? 0)
  const dialRef = React.useRef<HTMLDivElement>(null)
  const draggingRef = React.useRef(false)

  const step = Math.min(30, Math.max(1, minuteStep))
  const minuteTicks = Math.floor(60 / step)

  React.useEffect(() => {
    if (!open) return
    const next = parseHhMm(value)
    setHour(next?.hour ?? 9)
    setMinute(next?.minute ?? 0)
    setMode("hour")
  }, [open, value])

  const commit = React.useCallback(
    (nextHour: number, nextMinute: number) => {
      onChange(formatHhMm(nextHour, nextMinute))
    },
    [onChange]
  )

  const applyPointer = React.useCallback(
    (clientX: number, clientY: number, finishMinute = false) => {
      const el = dialRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (mode === "hour") {
        const nextHour = valueFromPointer(clientX, clientY, rect, 24)
        setHour(nextHour)
        if (!draggingRef.current) {
          // Tap: select hour then move to minutes.
          setMode("minute")
        }
      } else {
        const idx = valueFromPointer(clientX, clientY, rect, minuteTicks)
        const nextMinute = Math.min(59, idx * step)
        setMinute(nextMinute)
        if (finishMinute || !draggingRef.current) {
          commit(hour, nextMinute)
        }
      }
    },
    [commit, hour, mode, minuteTicks, step]
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    applyPointer(event.clientX, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    applyPointer(event.clientX, event.clientY)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    if (mode === "hour") {
      // After drag on hours, advance to minutes.
      setMode("minute")
    } else {
      applyPointer(event.clientX, event.clientY, true)
      setOpen(false)
    }
  }

  const size = 168
  const cx = size / 2
  const cy = size / 2
  const numberR = 62
  const handLen = 48
  const selectedValue = mode === "hour" ? hour : Math.round(minute / step) % minuteTicks
  const handEnd = pointOnCircle(cx, cy, handLen, mode === "hour" ? hour : selectedValue, mode === "hour" ? 24 : minuteTicks)

  const numbers =
    mode === "hour"
      ? Array.from({ length: 24 }, (_, i) => i)
      : Array.from({ length: minuteTicks }, (_, i) => i * step)

  return (
    // modal={false} keeps the parent Filters popover open while picking time.
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-6 w-full min-w-0 items-center justify-between gap-1 rounded border border-slate-300 bg-white px-1.5 text-left text-[10px] leading-none text-slate-900 outline-none transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]",
          className
        )}
      >
        <span
          className={cn(
            "truncate font-mono tabular-nums",
            parsed ? "font-medium" : "text-slate-400 dark:text-slate-500"
          )}
        >
          {parsed ? formatHhMm(parsed.hour, parsed.minute) : placeholder}
        </span>
        <Clock3Icon className="size-2.5 shrink-0 text-slate-400" />
      </PopoverTrigger>

      <PopoverContent
        className="z-[80] w-auto border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        align="end"
        sideOffset={6}
      >
        <div className="flex w-[11.5rem] flex-col gap-2">
          {/* Digital header — tap hour / minute like Material */}
          <div className="flex items-center justify-center gap-0.5 rounded-md bg-primary/10 px-2 py-1.5">
            <button
              type="button"
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-xl font-semibold tabular-nums transition",
                mode === "hour"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-primary/15"
              )}
              onClick={() => setMode("hour")}
            >
              {pad2(hour)}
            </button>
            <span className="text-xl font-semibold text-muted-foreground">:</span>
            <button
              type="button"
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-xl font-semibold tabular-nums transition",
                mode === "minute"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-primary/15"
              )}
              onClick={() => setMode("minute")}
            >
              {pad2(minute)}
            </button>
          </div>

          <p className="text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {mode === "hour" ? "Select hour" : "Select minute"}
          </p>

          {/* Analog dial */}
          <div
            ref={dialRef}
            className="relative mx-auto touch-none select-none rounded-full bg-muted/60"
            style={{ width: size, height: size }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="slider"
            aria-label={mode === "hour" ? "Hour dial" : "Minute dial"}
            aria-valuemin={0}
            aria-valuemax={mode === "hour" ? 23 : 59}
            aria-valuenow={mode === "hour" ? hour : minute}
          >
            <svg
              width={size}
              height={size}
              className="pointer-events-none absolute inset-0"
              aria-hidden
            >
              {/* Hand */}
              <line
                x1={cx}
                y1={cy}
                x2={handEnd.x}
                y2={handEnd.y}
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle cx={cx} cy={cy} r={3.5} fill="var(--primary)" />
              <circle
                cx={handEnd.x}
                cy={handEnd.y}
                r={14}
                fill="var(--primary)"
                opacity={0.18}
              />
              <circle cx={handEnd.x} cy={handEnd.y} r={4} fill="var(--primary)" />
            </svg>

            {numbers.map((n) => {
              const idx = mode === "hour" ? n : n / step
              const pos = pointOnCircle(cx, cy, numberR, idx, mode === "hour" ? 24 : minuteTicks)
              const isActive =
                mode === "hour" ? n === hour : Math.round(minute / step) * step === n
              // For 24h, show every hour; for minutes show labels every step (or every other if dense)
              const showLabel =
                mode === "hour"
                  ? n % 2 === 0 || n === hour
                  : step >= 5 || n % (step * 2) === 0 || isActive

              if (!showLabel && !isActive) {
                return (
                  <span
                    key={`${mode}-${n}`}
                    className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/30"
                    style={{ left: pos.x, top: pos.y }}
                  />
                )
              }

              return (
                <button
                  key={`${mode}-${n}`}
                  type="button"
                  tabIndex={-1}
                  className={cn(
                    "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:bg-primary/15"
                  )}
                  style={{ left: pos.x, top: pos.y }}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (mode === "hour") {
                      setHour(n)
                      setMode("minute")
                    } else {
                      setMinute(n)
                      commit(hour, n)
                      setOpen(false)
                    }
                  }}
                >
                  {pad2(n)}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              className="h-6 rounded px-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Clear
            </button>
            <div className="flex gap-0.5">
              <button
                type="button"
                className="h-6 rounded px-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-6 rounded bg-primary px-2.5 text-[10px] font-semibold !text-white transition hover:brightness-95"
                onClick={() => {
                  commit(hour, minute)
                  setOpen(false)
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
