import * as React from "react"
import {
  Textarea as FluentTextarea,
  type TextareaProps as FluentTextareaProps,
} from "@fluentui/react-components"

import { Error } from "@/components/ui/error"
import { cn } from "@/lib/utils"

type TextareaProps = Omit<FluentTextareaProps, "size"> & {
  error?: string
  size?: "xSmall" | "small" | "mediumSmall" | "large"
  containerClassName?: string
}

const sizeClasses: Record<NonNullable<TextareaProps["size"]>, string> = {
  xSmall: "min-h-9 text-xs",
  small: "min-h-10 text-sm",
  mediumSmall: "min-h-11 text-sm",
  large: "min-h-12 text-base",
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, disabled, error, size = "small", ...props }, ref) => {
    const textarea = (
      <FluentTextarea
        ref={ref}
        data-slot="textarea"
        appearance="outline"
        resize="none"
        size={size === "large" ? "large" : size === "xSmall" ? "small" : "medium"}
        className={cn(
          "w-full min-w-0 max-w-none font-sans text-foreground",
          sizeClasses[size],
          disabled && "cursor-not-allowed text-muted-foreground",
          error && "text-destructive ring-2 ring-destructive/15",
          className
        )}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        {...props}
      />
    )

    if (!error) {
      if (!containerClassName) {
        return textarea
      }

      return <div className={cn("w-full", containerClassName)}>{textarea}</div>
    }

    return (
      <div className={cn("flex w-full flex-col gap-2", containerClassName)}>
        {textarea}
        <Error size={size === "large" ? "large" : "small"}>{error}</Error>
      </div>
    )
  }
)

Textarea.displayName = "Textarea"

export { Textarea }
