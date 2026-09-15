"use client"

import * as React from "react"
import { motion } from "framer-motion"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDashboardMotion } from "@/lib/dashboard-motion"
import { cn } from "@/lib/utils"

export type WorkflowOption = {
  value: string
  label: string
}

export function WorkflowChoiceCard({
  active,
  layoutId,
  onClick,
  className,
  children,
}: {
  active: boolean
  layoutId: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  const { reduce } = useDashboardMotion()
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="relative overflow-hidden rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 aria-pressed:border-primary dark:border-border dark:bg-background dark:hover:bg-muted/40"
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 bg-primary"
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
        />
      ) : null}
      <span className={cn("relative z-10", className)}>{children}</span>
    </button>
  )
}

const ALL_OPTION = "all"

export function WorkflowSelect({
  value,
  options,
  placeholder,
  allLabel,
  onValueChange,
}: {
  value: string
  options: WorkflowOption[]
  placeholder: string
  allLabel?: string
  onValueChange: (value: string) => void
}) {
  const selected = value || (allLabel ? ALL_OPTION : "")
  const matchedLabel = options.find((option) => option.value === value)?.label
  const selectedLabel =
    (matchedLabel && matchedLabel !== "-" ? matchedLabel : "") ||
    (allLabel && !value ? allLabel : "")

  return (
    <Select
      value={selected || null}
      onValueChange={(next) => {
        if (!next) return
        onValueChange(next === ALL_OPTION ? "" : next)
      }}
    >
      <SelectTrigger className="w-full">
        <span className={cn("min-w-0 flex-1 truncate text-left", selectedLabel ? undefined : "text-slate-400")}>
          {selectedLabel || placeholder}
        </span>
      </SelectTrigger>
      <SelectContent align="start">
        {allLabel ? (
          <SelectItem value={ALL_OPTION} data-search-text={allLabel}>
            {allLabel}
          </SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} data-search-text={option.label}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function WorkflowSectionHeading({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 w-6 shrink-0 text-[11px] font-medium tabular-nums text-slate-400">{number}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  )
}
