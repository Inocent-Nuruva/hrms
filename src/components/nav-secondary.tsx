"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/animate-ui/components/base/dialog"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
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
export const OPEN_GLOBAL_SEARCH_EVENT = "hrms:open-global-search"

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
  const { isMobile, setOpenMobile } = useSidebar()
  const [query, setQuery] = React.useState("")
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [recentItems, setRecentItems] = React.useState<SearchItem[]>([])
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const normalizedQuery = normalizeSearchValue(query)

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
    if (!isSearchOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isSearchOpen])

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
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, persistRecentItem, router, searchableItems, setOpenMobile])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey)
        && (event.key.toLowerCase() === "k" || event.key === "/")
      ) {
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

  React.useEffect(() => {
    const openGlobalSearch = () => setIsSearchOpen(true)
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, openGlobalSearch)
    return () => window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, openGlobalSearch)
  }, [])

  return (
    <SidebarGroup className="p-0" {...props}>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            if (item.title === "Search") {
              return (
                <SidebarMenuItem key={item.title}>
                  <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                    <DialogTrigger
                      render={
                        <SidebarMenuButton
                          isActive={false}
                          className="h-8 min-h-8 cursor-pointer rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium leading-none !text-foreground [&_svg]:!size-[1.125rem] [&_svg]:!text-[var(--sidebar-icon-color)]"
                          aria-label="Open global search"
                        />
                      }
                    >
                      {item.icon}
                      <span className="truncate">{item.title}</span>
                      <kbd className="ml-auto rounded border border-primary/20 bg-primary/10 px-1 py-px text-[10px] font-medium leading-none text-primary">
                        Ctrl /
                      </kbd>
                    </DialogTrigger>
                    <DialogPopup
                      from="top"
                      showCloseButton={false}
                      className="overflow-hidden p-0 sm:max-w-md"
                    >
                      <DialogHeader className="sr-only">
                        <DialogTitle>Search</DialogTitle>
                      </DialogHeader>
                      <div className="flex h-10 items-center gap-2 border-b border-slate-200 px-3 dark:border-border">
                        <SearchIcon className="size-3.5 shrink-0 text-primary" />
                        <input
                          ref={searchInputRef}
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search pages…"
                          autoFocus
                          className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-foreground dark:placeholder:text-muted-foreground"
                        />
                        <kbd className="rounded border border-slate-200 px-1 py-px text-[10px] text-slate-500 dark:border-border">
                          Esc
                        </kbd>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-1.5">
                        {searchResults.length > 0 ? (
                          searchResults.map((result, index) => (
                            <button
                              key={`${result.url}-${result.title}`}
                              type="button"
                              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                activeIndex === index
                                  ? "bg-primary/10 text-primary"
                                  : "text-slate-900 hover:bg-primary/5 dark:text-foreground"
                              }`}
                              onClick={() => runGlobalNavigation(result.url)}
                              onMouseEnter={() => setActiveIndex(index)}
                            >
                              <span className="min-w-0 truncate font-medium">{result.title}</span>
                              {result.section ? (
                                <span
                                  className={`shrink-0 text-[11px] ${
                                    activeIndex === index ? "text-primary/70" : "text-slate-400"
                                  }`}
                                >
                                  {result.section}
                                </span>
                              ) : null}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-6 text-center text-sm text-slate-500">No matches</p>
                        )}
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
                  className="h-8 min-h-8 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium leading-none !text-foreground data-active:!bg-primary/10 dark:data-active:!bg-[#262626] data-active:!text-[var(--sidebar-active-link-color)] data-active:[&_svg]:!text-[var(--sidebar-active-link-color)] [&_svg]:!size-[1.125rem] [&_svg]:!text-[var(--sidebar-icon-color)]"
                  onClick={() => {
                    if (isMobile) {
                      setOpenMobile(false)
                    }
                  }}
                >
                  {item.icon}
                  <span className="truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
