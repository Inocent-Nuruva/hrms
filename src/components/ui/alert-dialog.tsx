"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  DialogActions,
  DialogBody,
  DialogSurface,
  DialogTitle,
  dialogSurfaceSize,
  FluentDialogCloseButton,
  FluentDialogRoot,
} from "@/components/ui/fluent-dialog"

type DialogChangeProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function AlertDialog({ open, defaultOpen, onOpenChange, children }: DialogChangeProps) {
  return (
    <FluentDialogRoot
      modalType="alert"
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </FluentDialogRoot>
  )
}

function AlertDialogTrigger({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function AlertDialogOverlay() {
  return null
}

function AlertDialogContent({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const size = dialogSurfaceSize(className)
  return (
    <DialogSurface className={className} data-size={size}>
      <DialogBody
        className={cn(
          "!flex !flex-col gap-3 overflow-y-auto",
          size === "full" ? "!h-full !max-h-none" : "!max-h-[min(90dvh,48rem)]",
        )}
      >
        {children}
      </DialogBody>
    </DialogSurface>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1.5 text-start", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <DialogActions
      data-slot="alert-dialog-footer"
      className={cn("mt-2 justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return <DialogTitle className={className}>{children}</DialogTitle>
}

function AlertDialogDescription({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <p
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
    >
      {children}
    </p>
  )
}

type ActionProps = {
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  render?: React.ReactElement
}

function AlertDialogAction({ render, children, ...props }: ActionProps) {
  return (
    <FluentDialogCloseButton
      {...props}
      appearance="primary"
      render={render}
    >
      {children ?? "Delete"}
    </FluentDialogCloseButton>
  )
}

function AlertDialogCancel({ children, ...props }: ActionProps) {
  return (
    <FluentDialogCloseButton {...props} appearance="secondary">
      {children ?? "Cancel"}
    </FluentDialogCloseButton>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
