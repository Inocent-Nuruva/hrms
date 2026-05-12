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
          "border-[#f4c6c7] bg-white text-[#303194] shadow-[0_10px_22px_rgba(237,67,72,0.18)] hover:text-white before:bg-[linear-gradient(180deg,#f06d72,#ed4348)] dark:border-[#7b3c4a] dark:bg-[#f3f6ff] dark:text-[#1f2752] dark:hover:text-white dark:before:bg-[linear-gradient(180deg,#f07f84,#d93a3f)]",
        outline:
          "border-[#d5def6] bg-[#f7f9ff] text-[#26305f] hover:bg-[#e9efff] before:bg-[linear-gradient(180deg,rgba(48,49,148,0.10),rgba(48,49,148,0.02))] dark:border-[#3c4685] dark:bg-[#1d2454] dark:text-[#eef2ff] dark:hover:bg-[#2a336d]",
        secondary:
          "bg-[#e8eeff] text-[#273162] hover:bg-[#dbe5ff] before:bg-[linear-gradient(180deg,rgba(48,49,148,0.12),rgba(48,49,148,0.03))] dark:bg-[#242d63] dark:text-[#eef2ff] dark:hover:bg-[#2f3975]",
        ghost:
          "bg-transparent text-[#26305f] hover:bg-[#edf2ff] before:bg-[linear-gradient(180deg,rgba(48,49,148,0.08),rgba(48,49,148,0.02))] dark:text-[#eef2ff] dark:hover:bg-[#2a336d]",
        destructive:
          "bg-[#ed4348] text-white shadow-[0_10px_22px_rgba(237,67,72,0.24)] hover:bg-[#d93a3f] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.02))] dark:bg-[#f06d72] dark:text-[#210c0d] dark:hover:bg-[#ef5358]",
        link: "bg-transparent p-0 text-[#303194] underline-offset-4 before:hidden after:hidden hover:underline dark:text-[#aab5ff]",
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
