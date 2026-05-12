"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  const normalizedQuery = query.trim().toLowerCase()

  const searchableItems = React.useMemo(
    () => searchItems.filter((item) => item.url && item.url !== "#"),
    [searchItems]
  )

  const searchResults = React.useMemo(() => {
    if (!normalizedQuery) {
      return searchableItems.slice(0, 8)
    }

    return searchableItems
      .filter((item) => {
        const haystack = [
          item.title,
          item.url,
          item.section ?? "",
          ...(item.keywords ?? []),
        ]
          .join(" ")
          .toLowerCase()

        return haystack.includes(normalizedQuery)
      })
      .slice(0, 10)
  }, [normalizedQuery, searchableItems])

  const runGlobalNavigation = (url: string) => {
    setIsSearchOpen(false)
    setQuery("")
    router.push(url)
  }

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
                        />
                      }
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </DialogTrigger>
                    <DialogPopup from="top" showCloseButton className="sm:max-w-[560px]">
                      <DialogHeader>
                        <DialogTitle>Global Search</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search across employees, operations, settings..."
                          autoFocus
                        />
                        <div className="max-h-72 overflow-y-auto rounded-lg border">
                          {searchResults.length > 0 ? (
                            searchResults.map((result, index) => (
                              <button
                                key={`${result.url}-${result.title}`}
                                type="button"
                                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted/40 ${
                                  index < searchResults.length - 1 ? "border-b" : ""
                                }`}
                                onClick={() => runGlobalNavigation(result.url)}
                              >
                                <span className="text-sm font-medium text-foreground">{result.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {result.section ? `${result.section} · ` : ""}
                                  {result.url}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-5 text-sm text-muted-foreground">
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
                >
                  {item.icon}
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
