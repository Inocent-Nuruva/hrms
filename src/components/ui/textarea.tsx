import * as React from "react"

import { Error } from "@/components/ui/error"
import { cn } from "@/lib/utils"

type TextareaProps = React.ComponentProps<"textarea"> & {
  error?: string
  size?: "xSmall" | "small" | "mediumSmall" | "large"
  containerClassName?: string
}

const sizeClasses: Record<NonNullable<TextareaProps["size"]>, string> = {
  xSmall: "min-h-9 px-2.5 py-2 text-xs",
  small: "min-h-10 p-2.5 text-sm",
  mediumSmall: "min-h-11 px-3 py-2.5 text-sm",
  large: "min-h-12 px-3 py-2.5 text-base",
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, disabled, error, size = "small", ...props }, ref) => {
    const textarea = (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "w-full resize-none rounded-md border border-input bg-background font-sans text-foreground shadow-xs outline-none transition-colors duration-150 placeholder:text-muted-foreground hover:border-foreground/20 hover:ring-0",
          sizeClasses[size],
          disabled && "cursor-not-allowed bg-muted text-muted-foreground placeholder:text-muted-foreground placeholder:opacity-50",
          error ? "border-destructive text-destructive ring-2 ring-destructive/15" : "focus:border-primary focus:ring-2 focus:ring-primary/15",
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
