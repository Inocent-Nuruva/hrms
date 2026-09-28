"use client"

import * as React from "react"
import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components"
import { useTheme } from "@/components/theme-provider"

export function AppFluentThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()
  const theme = React.useMemo(
    () => ({
      ...(resolvedTheme === "dark" ? webDarkTheme : webLightTheme),
      fontFamilyBase: "var(--font-comfortaa), Comfortaa, sans-serif",
    }),
    [resolvedTheme],
  )

  return <FluentProvider theme={theme}>{children}</FluentProvider>
}
