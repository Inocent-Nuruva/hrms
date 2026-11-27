"use client"

import * as React from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Full-height panel that slides in from the right edge, used for every form
 * on the employee profile. The header and footer stay put while the body
 * scrolls smoothly, so long forms never push the buttons off screen.
 */
export function ProfileSidePanel({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  size = "md",
  bodyClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  /** md ≈ 672px, lg ≈ 896px wide on desktop; always full width on phones. */
  size?: "md" | "lg"
  bodyClassName?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-dvh min-h-0 w-full min-w-0 max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0",
          "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:max-w-full data-[side=right]:overflow-hidden data-[side=right]:border-l",
          size === "lg" ? "data-[side=right]:sm:max-w-4xl" : "data-[side=right]:sm:max-w-2xl"
        )}
      >
        <SheetHeader className="shrink-0 gap-1 border-b border-border bg-background px-4 py-4 pr-14 sm:pl-6 sm:pr-14">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-5 [scrollbar-gutter:stable] sm:px-6",
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <SheetFooter className="mt-0 w-full shrink-0 flex-row items-center justify-end gap-2 border-t border-border bg-background px-4 py-3 sm:px-6">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
