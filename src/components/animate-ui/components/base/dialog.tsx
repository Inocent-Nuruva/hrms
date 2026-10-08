"use client"

import * as React from "react"
import { DismissRegular } from "@fluentui/react-icons"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DialogBody,
  DialogSurface,
  DialogTitle as FluentDialogTitle,
  DrawerHeader,
  dialogSurfaceSize,
  FluentDialogCloseButton,
  FluentDialogRoot,
  FluentDialogTrigger,
} from "@/components/ui/fluent-dialog"

type PopupFrom = "top" | "bottom" | "left" | "right" | "center"

type DialogRootProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Dialog({ open, defaultOpen, onOpenChange, children }: DialogRootProps) {
  return (
    <FluentDialogRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </FluentDialogRoot>
  )
}

function DialogTrigger({
  render,
  children,
}: {
  render?: React.ReactElement<{ children?: React.ReactNode }>
  children?: React.ReactNode
}) {
  const child = render
    ? React.cloneElement(render, undefined, children ?? render.props.children)
    : children

  return (
    <FluentDialogTrigger disableButtonEnhancement action="open">
      {child as React.ReactElement}
    </FluentDialogTrigger>
  )
}

function DialogClose({
  render,
  children,
  className,
  disabled,
  onClick,
}: {
  render?: React.ReactElement
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <FluentDialogCloseButton
      render={render}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </FluentDialogCloseButton>
  )
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DialogBackdrop() {
  return null
}

export interface DialogPopupProps {
  className?: string
  bodyClassName?: string
  children?: React.ReactNode
  from?: PopupFrom
  showCloseButton?: boolean
}

function DialogPopup({
  className,
  bodyClassName,
  children,
  showCloseButton = true,
}: DialogPopupProps) {
  const size = dialogSurfaceSize(className)
  return (
    <DialogSurface className={className} data-size={size}>
      <DialogBody
        className={cn(
          "!flex !flex-col gap-3 overflow-y-auto",
          size === "full" ? "!h-full !max-h-none" : "!max-h-[min(90dvh,48rem)]",
          bodyClassName,
        )}
      >
        {showCloseButton ? (
          <FluentDialogTrigger disableButtonEnhancement action="close">
            <Button
              type="button"
              appearance="subtle"
              aria-label="Close"
              icon={<DismissRegular className="size-4" />}
              className="!absolute top-3 right-3 z-10"
            />
          </FluentDialogTrigger>
        ) : null}
        {children}
      </DialogBody>
    </DialogSurface>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <DrawerHeader
      data-slot="dialog-header"
      className={cn("mb-4 !flex !flex-col gap-1.5 !px-0 !pt-1.5 pr-9 text-start", className)}
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

function DialogTitle({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return <FluentDialogTitle className={className}>{children}</FluentDialogTitle>
}

function DialogDescription({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <p data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
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
  DialogPortal,
  DialogBackdrop,
}
