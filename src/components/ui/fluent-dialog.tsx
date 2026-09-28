"use client"

import * as React from "react"
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  type DialogProps,
} from "@fluentui/react-components"

export function dialogSurfaceSize(className?: string) {
  if (!className) return undefined
  if (/100vw|h-dvh|h-\[calc\(100vh/.test(className)) return "full"
  if (/max-w-none|max-w-(2|3|4|5)xl|max-w-\[|min\(9/.test(className)) return "wide"
  return undefined
}

type FluentDialogRootProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modalType?: DialogProps["modalType"]
  children?: React.ReactNode
}

export function FluentDialogRoot({
  open,
  defaultOpen,
  onOpenChange,
  modalType = "modal",
  children,
}: FluentDialogRootProps) {
  return (
    <Dialog
      modalType={modalType}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(_event, data) => onOpenChange?.(data.open)}
    >
      {children as React.ReactElement}
    </Dialog>
  )
}

type TriggerElementProps = {
  disabled?: boolean
  className?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
}

type CloseButtonProps = {
  render?: React.ReactElement
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  action?: "open" | "close"
  appearance?: "primary" | "secondary" | "outline" | "subtle"
}

export function FluentDialogCloseButton({
  render,
  children,
  className,
  disabled,
  onClick,
  action = "close",
  appearance = "secondary",
}: CloseButtonProps) {
  const rendered = render as React.ReactElement<TriggerElementProps> | undefined
  const renderProps = rendered?.props
  const button = rendered
    ? React.cloneElement(rendered, {
        disabled: disabled ?? renderProps?.disabled,
        className: [renderProps?.className, className].filter(Boolean).join(" "),
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          renderProps?.onClick?.(event)
          onClick?.(event)
        },
      })
    : (
      <Button
        type="button"
        appearance={appearance}
        disabled={disabled}
        className={className}
        onClick={onClick}
      >
        {children}
      </Button>
    )

  return (
    <DialogTrigger disableButtonEnhancement action={action}>
      {button}
    </DialogTrigger>
  )
}

export {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
}
