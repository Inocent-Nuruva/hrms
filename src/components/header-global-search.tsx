"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Field } from "@fluentui/react-components"
import { FluentSearchBox } from "@/components/common/fluent-search-box"

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

export function HeaderGlobalSearch({ items }: { items: HeaderSearchItem[] }) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [recentItems, setRecentItems] = React.useState<HeaderSearchItem[]>([])
  const normalizedQuery = query.trim().toLowerCase()

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
        event.preventDefault()
        setOpen(true)
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  const navigateToResult = (item: HeaderSearchItem) => {
    const nextRecent = [item, ...recentItems.filter((entry) => entry.url !== item.url)].slice(0, 8)
    setRecentItems(nextRecent)
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(nextRecent))
    setQuery("")
    setOpen(false)
    router.push(item.url)
  }

  return (
    <div
      ref={containerRef}
      className="relative min-w-0 shrink sm:shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Field label="Search in HRMS" size="small" className="min-w-0 gap-0 [&_label]:sr-only">
        <FluentSearchBox
          ref={inputRef}
          size="small"
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
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="header-search-results"
          className="w-full min-w-28 max-w-full !px-3 !py-1.5 sm:w-52 sm:pr-14"
        />
      </Field>
      {!query ? (
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1 py-px text-[9px] font-semibold leading-none text-blue-700 sm:inline-flex dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
          <span>Ctrl</span>
          <span className="text-violet-600 dark:text-violet-400">/</span>
        </kbd>
      ) : null}

      {open ? (
        <div
          id="header-search-results"
          className="absolute left-0 top-[calc(100%+0.45rem)] z-[400] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {normalizedQuery ? "Results" : recentItems.length > 0 ? "Recent" : "Quick navigation"}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {results.length > 0 ? results.map((result, index) => (
              <button
                key={`${result.url}-${result.title}`}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left",
                  activeIndex === index
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateToResult(result)}
              >
                <span className="min-w-0 truncate text-[13px] font-medium">{result.title}</span>
                {result.section ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{result.section}</span>
                ) : null}
              </button>
            )) : (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching pages</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
