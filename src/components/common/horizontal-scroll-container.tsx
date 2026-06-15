"use client"

import * as React from "react"
import { InfoIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type HorizontalScrollContainerProps = React.ComponentProps<"div">

const HORIZONTAL_SCROLL_HINT_DISMISSED_KEY = "hrms.horizontal-scroll-hint.dismissed"

export function HorizontalScrollContainer({
  className,
  children,
  onWheel,
  ...props
}: HorizontalScrollContainerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [showHint, setShowHint] = React.useState(false)
  const [dismissPermanently, setDismissPermanently] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setDismissPermanently(
      window.localStorage.getItem(HORIZONTAL_SCROLL_HINT_DISMISSED_KEY) === "true"
    )
  }, [])

  React.useEffect(() => {
    if (dismissPermanently) {
      setShowHint(false)
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const updateHintVisibility = () => {
      const canScrollHorizontally = container.scrollWidth > container.clientWidth + 4
      setShowHint(canScrollHorizontally)
    }

    updateHintVisibility()

    const resizeObserver = new ResizeObserver(() => {
      updateHintVisibility()
    })

    resizeObserver.observe(container)
    Array.from(container.children).forEach((child) => resizeObserver.observe(child))
    window.addEventListener("resize", updateHintVisibility)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateHintVisibility)
    }
  }, [dismissPermanently, children])

  const closeHint = React.useCallback(
    (persist: boolean) => {
      if (persist && typeof window !== "undefined") {
        window.localStorage.setItem(HORIZONTAL_SCROLL_HINT_DISMISSED_KEY, "true")
        setDismissPermanently(true)
      }
      setShowHint(false)
    },
    []
  )

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      onWheel?.(event)
      if (event.defaultPrevented) {
        return
      }

      const container = containerRef.current
      if (!container) {
        return
      }

      const canScrollHorizontally = container.scrollWidth > container.clientWidth
      if (!canScrollHorizontally) {
        return
      }

      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || event.deltaY === 0) {
        return
      }

      const nextScrollLeft = container.scrollLeft + event.deltaY
      const maxScrollLeft = container.scrollWidth - container.clientWidth

      if (nextScrollLeft < 0 && container.scrollLeft <= 0) {
        return
      }

      if (nextScrollLeft > maxScrollLeft && container.scrollLeft >= maxScrollLeft) {
        return
      }

      event.preventDefault()
      container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft))
    },
    [onWheel]
  )

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-x-auto", className)}
      onWheel={handleWheel}
      {...props}
    >
      {children}
      {showHint ? (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-xs">
          <div className="pointer-events-auto rounded-lg border border-sky-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-sky-50 p-1 text-sky-600">
                <InfoIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Wide table tip</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Use your mouse wheel or trackpad over this table to scroll sideways.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
                    checked={dismissPermanently}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setDismissPermanently(checked)
                      if (typeof window !== "undefined") {
                        if (checked) {
                          window.localStorage.setItem(
                            HORIZONTAL_SCROLL_HINT_DISMISSED_KEY,
                            "true"
                          )
                        } else {
                          window.localStorage.removeItem(
                            HORIZONTAL_SCROLL_HINT_DISMISSED_KEY
                          )
                        }
                      }
                    }}
                  />
                  Don&apos;t show again
                </label>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => closeHint(dismissPermanently)}
                aria-label="Dismiss scroll hint"
                title="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
