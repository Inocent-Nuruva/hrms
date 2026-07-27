"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Primary/blue filled buttons always use white label text.
 * Outline/ghost use normal foreground colors for light and dark surfaces.
 */
export const liquidButtonVariants = cva(
  "group/liquid relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all duration-300 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:translate-y-[105%] before:content-[''] before:transition-transform before:duration-500 before:ease-out hover:before:translate-y-0 after:pointer-events-none after:absolute after:top-0 after:left-[-40%] after:z-0 after:h-full after:w-[35%] after:-skew-x-12 after:bg-white/20 after:opacity-0 after:transition-all after:duration-500 hover:after:left-[115%] hover:after:opacity-100",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary !text-white shadow-[0_10px_22px_rgb(var(--primary-rgb)/0.22)] hover:brightness-95 hover:!text-white before:bg-primary/90 [&_svg]:!text-white",
        outline:
          "border-border bg-background text-foreground hover:bg-muted hover:text-foreground before:bg-muted/80 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 before:bg-secondary dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted hover:text-foreground before:bg-muted dark:text-slate-100 dark:hover:bg-slate-800",
        destructive:
          "border-transparent bg-destructive !text-white shadow-sm hover:brightness-95 hover:!text-white before:bg-white/10 [&_svg]:!text-white",
        link: "border-transparent bg-transparent p-0 text-primary underline-offset-4 before:hidden after:hidden hover:underline",
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
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
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
      <span className="relative z-10 inline-flex items-center gap-1.5 text-inherit [&_svg]:text-inherit">
        {children}
      </span>
    </ButtonPrimitive>
  )
}
