"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export const liquidButtonVariants = cva(
  "group/liquid relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all duration-300 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:translate-y-[105%] before:content-[''] before:transition-transform before:duration-500 before:ease-out hover:before:translate-y-0 after:pointer-events-none after:absolute after:top-0 after:left-[-40%] after:z-0 after:h-full after:w-[35%] after:-skew-x-12 after:bg-white/25 after:opacity-0 after:transition-all after:duration-500 hover:after:left-[115%] hover:after:opacity-100",
  {
    variants: {
      variant: {
        default:
          "border-[color:rgb(var(--primary-rgb)/0.4)] bg-[var(--primary)] text-white shadow-[0_10px_22px_rgb(var(--primary-rgb)/0.24)] hover:brightness-95 hover:text-white before:bg-[color:rgb(var(--primary-rgb)/0.9)] dark:border-[color:rgb(var(--primary-rgb)/0.48)] dark:bg-[var(--primary)] dark:text-white dark:hover:brightness-95 dark:before:bg-[color:rgb(var(--primary-rgb)/0.92)]",
        outline:
          "border-[color:rgb(var(--primary-rgb)/0.25)] bg-[#f7f9ff] text-[var(--primary)] hover:bg-[color:rgb(var(--primary-rgb)/0.08)] before:bg-[color:rgb(var(--primary-rgb)/0.15)] dark:border-[color:rgb(var(--primary-rgb)/0.35)] dark:bg-[#1d2454] dark:text-[#eef2ff] dark:hover:bg-[#2a336d]",
        secondary:
          "bg-[color:rgb(var(--primary-rgb)/0.12)] text-[var(--primary)] hover:bg-[color:rgb(var(--primary-rgb)/0.18)] before:bg-[color:rgb(var(--primary-rgb)/0.18)] dark:bg-[#242d63] dark:text-[#eef2ff] dark:hover:bg-[#2f3975]",
        ghost:
          "bg-transparent text-[var(--primary)] hover:bg-[color:rgb(var(--primary-rgb)/0.08)] before:bg-[color:rgb(var(--primary-rgb)/0.12)] dark:text-[#eef2ff] dark:hover:bg-[#2a336d]",
        destructive:
          "bg-[var(--primary)] text-white shadow-[0_10px_22px_rgb(var(--primary-rgb)/0.24)] hover:brightness-95 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.02))] dark:bg-[var(--primary)] dark:text-[#210c0d] dark:hover:brightness-95",
        link: "bg-transparent p-0 text-[var(--primary)] underline-offset-4 before:hidden after:hidden hover:underline dark:text-[#aab5ff]",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        xs: "h-7 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-[0.8rem] has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-5 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type LiquidButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof liquidButtonVariants>

export function LiquidButton({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: LiquidButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(liquidButtonVariants({ variant, size }), className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </ButtonPrimitive>
  )
}
