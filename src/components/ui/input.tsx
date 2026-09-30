"use client"

import * as React from "react"
import {
  Input as FluentInput,
  type InputProps as FluentInputProps,
  type SearchBoxProps as FluentSearchBoxProps,
} from "@fluentui/react-components"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import { TimeInput } from "@/components/ui/time-input"
import { cn } from "@/lib/utils"

type InputProps = Omit<FluentInputProps, "type"> & {
  type?: React.ComponentProps<"input">["type"]
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, appearance = "outline", ...props },
  ref,
) {
  const isSearch =
    type === "search" ||
    (typeof props.placeholder === "string" && /^search\b/i.test(props.placeholder.trim()))

  if (isSearch) {
    return (
      <FluentSearchBox
        {...(props as FluentSearchBoxProps)}
        ref={ref}
        appearance={appearance}
        data-slot="input"
        className={cn("w-full min-w-0", className)}
      />
    )
  }

  if (type === "time") {
    return (
      <TimeInput
        {...(props as React.ComponentProps<typeof TimeInput>)}
        ref={ref}
        className={cn("w-full min-w-0", className)}
      />
    )
  }

  return (
    <FluentInput
      {...props}
      ref={ref}
      type={type as FluentInputProps["type"]}
      appearance={appearance}
      data-slot="input"
      className={cn("w-full min-w-0", className)}
    />
  )
})

export { Input }
