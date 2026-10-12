import type { ComponentProps } from "react"
import { Spinner } from "@fluentui/react-components"
import { cn } from "@/lib/utils"

type FluentLoadingIndicatorProps = Omit<ComponentProps<typeof Spinner>, "size"> & {
  size?: "tiny" | "small" | "medium" | "large"
}

export function FluentLoadingIndicator({
  size,
  className,
  ...props
}: FluentLoadingIndicatorProps) {
  const resolvedSize = size ?? (
    /(?:^|\s)(?:size-6|h-6|w-6)(?:\s|$)/.test(className ?? "")
      ? "large"
      : /(?:^|\s)(?:size-5|h-5|w-5)(?:\s|$)/.test(className ?? "")
        ? "medium"
        : /(?:^|\s)(?:size-3|size-3\.5|h-3|w-3)(?:\s|$)/.test(className ?? "")
          ? "tiny"
          : "small"
  )

  return (
    <Spinner
      {...props}
      size={resolvedSize}
      appearance="primary"
      className={cn("inline-flex shrink-0 align-middle", className?.replace(/\banimate-spin\b/g, ""))}
    />
  )
}
