"use client"

import * as React from "react"

export function useRenderDiagnostics(
  componentName: string,
  details?: Record<string, unknown>,
  options: {
    renderThreshold?: number
    windowMs?: number
  } = {}
) {
  const { renderThreshold = 8, windowMs = 3000 } = options
  const renderCountRef = React.useRef(0)
  const firstRenderAtRef = React.useRef(0)

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return
    }

    const now = Date.now()
    if (firstRenderAtRef.current === 0) {
      firstRenderAtRef.current = now
    }

    renderCountRef.current += 1
    const elapsedMs = Date.now() - firstRenderAtRef.current
    if (elapsedMs > windowMs) {
      renderCountRef.current = 1
      firstRenderAtRef.current = now
      return
    }

    if (renderCountRef.current >= renderThreshold) {
      console.debug(`[render-diagnostics] ${componentName}`, {
        renders: renderCountRef.current,
        elapsedMs,
        ...details,
      })
      renderCountRef.current = 0
      firstRenderAtRef.current = now
    }
  })
}
