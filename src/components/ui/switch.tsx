"use client"

import {
  Switch as FluentSwitch,
  type SwitchProps as FluentSwitchProps,
} from "@fluentui/react-components"
import { cn } from "@/lib/utils"

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
      className={cn(
        "[&_.fui-Switch__indicator]:!inline-flex [&_.fui-Switch__indicator]:!items-center [&_.fui-Switch__indicator]:!justify-start [&_.fui-Switch__indicator>svg]:!block",
        props.className,
      )}
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
