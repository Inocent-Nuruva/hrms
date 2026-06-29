"use client"

import { Button } from "@/components/ui/button"
import { AccentColorPicker } from "@/components/accent-color-picker"
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { RefreshCwIcon } from "lucide-react"

interface SiteHeaderProps {
  onRefresh: () => void
  loading: boolean
  adminName: string | null
  companyName: string | null
}

export function SiteHeader({
  onRefresh,
  loading,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-1.5 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1.5 px-3 lg:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-3.5 data-vertical:self-auto" />

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeTogglerButton
            variant="outline"
            size="icon-sm"
            direction="right"
            modes={["light", "dark"]}
          />
          <AccentColorPicker />
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCwIcon className={`text-primary ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </header>
  )
}
