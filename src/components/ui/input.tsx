"use client"

import * as React from "react"
import {
  Input as FluentInput,
  type InputProps as FluentInputProps,
} from "@fluentui/react-components"
import { cn } from "@/lib/utils"

type InputProps = Omit<FluentInputProps, "type"> & {
  type?: React.ComponentProps<"input">["type"]
}

function Input({ className, type, appearance = "outline", ...props }: InputProps) {
  return (
    <FluentInput
      {...props}
      type={type as FluentInputProps["type"]}
      appearance={appearance}
      data-slot="input"
      className={cn("w-full min-w-0", className)}
    />
  )
}

export { Input }
