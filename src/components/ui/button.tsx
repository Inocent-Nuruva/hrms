"use client"

import {
  LiquidButton,
  liquidButtonVariants,
  type LiquidButtonProps,
} from "@/components/animate-ui/components/buttons/liquid"

const buttonVariants = liquidButtonVariants

function Button(props: LiquidButtonProps) {
  return <LiquidButton {...props} />
}

export { Button, buttonVariants }
