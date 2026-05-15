"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#111827",
          "--normal-border": "#e5e7eb",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !bg-white !text-slate-900 !border !border-slate-200 !shadow-lg",
          title: "!text-slate-900",
          description: "!text-slate-700",
          success: "!bg-white !text-slate-900 !border-slate-200",
          error: "!bg-white !text-slate-900 !border-slate-200",
          warning: "!bg-white !text-slate-900 !border-slate-200",
          info: "!bg-white !text-slate-900 !border-slate-200",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
