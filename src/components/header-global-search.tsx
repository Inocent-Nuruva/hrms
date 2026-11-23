"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Field } from "@fluentui/react-components"
import { Dismiss20Regular, Search20Regular } from "@fluentui/react-icons"
import { FluentSearchBox } from "@/components/common/fluent-search-box"

// Matches the other header icon buttons (see site-header.tsx).
const mobileIconButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"

import { cn } from "@/lib/utils"

export type HeaderSearchItem = {
  title: string
  url: string
  section?: string
  keywords?: string[]
}

const RECENT_SEARCHES_STORAGE_KEY = "hrms.global-search.recent.v1"

function scoreSearchResult(item: HeaderSearchItem, query: string) {
  const title = item.title.toLowerCase()
  const section = (item.section ?? "").toLowerCase()
  const url = item.url.toLowerCase()
  const keywords = (item.keywords ?? []).map((entry) => entry.toLowerCase())

  let score = 0
  if (title === query) score += 120
  if (title.startsWith(query)) score += 70
  if (section.startsWith(query)) score += 45
  if (keywords.some((entry) => entry === query)) score += 55
  if (keywords.some((entry) => entry.startsWith(query))) score += 35
  if (title.includes(query)) score += 25
  if (section.includes(query)) score += 18
  if (url.includes(query)) score += 12
  if (keywords.some((entry) => entry.includes(query))) score += 16
  return score
}

export function HeaderGlobalSearch({
  items,
  placement = "header",
  shortcutBreakpoint = "any",
}: {
  items: HeaderSearchItem[]
  placement?: "header" | "sidebar"
  shortcutBreakpoint?: "any" | "small" | "large"
}) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [recentItems, setRecentItems] = React.useState<HeaderSearchItem[]>([])
  // Below the `sm` breakpoint the field is collapsed to an icon button and
  // opens as an overlay across the header row. CSS alone decides which
  // variant shows, so `expanded` has no effect on wider screens.
  const [expanded, setExpanded] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const normalizedQuery = query.trim().toLowerCase()

  // The trigger is display:none while expanded, so focus can only move back to
  // it after the collapse has rendered.
  const restoreFocusRef = React.useRef(false)
  const collapse = React.useCallback((restoreFocus = false) => {
    restoreFocusRef.current = restoreFocus
    setOpen(false)
    setExpanded(false)
  }, [])

  React.useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      triggerRef.current?.focus()
    }
  }, [expanded])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) as HeaderSearchItem[] : []
      if (Array.isArray(parsed)) {
        setRecentItems(parsed.filter((item) => item?.title && item?.url))
      }
    } catch {
      setRecentItems([])
    }
  }, [])

  const results = React.useMemo(() => {
    if (!normalizedQuery) {
      const permittedRecent = recentItems.filter((recent) =>
        items.some((item) => item.url === recent.url),
      )
      return (permittedRecent.length > 0 ? permittedRecent : items).slice(0, 8)
    }

    return items
      .map((item) => ({ item, score: scoreSearchResult(item, normalizedQuery) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
      .map((entry) => entry.item)
      .slice(0, 9)
  }, [items, normalizedQuery, recentItems])

  React.useEffect(() => setActiveIndex(0), [normalizedQuery, open])

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === "/" || event.key.toLowerCase() === "k")) {
        const isSmallViewport = window.matchMedia("(max-width: 1023px)").matches
        if (shortcutBreakpoint === "small" && !isSmallViewport) return
        if (shortcutBreakpoint === "large" && isSmallViewport) return
        event.preventDefault()
        setExpanded(true)
        setOpen(true)
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [shortcutBreakpoint])

  const navigateToResult = (item: HeaderSearchItem) => {
    const nextRecent = [item, ...recentItems.filter((entry) => entry.url !== item.url)].slice(0, 8)
    setRecentItems(nextRecent)
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(nextRecent))
    setQuery("")
    collapse()
    router.push(item.url)
  }

  return (
    <>
      {placement === "header" && <button
        ref={triggerRef}
        type="button"
        className={cn(mobileIconButtonClass, "sm:hidden", expanded && "hidden")}
        aria-label="Search HRMS"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(true)
          setOpen(true)
        }}
      >
        <Search20Regular />
      </button>}
      <div
        ref={containerRef}
        className={cn(
          "relative min-w-0 w-full max-w-56 flex-1 sm:flex sm:max-w-xs sm:items-center",
          placement === "sidebar" && "max-w-none",
          placement === "header" && (expanded
            ? "max-sm:absolute max-sm:inset-x-0 max-sm:top-0 max-sm:z-[60] max-sm:flex max-sm:h-(--header-height) max-sm:max-w-none max-sm:items-center max-sm:gap-1 max-sm:bg-card max-sm:px-2.5"
            : "max-sm:hidden"),
        )}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false)
            if (placement === "header" && !query) setExpanded(false)
          }
        }}
      >
      <Field label="Search in HRMS" size="medium" className="min-w-0 flex-1 gap-0 [&_label]:sr-only">
        <FluentSearchBox
          ref={inputRef}
          size="medium"
          value={query}
          placeholder="Search HRMS"
          onFocus={() => setOpen(true)}
          onChange={(_event, data) => {
            setQuery(data.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActiveIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((current) => Math.max(0, current - 1))
            } else if (event.key === "Enter") {
              const result = results[activeIndex]
              if (result) {
                event.preventDefault()
                navigateToResult(result)
              }
            } else if (event.key === "Escape") {
              if (expanded) {
                collapse(true)
              } else {
                setOpen(false)
                inputRef.current?.blur()
              }
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="header-search-results"
          className="w-full min-w-0 max-w-full !px-3.5 !py-2 text-sm sm:pr-16"
        />
      </Field>
      {placement === "header" && <button
        type="button"
        className={cn(mobileIconButtonClass, "sm:hidden")}
        aria-label="Close search"
        onClick={() => {
          setQuery("")
          collapse(true)
        }}
      >
        <Dismiss20Regular />
      </button>}
      {!query ? (
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1 py-px text-[9px] font-semibold leading-none text-blue-700 sm:inline-flex dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
          <span>Ctrl</span>
          <span className="text-violet-600 dark:text-violet-400">/</span>
        </kbd>
      ) : null}

      {open ? (
        <div
          id="header-search-results"
          className={cn(
            "absolute left-0 top-[calc(100%+0.45rem)] z-[400] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl",
            placement === "sidebar" && "w-full max-w-full",
            placement === "header" && "max-sm:left-2.5 max-sm:right-2.5 max-sm:top-full max-sm:w-auto",
          )}
        >
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {normalizedQuery ? "Results" : recentItems.length > 0 ? "Recent" : "Quick navigation"}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {results.length > 0 ? results.map((result, index) => {
              // Titles follow the sidebar path "Module / Group / Page". Show the page
              // name first so results stay distinguishable on narrow screens.
              const segments = result.title.split(" / ")
              const pageName = segments[segments.length - 1]
              const path = segments.slice(0, -1).join(" › ")
              return (
                <button
                  key={`${result.url}-${result.title}`}
                  type="button"
                  title={result.title}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left",
                    activeIndex === index
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigateToResult(result)}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium">{pageName}</span>
                    {path ? (
                      <span className="truncate text-[11px] text-muted-foreground">{path}</span>
                    ) : null}
                  </span>
                  {result.section && !path ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{result.section}</span>
                  ) : null}
                </button>
              )
            }) : (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching pages</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
    </>
  )
}
