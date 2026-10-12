"use client"

import * as React from "react"
import {
  Button,
  Dialog as FluentDialog,
  DialogActions,
  DialogBody,
  DialogSurface as FluentDialogSurface,
  DialogTitle as FluentDialogTitle,
  DialogTrigger as FluentDialogTrigger,
} from "@fluentui/react-components"

import { cn } from "@/lib/utils"

type DialogChangeProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function AlertDialog({ open, defaultOpen, onOpenChange, children }: DialogChangeProps) {
  return (
    <FluentDialog
      modalType="alert"
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(_event, data) => onOpenChange?.(data.open)}
    >
      <>{children}</>
    </FluentDialog>
  )
}

function AlertDialogTrigger({ children }: { children?: React.ReactNode }) {
  if (!React.isValidElement(children)) return <>{children}</>

  return (
    <FluentDialogTrigger disableButtonEnhancement action="open">
      {children}
    </FluentDialogTrigger>
  )
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
  return (
    <FluentDialogSurface
      className={cn(
        "!w-[min(28rem,calc(100vw-2rem))] !max-w-[calc(100vw-2rem)] !p-0",
        className,
      )}
    >
      <DialogBody className="!flex !flex-col !gap-5 !p-6">{children}</DialogBody>
    </FluentDialogSurface>
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
      position="end"
      className={cn("mt-1 !flex !w-full !justify-end !gap-2", className)}
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
  return <FluentDialogTitle className={className}>{children}</FluentDialogTitle>
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
      className={cn("max-w-none text-sm leading-5 text-muted-foreground", className)}
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

function AlertDialogAction({ render, children, className, disabled, onClick }: ActionProps) {
  const rendered = render as React.ReactElement<{
    className?: string
    disabled?: boolean
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  }> | undefined
  const action = rendered
    ? React.cloneElement(rendered, {
        className: cn(rendered.props.className, className),
        disabled: disabled ?? rendered.props.disabled,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          rendered.props.onClick?.(event)
          onClick?.(event)
        },
      })
    : (
      <Button appearance="primary" className={cn("min-w-24", className)} disabled={disabled} onClick={onClick}>
        {children ?? "Delete"}
      </Button>
    )

  return (
    <FluentDialogTrigger disableButtonEnhancement action="close">
      {action}
    </FluentDialogTrigger>
  )
}

function AlertDialogCancel({ children, className, disabled, onClick }: ActionProps) {
  return (
    <FluentDialogTrigger disableButtonEnhancement action="close">
      <Button appearance="secondary" className={cn("min-w-24", className)} disabled={disabled} onClick={onClick}>
        {children ?? "Cancel"}
      </Button>
    </FluentDialogTrigger>
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
