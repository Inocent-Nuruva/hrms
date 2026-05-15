"use client"

import * as React from "react"
import { PaletteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "hrms.accent.color"
const DEFAULT_ACCENT = "#111111"
const PRESET_COLORS = ["#ea2e38", "#0078D4", "#22C55E", "#EAB308", "#EC4899", "#F97316"]

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "")
  if (normalized.length !== 6) {
    return null
  }
  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) {
    return null
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`
}

function shift(hex: string, delta: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return hex
  }
  const clamp = (value: number) => Math.max(0, Math.min(255, value))
  return rgbToHex(clamp(rgb.r + delta), clamp(rgb.g + delta), clamp(rgb.b + delta))
}

function applyAccent(accent: string) {
  if (typeof document === "undefined") {
    return
  }
  const rgb = hexToRgb(accent)
  const headerBg = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)` : "rgba(17, 17, 17, 0.14)"
  const root = document.documentElement
  root.style.setProperty("--sidebar-icon-color", accent)
  root.style.setProperty("--sidebar-active-link-color", accent)
  root.style.setProperty("--table-header-accent", accent)
  root.style.setProperty("--table-header-accent-bg", headerBg)
  root.style.setProperty("--primary", accent)
  root.style.setProperty("--accent", accent)
  root.style.setProperty("--ring", accent)
  root.style.setProperty("--primary-rgb", rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : "17 17 17")
}

export function AccentColorPicker() {
  const [open, setOpen] = React.useState(false)
  const [color, setColor] = React.useState(DEFAULT_ACCENT)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const stored = window.localStorage.getItem(STORAGE_KEY)?.trim() ?? ""
    const initial = /^#[0-9A-Fa-f]{6}$/.test(stored) ? stored : DEFAULT_ACCENT
    setColor(initial)
    applyAccent(initial)
  }, [])

  const setAndPersist = (next: string) => {
    setColor(next)
    applyAccent(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Customize color"
        title="Customize color"
        onClick={() => setOpen((value) => !value)}
      >
        <PaletteIcon />
      </Button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-card p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accent color</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="h-7 w-7 rounded-full border border-slate-300"
                style={{ backgroundColor: preset }}
                onClick={() => setAndPersist(preset)}
                title={preset}
              />
            ))}
          </div>
          <label className="block text-xs text-muted-foreground">Custom color</label>
          <input
            type="color"
            value={color}
            onChange={(event) => setAndPersist(event.target.value)}
            className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-300 bg-white"
          />
        </div>
      ) : null}
    </div>
  )
}
