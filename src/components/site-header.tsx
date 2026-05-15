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
  adminName,
  companyName,
}: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
          <span>
            Admin:{" "}
            <span className="font-medium text-foreground">
              {adminName ?? "Unknown"}
            </span>
          </span>
          <span>•</span>
          <span>
            Company:{" "}
            <span className="font-medium text-foreground">
              {companyName ?? "Unknown"}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeTogglerButton
            variant="outline"
            size="icon-sm"
            direction="right"
            modes={["light", "dark"]}
          />
          <AccentColorPicker />
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCwIcon className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  )
}
