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
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-visible align-middle leading-none",
        className?.replace(/\banimate-spin\b/g, ""),
      )}
    >
      <Spinner
        {...props}
        size={resolvedSize}
        appearance="primary"
        className="!m-0 !max-h-none !max-w-none !overflow-visible"
      />
    </span>
  )
}
