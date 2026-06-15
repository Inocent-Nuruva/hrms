"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { SearchIcon, ArrowRightIcon, Clock3Icon, CornerDownLeftIcon } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/animate-ui/components/base/dialog"
import { Input } from "@/components/ui/input"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SecondaryItem = {
  title: string
  url: string
  icon: React.ReactNode
}

type SearchItem = {
  title: string
  url: string
  section?: string
  keywords?: string[]
}

const RECENT_SEARCHES_STORAGE_KEY = "hrms.global-search.recent.v1"

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function scoreSearchResult(item: SearchItem, query: string) {
  const normalizedTitle = item.title.toLowerCase()
  const normalizedSection = (item.section ?? "").toLowerCase()
  const normalizedUrl = item.url.toLowerCase()
  const keywords = (item.keywords ?? []).map((entry) => entry.toLowerCase())

  let score = 0

  if (normalizedTitle === query) score += 120
  if (normalizedTitle.startsWith(query)) score += 70
  if (normalizedSection.startsWith(query)) score += 45
  if (keywords.some((entry) => entry === query)) score += 55
  if (keywords.some((entry) => entry.startsWith(query))) score += 35
  if (normalizedTitle.includes(query)) score += 25
  if (normalizedSection.includes(query)) score += 18
  if (normalizedUrl.includes(query)) score += 12
  if (keywords.some((entry) => entry.includes(query))) score += 16

  return score
}

export function NavSecondary({
  items,
  searchItems = [],
  ...props
}: {
  items: SecondaryItem[]
  searchItems?: SearchItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [hoveredLink, setHoveredLink] = React.useState<string | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [recentItems, setRecentItems] = React.useState<SearchItem[]>([])
  const normalizedQuery = normalizeSearchValue(query)
  const renderAnimatedIcon = React.useCallback((icon: React.ReactNode, key: string) => {
    if (!React.isValidElement(icon)) {
      return icon
    }
    return React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, {
      animate: hoveredLink === key ? "path-loop" : false,
      size: 48,
    })
  }, [hoveredLink])

  const searchableItems = React.useMemo(
    () => searchItems.filter((item) => item.url && item.url !== "#"),
    [searchItems]
  )

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw) as SearchItem[]
      if (!Array.isArray(parsed)) {
        return
      }
      setRecentItems(
        parsed.filter(
          (item): item is SearchItem =>
            Boolean(item && typeof item.title === "string" && typeof item.url === "string")
        )
      )
    } catch {
      // ignore invalid cache
    }
  }, [])

  const searchResults = React.useMemo(() => {
    if (!normalizedQuery) {
      return recentItems.length > 0 ? recentItems.slice(0, 8) : searchableItems.slice(0, 8)
    }

    return searchableItems
      .map((item) => ({ item, score: scoreSearchResult(item, normalizedQuery) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
      .map((entry) => entry.item)
      .slice(0, 10)
  }, [normalizedQuery, recentItems, searchableItems])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [normalizedQuery, isSearchOpen])

  React.useEffect(() => {
    if (searchResults.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((current) => Math.min(current, searchResults.length - 1))
  }, [searchResults])

  const persistRecentItem = React.useCallback((item: SearchItem) => {
    setRecentItems((current) => {
      const next = [item, ...current.filter((entry) => entry.url !== item.url)].slice(0, 8)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  const runGlobalNavigation = React.useCallback((url: string) => {
    const result = searchableItems.find((item) => item.url === url)
    if (result) {
      persistRecentItem(result)
    }
    setIsSearchOpen(false)
    setQuery("")
    setActiveIndex(0)
    router.push(url)
  }, [persistRecentItem, router, searchableItems])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsSearchOpen(true)
        return
      }

      if (!isSearchOpen) {
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((current) => current + 1)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((current) => Math.max(0, current - 1))
      } else if (event.key === "Enter") {
        const activeResult = searchResults[activeIndex]
        if (activeResult) {
          event.preventDefault()
          runGlobalNavigation(activeResult.url)
        }
      } else if (event.key === "Escape") {
        setIsSearchOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, isSearchOpen, runGlobalNavigation, searchResults])

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            if (item.title === "Search") {
              return (
                <SidebarMenuItem key={item.title}>
                  <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <DialogTrigger
                      render={
                        <SidebarMenuButton
                          isActive={false}
                          className="cursor-pointer"
                          aria-label="Open global search"
                          onMouseEnter={() => setHoveredLink(item.title)}
                          onMouseLeave={() => setHoveredLink((value) => (value === item.title ? null : value))}
                        />
                      }
                    >
                      {renderAnimatedIcon(item.icon, item.title)}
                      <span>{item.title}</span>
                      <span className="ml-auto rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        Ctrl K
                      </span>
                    </DialogTrigger>
                    <DialogPopup
                      from="top"
                      showCloseButton
                      className="overflow-hidden border-slate-200 bg-white p-0 shadow-[0_32px_90px_rgba(15,23,42,0.18)] sm:max-w-[680px]"
                    >
                      <DialogHeader>
                        <div className="relative overflow-hidden rounded-t-2xl border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_42%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(255,255,255,1))] px-5 py-5">
                          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-sky-100/60 blur-2xl" />
                          <DialogTitle className="relative text-left text-lg font-semibold text-slate-900">
                            Global Search
                          </DialogTitle>
                          <p className="relative mt-1 text-sm text-slate-500">
                            Jump anywhere in the app from one place.
                          </p>
                        </div>
                      </DialogHeader>
                      <div className="space-y-4 px-5 pb-5 pt-4">
                        <div className="relative">
                          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search pages, teams, tools, settings, attendance..."
                            autoFocus
                            className="h-12 rounded-2xl border-slate-200 pl-11 pr-24 text-sm shadow-sm transition focus-visible:ring-2 focus-visible:ring-slate-200"
                          />
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                            Enter
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{normalizedQuery ? "Best matches" : "Recent and suggested destinations"}</span>
                          <span>Use ↑ ↓ to move</span>
                        </div>
                        <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-2">
                          {searchResults.length > 0 ? (
                            searchResults.map((result, index) => (
                              <button
                                key={`${result.url}-${result.title}`}
                                type="button"
                                className={`group flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                                  activeIndex === index
                                    ? "bg-white shadow-sm ring-1 ring-slate-200"
                                    : "hover:bg-white/90 hover:shadow-sm"
                                }`}
                                onClick={() => runGlobalNavigation(result.url)}
                                onMouseEnter={() => setActiveIndex(index)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    runGlobalNavigation(result.url)
                                  }
                                }}
                              >
                                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                  <div className="flex items-center gap-2">
                                    {normalizedQuery ? (
                                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                        Match
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                        Recent
                                      </span>
                                    )}
                                    {result.section ? (
                                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                                        {result.section}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="truncate text-sm font-semibold text-slate-900">
                                    {result.title}
                                  </span>
                                  <span className="truncate text-xs text-slate-500">{result.url}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 transition group-hover:text-slate-600">
                                  {normalizedQuery ? (
                                    <CornerDownLeftIcon className="h-4 w-4" />
                                  ) : (
                                    <Clock3Icon className="h-4 w-4" />
                                  )}
                                  <ArrowRightIcon className="h-4 w-4" />
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-8 text-sm text-slate-500">
                              No results found.
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogPopup>
                  </Dialog>
                </SidebarMenuItem>
              )
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<Link href={item.url} />}
                  isActive={pathname === item.url}
                  onMouseEnter={() => setHoveredLink(item.title)}
                  onMouseLeave={() => setHoveredLink((value) => (value === item.title ? null : value))}
                >
                  {renderAnimatedIcon(item.icon, item.title)}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
