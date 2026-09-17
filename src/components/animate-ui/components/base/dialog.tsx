"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type PopupFrom = "top" | "bottom" | "left" | "right" | "center"

const fromClassName: Record<PopupFrom, string> = {
  top: "data-starting-style:translate-y-[-1.5rem] data-ending-style:translate-y-[-1.5rem]",
  bottom:
    "data-starting-style:translate-y-[1.5rem] data-ending-style:translate-y-[1.5rem]",
  left: "data-starting-style:translate-x-[-1.5rem] data-ending-style:translate-x-[-1.5rem]",
  right:
    "data-starting-style:translate-x-[1.5rem] data-ending-style:translate-x-[1.5rem]",
  center: "data-starting-style:scale-95 data-ending-style:scale-95",
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

export interface DialogPopupProps extends DialogPrimitive.Popup.Props {
  from?: PopupFrom
  showCloseButton?: boolean
}

function DialogPopup({
  className,
  children,
  from = "center",
  showCloseButton = true,
  ...props
}: DialogPopupProps) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-0.75rem)] w-[calc(100%-0.75rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 touch-pan-y overscroll-contain overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl [scrollbar-gutter:stable] transition duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 sm:max-h-[min(90dvh,calc(100vh-1.5rem))] sm:w-[calc(100%-2rem)] sm:p-5",
          fromClassName[from],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <button
                type="button"
                className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] bg-transparent text-[var(--primary)] transition hover:bg-[color:rgb(var(--primary-rgb)/0.08)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-[#eef2ff] dark:hover:bg-[#2a336d]"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("mb-4 flex flex-col gap-1.5 text-start", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
}
