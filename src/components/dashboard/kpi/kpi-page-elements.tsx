"use client"

import * as React from "react"
import { Badge, MessageBar, MessageBarBody, Spinner, Text, type BadgeProps } from "@fluentui/react-components"
import { Target24Regular } from "@fluentui/react-icons"
import { SharedDashboardHeroBackground } from "@/components/dashboard/welcome-card-background"

const tones: Record<string, BadgeProps["color"]> = {
  published: "success", approved: "success", active: "success",
  draft: "informative", draft_revision: "warning", submitted: "brand",
  archived: "subtle", returned: "warning", rejected: "danger",
  scored: "success", partial: "warning", awaiting_data: "informative",
  finalized: "success", self_submitted: "brand", manager_submitted: "brand",
}

export function KpiStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  return <Badge appearance="outline" color={tones[normalized] ?? "informative"} className="capitalize">
    {status.replaceAll("_", " ")}
  </Badge>
}

export function KpiPageHeader({ title, description, actions, section, variant = "hero", leadingContent, titleFontFamily, titleSize, flushBelow = false }: { title: string; description?: string; actions?: React.ReactNode; section?: string; variant?: "hero" | "plain"; leadingContent?: React.ReactNode; titleFontFamily?: string; titleSize?: 700 | 800 | 900; flushBelow?: boolean }) {
  if (variant === "plain") {
    return <header className="flex flex-col gap-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {section && section !== "KPI Management" && <Text as="p" size={200} weight="semibold" className="uppercase tracking-[0.18em] text-muted-foreground" style={{ display: "block" }}>{section}</Text>}
        {leadingContent}
        <Text as="h1" size={titleSize ?? 700} weight="semibold" className="tracking-tight" style={{ display: "block", fontFamily: titleFontFamily }}>{title}</Text>
        {description && <Text as="p" size={300} className="text-muted-foreground" style={{ display: "block" }}>{description}</Text>}
      </div>
      {actions && <div className="flex shrink-0 flex-nowrap gap-2">{actions}</div>}
    </header>
  }
  return <header className={`relative isolate -mx-3 w-[calc(100%+1.5rem)] overflow-hidden border-y border-border bg-card px-5 py-6 text-foreground sm:-mx-4 sm:w-[calc(100%+2rem)] sm:px-8 sm:py-7 ${flushBelow ? "mb-0" : "mb-2"}`}>
    <SharedDashboardHeroBackground />
    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4 sm:gap-5"><Target24Regular aria-hidden="true" className="size-8 shrink-0 text-primary" /><div aria-hidden="true" className="h-12 w-px shrink-0 bg-border" /><div className="flex min-w-0 flex-col gap-1">{section && section !== "KPI Management" && <Text as="p" size={200} weight="semibold" className="uppercase tracking-[0.18em] text-muted-foreground">{section}</Text>}{leadingContent}<Text as="h1" size={500} weight="semibold" className="tracking-tight text-foreground" style={{ fontFamily: titleFontFamily }}>{title}</Text>{description && <Text as="p" size={300} className="text-muted-foreground">{description}</Text>}</div></div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 [&_a]:inline-flex [&_a]:h-9 [&_a]:items-center [&_a]:whitespace-nowrap [&_a]:rounded-md [&_a]:border [&_a]:border-border [&_a]:bg-background/80 [&_a]:px-3 [&_a]:text-sm [&_a]:font-medium [&_a]:text-foreground [&_a:hover]:bg-muted [&_button]:!whitespace-nowrap [&_button]:!border-border [&_button]:!bg-background/80 [&_button]:!text-foreground [&_button:hover]:!bg-muted">{actions}</div>}
    </div>
  </header>
}

export function KpiFeedback({ intent, children }: { intent: "error" | "success" | "warning" | "info"; children: React.ReactNode }) {
  return <MessageBar intent={intent} role={intent === "error" ? "alert" : "status"}><MessageBarBody>{children}</MessageBarBody></MessageBar>
}

export function KpiLoading({ label }: { label: string }) {
  return <div className="py-4"><Spinner label={label} size="small" /></div>
}
