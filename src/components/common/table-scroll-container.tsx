"use client"

import * as React from "react"

import { HorizontalScrollContainer } from "@/components/common/horizontal-scroll-container"
import { cn } from "@/lib/utils"

type TableScrollContainerProps = React.ComponentProps<"div">

export function TableScrollContainer({
  className,
  children,
  ...props
}: TableScrollContainerProps) {
  return (
    <HorizontalScrollContainer
      className={cn(
        "w-full max-w-full overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-sm [&_table]:w-full [&_table]:min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_th]:break-words [&_td]:break-words",
        className
      )}
      {...props}
    >
      {children}
    </HorizontalScrollContainer>
  )
}
