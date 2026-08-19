"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { MonitorCogIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

import { Button } from "@/components/ui/button"

const ORDERED_MODES = ["light", "dark", "system"] as const

type ThemeMode = (typeof ORDERED_MODES)[number]

export interface ThemeTogglerButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | "xs" | "icon-xs"
  direction?: "left" | "right"
  modes?: ThemeMode[]
  className?: string
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => unknown
}

function normalizeModes(modes?: ThemeMode[]) {
  const next = (modes?.length ? modes : ["light", "dark"]) as ThemeMode[]
  const unique = Array.from(new Set(next))
  return unique.filter((mode) => ORDERED_MODES.includes(mode))
}

export function ThemeTogglerButton({
  variant = "outline",
  size = "icon-sm",
  direction = "right",
  modes = ["light", "dark"],
  className,
}: ThemeTogglerButtonProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const safeModes = React.useMemo(() => normalizeModes(modes), [modes])
  const current = (mounted ? theme : safeModes[0]) as ThemeMode | undefined
  const currentMode = safeModes.includes(current as ThemeMode)
    ? (current as ThemeMode)
    : safeModes.includes(resolvedTheme as ThemeMode)
      ? (resolvedTheme as ThemeMode)
      : safeModes[0]
  const iconMode = currentMode ?? "light"
  const icon =
    iconMode === "dark" ? (
      <MoonIcon />
    ) : iconMode === "system" ? (
      <MonitorCogIcon />
    ) : (
      <SunIcon />
    )

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (safeModes.length === 0) {
      return
    }

    const index = safeModes.indexOf(currentMode)
    const at = index >= 0 ? index : 0
    const step = direction === "left" ? -1 : 1
    const nextIndex = (at + step + safeModes.length) % safeModes.length
    const nextTheme = safeModes[nextIndex] ?? safeModes[0]
    const applyTheme = () => {
      flushSync(() => {
        setTheme(nextTheme)
      })
    }

    if (!mounted || typeof window === "undefined") {
      applyTheme()
      return
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const trigger =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
    const rect = trigger?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const root = document.documentElement
    root.style.setProperty("--theme-transition-x", `${x}px`)
    root.style.setProperty("--theme-transition-y", `${y}px`)
    root.style.setProperty("--theme-transition-radius", `${endRadius}px`)

    const doc = document as DocumentWithViewTransition

    if (prefersReducedMotion) {
      applyTheme()
      return
    }

    if (doc.startViewTransition) {
      try {
        doc.startViewTransition(() => {
          applyTheme()
        })
        return
      } catch {
        // Fall through to the overlay wipe.
      }
    }

    const nextResolved =
      nextTheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : nextTheme
    const overlay = document.createElement("div")
    overlay.setAttribute("aria-hidden", "true")
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483646",
      "pointer-events:none",
      `background:${nextResolved === "dark" ? "#181818" : "#ffffff"}`,
      `clip-path:circle(0px at ${x}px ${y}px)`,
    ].join(";")
    document.body.appendChild(overlay)
    const animation = overlay.animate(
      [
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
      ],
      {
        duration: 650,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      }
    )
    window.setTimeout(() => {
      applyTheme()
    }, 160)
    void animation.finished.finally(() => {
      overlay.remove()
    })
  }

  const title = `Theme: ${currentMode ?? "light"}`

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleToggle}
      aria-label={title}
      title={title}
    >
      {icon}
    </Button>
  )
}
