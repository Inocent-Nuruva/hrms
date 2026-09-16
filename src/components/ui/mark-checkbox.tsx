"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

type MarkCheckboxProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export function MarkCheckbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
  "aria-label": ariaLabel,
}: MarkCheckboxProps) {
  const box = (
    <span
      aria-hidden
      className={cn(
        "relative flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-all duration-200",
        checked
          ? "border-primary bg-primary text-white shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
          : "border-slate-300 bg-white group-hover:border-primary/55 dark:border-border dark:bg-background",
      )}
    >
      <Check
        className={cn(
          "size-3.5 transition-all duration-200",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
        strokeWidth={3}
      />
    </span>
  )

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex items-start text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30",
        label
          ? cn(
              "w-full gap-3 rounded-lg border px-3 py-2.5",
              checked
                ? "border-primary bg-primary/5"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-border dark:bg-background dark:hover:bg-muted/40",
            )
          : "rounded-md p-0.5",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {box}
      {label ? (
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
          {description ? <span className="mt-0.5 block text-xs leading-4 text-slate-500">{description}</span> : null}
        </span>
      ) : null}
    </button>
  )
}
