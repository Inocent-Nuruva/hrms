"use client"

import {
  Switch as FluentSwitch,
  type SwitchProps as FluentSwitchProps,
} from "@fluentui/react-components"

type SwitchProps = Omit<FluentSwitchProps, "onChange" | "size"> & {
  size?: "sm" | "default" | "small" | "medium"
  onChange?: FluentSwitchProps["onChange"]
  onCheckedChange?: (checked: boolean) => void
}

function Switch({
  size = "default",
  onChange,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <FluentSwitch
      {...props}
      data-slot="switch"
      size={size === "sm" || size === "small" ? "small" : "medium"}
      onChange={(event, data) => {
        onChange?.(event, data)
        onCheckedChange?.(data.checked)
      }}
    />
  )
}

export { Switch }
export type { SwitchProps }
