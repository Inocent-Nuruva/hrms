"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TableScrollContainerProps = React.ComponentProps<"div">

export function TableScrollContainer({
  className,
  children,
  ...props
}: TableScrollContainerProps) {
  return (
    <div
      className={cn(
        "dashboard-table-shell glass-scrollbar w-full max-w-full overflow-x-auto overflow-y-hidden rounded-xl border bg-white/70 shadow-sm backdrop-blur-sm [&_table]:w-full [&_table]:max-w-full [&_table]:min-w-0 [&_table]:table-auto [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
