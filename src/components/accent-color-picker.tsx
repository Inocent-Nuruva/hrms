"use client"

import * as React from "react"
import { PaletteIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "hrms.accent.color"
/** Brand primary — keep in sync with globals.css --primary */
const DEFAULT_ACCENT = "#303194"
const PRESET_COLORS = ["#303194", "#0078D4", "#ea2e38", "#22C55E", "#EAB308", "#EC4899", "#F97316"]

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

function applyAccent(accent: string) {
  if (typeof document === "undefined") {
    return
  }
  const root = document.documentElement
  const rgb = hexToRgb(accent)
  const headerBg = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)` : "rgba(17, 17, 17, 0.14)"
  const railBg = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)` : "rgba(17, 17, 17, 0.10)"
  const railBorder = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)` : "rgba(17, 17, 17, 0.16)"
  // Solid primary / blue actions always use white labels.
  const onPrimary = "#ffffff"
  root.style.setProperty("--sidebar-icon-color", accent)
  root.style.setProperty("--sidebar-active-link-color", accent)
  root.style.setProperty("--table-header-accent", accent)
  root.style.setProperty("--table-header-accent-bg", headerBg)
  root.style.setProperty("--section-tab-rail-bg", railBg)
  root.style.setProperty("--section-tab-rail-border", railBorder)
  root.style.setProperty("--primary", accent)
  root.style.setProperty("--primary-foreground", onPrimary)
  root.style.setProperty("--accent", accent)
  root.style.setProperty("--accent-foreground", onPrimary)
  root.style.setProperty("--ring", accent)
  root.style.setProperty("--primary-rgb", rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : "17 17 17")
}

export function AccentColorPicker({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [color, setColor] = React.useState(DEFAULT_ACCENT)

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const stored = window.localStorage.getItem(STORAGE_KEY)?.trim() ?? ""
    // Migrate only obsolete neutral values; preserve the saved brand/custom color.
    const initial =
      stored === "#111111" ||
      stored === "#000000" ||
      !/^#[0-9A-Fa-f]{6}$/.test(stored)
        ? DEFAULT_ACCENT
        : stored
    if (initial !== stored) {
      window.localStorage.setItem(STORAGE_KEY, initial)
    }
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="Customize color"
        title="Customize color"
        aria-expanded={open}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className)}
      >
        <PaletteIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-[200] w-56 border border-border bg-card p-3 text-card-foreground shadow-xl"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accent color
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="h-7 w-7 cursor-pointer rounded-full border border-border transition-transform hover:scale-105 active:scale-95"
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
          className="mt-1 h-9 w-full cursor-pointer rounded border border-border bg-background"
        />
      </PopoverContent>
    </Popover>
  )
}
