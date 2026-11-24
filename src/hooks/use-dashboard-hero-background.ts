"use client"

import * as React from "react"
import { useAccountAppearance } from "@/hooks/use-account-appearance"

export type DashboardHeroBackground = "aurora" | "geometric" | "glow"

const backgroundChangedEvent = "hrms:dashboard-hero-background"

export function useDashboardHeroBackground(): [DashboardHeroBackground, (value: DashboardHeroBackground) => void] {
  const [background, setBackground] = React.useState<DashboardHeroBackground>("aurora")
  const saveAppearance = useAccountAppearance("managerBackground", "aurora", setBackground)

  React.useEffect(() => {
    const onChange = (event: Event) => {
      const value = (event as CustomEvent<DashboardHeroBackground>).detail
      if (value === "aurora" || value === "geometric" || value === "glow") setBackground(value)
    }
    window.addEventListener(backgroundChangedEvent, onChange)
    return () => window.removeEventListener(backgroundChangedEvent, onChange)
  }, [])

  const saveBackground = React.useCallback((value: DashboardHeroBackground) => {
    saveAppearance(value)
    window.dispatchEvent(new CustomEvent(backgroundChangedEvent, { detail: value }))
  }, [saveAppearance])

  return [background, saveBackground]
}
