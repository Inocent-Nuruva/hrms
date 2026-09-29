"use client"

import * as React from "react"
import {
  Button,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  type DialogProps,
  type OverlayDrawerProps,
} from "@fluentui/react-components"

type FluentDialogContextValue = {
  open: boolean
  modalType: DialogProps["modalType"]
  setOpen: (open: boolean) => void
}

const FluentDialogContext = React.createContext<FluentDialogContextValue | null>(null)

function useFluentDialogContext() {
  const context = React.useContext(FluentDialogContext)
  if (!context) {
    throw new Error("Fluent drawer components must be used inside FluentDialogRoot.")
  }
  return context
}

export function dialogSurfaceSize(className?: string) {
  if (!className) return "compact"
  if (/100vw|h-dvh|h-\[calc\(100vh/.test(className)) return "full"
  if (
    /notification-dialog|max-w-none|max-w-(3|4|5|6|7)xl|min\((9\d{2}|1\d{3})px/.test(
      className,
    )
  ) {
    return "wide"
  }
  if (/max-w-(xl|2xl)|min\((7|8)\d{2}px|42rem|44rem|48rem/.test(className)) {
    return "medium"
  }
  return "compact"
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
  defaultOpen = false,
  onOpenChange,
  modalType = "modal",
  children,
}: FluentDialogRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const resolvedOpen = open ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setUncontrolledOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [onOpenChange, open],
  )

  const value = React.useMemo(
    () => ({ open: resolvedOpen, modalType, setOpen }),
    [modalType, resolvedOpen, setOpen],
  )

  return <FluentDialogContext.Provider value={value}>{children}</FluentDialogContext.Provider>
}

type TriggerElementProps = {
  disabled?: boolean
  className?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
}

type FluentDialogTriggerProps = {
  children: React.ReactElement
  action?: "open" | "close"
  disableButtonEnhancement?: boolean
}

export function FluentDialogTrigger({
  children,
  action = "open",
}: FluentDialogTriggerProps) {
  const { setOpen } = useFluentDialogContext()
  const typedChild = children as React.ReactElement<TriggerElementProps>
  const childProps = typedChild.props

  return React.cloneElement(typedChild, {
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      childProps.onClick?.(event)
      if (!event.defaultPrevented && !childProps.disabled) {
        setOpen(action === "open")
      }
    },
  })
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

  return <FluentDialogTrigger action={action}>{button}</FluentDialogTrigger>
}

type DrawerSurfaceProps = Omit<OverlayDrawerProps, "open" | "onOpenChange" | "position" | "size"> & {
  "data-size"?: string
}

export function DialogSurface({
  children,
  "data-size": dataSize = "compact",
  ...props
}: DrawerSurfaceProps) {
  const { modalType, open, setOpen } = useFluentDialogContext()
  const drawerSize: NonNullable<OverlayDrawerProps["size"]> =
    dataSize === "full"
      ? "full"
      : dataSize === "wide"
        ? "large"
        : dataSize === "medium"
          ? "medium"
          : "small"

  return (
    <OverlayDrawer
      {...props}
      data-app-drawer="true"
      data-size={dataSize}
      modalType={modalType}
      open={open}
      position="end"
      size={drawerSize}
      onOpenChange={(_event, data) => setOpen(data.open)}
    >
      {children}
    </OverlayDrawer>
  )
}

const DialogActions = DrawerFooter
const DialogBody = DrawerBody
const DialogContent = DrawerBody
const DialogTitle = DrawerHeaderTitle

export {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogTitle,
  DrawerFooter,
  DrawerHeader,
}
