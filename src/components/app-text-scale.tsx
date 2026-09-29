"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

export function AppTextScale() {
  const pathname = usePathname()

  React.useEffect(() => {
    document.body.dataset.appTextScale =
      pathname === "/dashboard" ? "dashboard" : "compact"

    return () => {
      delete document.body.dataset.appTextScale
    }
  }, [pathname])

  return null
}
