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
        "w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </HorizontalScrollContainer>
  )
}
