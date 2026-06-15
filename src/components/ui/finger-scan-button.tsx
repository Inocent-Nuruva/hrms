"use client"

import { Fingerprint } from "lucide-react"

import { Button } from "@/components/ui/liquid-glass-button"
import { cn } from "@/lib/utils"

type FingerScanButtonProps = {
  disabled?: boolean
  idleLabel?: string
  isScanning?: boolean
  onClick?: () => void
  scanningLabel?: string
  className?: string
}

export function FingerScanButton({
  disabled = false,
  idleLabel = "Save & Capture Fingerprint",
  isScanning = false,
  onClick,
  scanningLabel = "Scanning fingerprint...",
  className,
}: FingerScanButtonProps) {
  const label = isScanning ? scanningLabel : idleLabel

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || isScanning}
      className={cn(
        "h-14 w-full min-w-[18rem] rounded-2xl px-5 text-base font-semibold text-primary-foreground",
        isScanning
          ? "bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_16px_40px_rgba(14,116,144,0.28)]"
          : "bg-primary/95 hover:bg-primary",
        className
      )}
    >
      <span className="inline-flex items-center gap-3">
        <span className="relative flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10">
          <Fingerprint
            className={cn(
              "size-5 transition-all duration-300",
              isScanning ? "animate-pulse" : "text-primary-foreground"
            )}
          />
          {isScanning ? (
            <>
              <span className="absolute inset-0 rounded-full border border-white/50 animate-ping" />
              <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
                <span className="size-1 rounded-full bg-white/80 animate-bounce [animation-delay:0ms]" />
                <span className="size-1 rounded-full bg-white/80 animate-bounce [animation-delay:150ms]" />
                <span className="size-1 rounded-full bg-white/80 animate-bounce [animation-delay:300ms]" />
              </span>
            </>
          ) : null}
        </span>
        <span className="text-left">
          <span className="block">{label}</span>
          <span className="block text-xs font-medium text-primary-foreground/75">
            {isScanning ? "Hold steady while the device captures." : "Start live capture from the device sensor."}
          </span>
        </span>
      </span>
    </Button>
  )
}
