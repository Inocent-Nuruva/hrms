"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Primary/blue filled buttons always use white label text.
 * Outline/ghost use normal foreground colors for light and dark surfaces.
 */
export const liquidButtonVariants = cva(
  "group/liquid relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent text-sm font-medium whitespace-nowrap outline-none transition-colors duration-150 select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary !text-white shadow-xs hover:bg-primary/92 hover:!text-white [&_svg]:!text-white",
        outline:
          "border-border bg-background text-foreground shadow-xs hover:border-primary/30 hover:bg-muted hover:text-foreground",
        secondary:
          "border-border/70 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "border-destructive bg-destructive !text-white shadow-xs hover:bg-destructive/90 hover:!text-white [&_svg]:!text-white",
        link: "border-transparent bg-transparent p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 text-[0.8rem] has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-5 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
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
      <span className="inline-flex items-center gap-1.5 text-inherit [&_svg]:text-inherit">
        {children}
      </span>
    </ButtonPrimitive>
  )
}
