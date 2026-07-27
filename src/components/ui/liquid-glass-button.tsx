"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary !text-white hover:bg-primary/90",
        ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        outline: "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4 py-2 text-xs",
        lg: "h-12 px-6 py-3",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        className={cn(
          "relative isolate overflow-hidden rounded-full",
          buttonVariants({ variant, size, className })
        )}
        {...props}
      >
        <span className="absolute inset-0 rounded-full bg-background/10 backdrop-blur-xl" />
        <span className="absolute inset-[1px] rounded-full border border-white/20 bg-linear-to-b from-white/20 to-white/5" />
        <span className="absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_30px_rgba(15,23,42,0.18)]" />
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {children}
        </span>
        <GlassFilter />
      </Comp>
    )
  }
)

Button.displayName = "Button"

function GlassFilter() {
  return (
    <svg className="hidden">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  )
}

export { Button, buttonVariants }
