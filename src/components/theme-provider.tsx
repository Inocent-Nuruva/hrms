"use client"

import * as React from "react"
import { useAccountAppearance } from "@/hooks/use-account-appearance"

type ThemeMode = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: ThemeMode
  resolvedTheme: "light" | "dark"
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)
const THEME_STORAGE_KEY = "hrms.theme"

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "light" as const
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyThemeClass(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return "light" as const
  }
  const resolved = theme === "system" ? getSystemTheme() : theme
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  return resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const saved = (window.localStorage.getItem(THEME_STORAGE_KEY) ?? "").trim()
    const initialTheme: ThemeMode =
      saved === "light" || saved === "dark" || saved === "system" ? saved : "system"
    setThemeState(initialTheme)
    const resolved = applyThemeClass(initialTheme)
    setResolvedTheme(resolved)
  }, [])

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      if (theme === "system") {
        const resolved = applyThemeClass("system")
        setResolvedTheme(resolved)
      }
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const applySavedTheme = React.useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    const resolved = applyThemeClass(nextTheme)
    setResolvedTheme(resolved)
  }, [])

  const setTheme = useAccountAppearance("theme", "system", applySavedTheme)

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
