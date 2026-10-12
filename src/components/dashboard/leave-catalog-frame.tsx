"use client"

import * as React from "react"
import { ListFilter, Plus, RefreshCw, X } from "lucide-react"
import { SearchSparkle20Regular as Search } from "@fluentui/react-icons"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type LeaveCatalogFilterGroup = {
  key: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
}

function HeaderSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
}) {
  const [open, setOpen] = React.useState(Boolean(value.trim()))
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (value.trim()) setOpen(true)
  }, [value])

  React.useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        title="Search"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
      </button>
    )
  }

  return (
    <div className="flex h-8 w-44 items-center gap-1.5 rounded-md border border-border bg-background px-2">
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        className="min-w-0 w-full border-0 bg-transparent p-0 text-xs text-slate-900 outline-none placeholder:text-slate-400"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label="Close search"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        onClick={() => {
          onChange("")
          setOpen(false)
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function FilterChoice({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2 text-[11px] font-semibold transition",
              active
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-muted dark:text-slate-300",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function LeaveCatalogFrame({
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  filterAriaLabel,
  filterGroups,
  filtersActive: filtersActiveProp,
  onFilterChange,
  onRefresh,
  loading,
  createLabel,
  onCreate,
  canCreate,
  banner,
  filterExtra,
  emptyTitle,
  emptyDescription,
  isEmpty,
  showSkeleton,
  children,
}: {
  title: string
  subtitle: string
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel: string
  filterAriaLabel: string
  filterGroups: LeaveCatalogFilterGroup[]
  filtersActive?: boolean
  onFilterChange: (key: string, value: string) => void
  onRefresh: () => void
  loading: boolean
  createLabel: string
  onCreate: () => void
  canCreate: boolean
  banner?: React.ReactNode
  filterExtra?: React.ReactNode
  emptyTitle: string
  emptyDescription: string
  isEmpty: boolean
  showSkeleton: boolean
  children: React.ReactNode
}) {
  const filtersActive =
    filtersActiveProp ?? filterGroups.some((group) => group.value !== "all")

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="sticky top-11 z-30 rounded-t-lg border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
          <HeaderSearch
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            ariaLabel={searchAriaLabel}
          />
          {filterGroups.length > 0 || filterExtra ? (
            <Popover>
              <PopoverTrigger
                type="button"
                aria-label={filterAriaLabel}
                title="Filter"
                className={cn(
                  "relative inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  filtersActive && "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
                )}
              >
                <ListFilter className="size-3.5" />
                {filtersActive ? (
                  <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
                ) : null}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3 p-3">
                {filterGroups.map((group) => (
                  <div key={group.key} className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-500">{group.label}</p>
                    <FilterChoice
                      value={group.value}
                      options={group.options}
                      onChange={(value) => onFilterChange(group.key, value)}
                    />
                  </div>
                ))}
                {filterExtra}
              </PopoverContent>
            </Popover>
          ) : null}
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          {canCreate ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              onClick={onCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              {createLabel}
            </button>
          ) : null}
        </div>
      </div>
      {banner}
      {showSkeleton ? (
        <div className="divide-y divide-slate-100 dark:divide-border">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse bg-slate-50 dark:bg-muted/30" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="px-3 py-10 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
