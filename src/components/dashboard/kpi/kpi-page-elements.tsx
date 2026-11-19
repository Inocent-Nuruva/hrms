"use client"

import * as React from "react"
import { Badge, MessageBar, MessageBarBody, Spinner, Text, tokens, type BadgeProps } from "@fluentui/react-components"
import { Target24Regular } from "@fluentui/react-icons"

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

export function KpiPageHeader({ title, description, actions, section, variant = "hero", leadingContent, titleFontFamily, titleSize }: { title: string; description?: string; actions?: React.ReactNode; section?: string; variant?: "hero" | "plain"; leadingContent?: React.ReactNode; titleFontFamily?: string; titleSize?: 700 | 800 | 900 }) {
  if (variant === "plain") {
    return <header className="flex flex-col gap-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {section && section !== "KPI Management" && <Text as="p" size={200} weight="semibold" className="uppercase tracking-[0.18em] text-muted-foreground">{section}</Text>}
        {leadingContent}
        <Text as="h1" size={titleSize ?? 700} weight="semibold" className="tracking-tight" style={{ fontFamily: titleFontFamily }}>{title}</Text>
        {description && <Text as="p" size={300} className="text-muted-foreground">{description}</Text>}
      </div>
      {actions && <div className="flex shrink-0 flex-nowrap gap-2">{actions}</div>}
    </header>
  }
  return <header className="relative -mx-3 w-[calc(100%+1.5rem)] overflow-hidden bg-gradient-to-r from-primary via-primary to-primary/90 px-5 py-6 text-primary-foreground sm:-mx-4 sm:w-[calc(100%+2rem)] sm:px-8 sm:py-7">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="finance-hero-drift absolute -right-16 -top-24 size-80 rounded-full border-[42px] border-primary-foreground/[0.12]" />
      <div className="finance-hero-orbit absolute right-16 top-[calc(50%-4.5rem)] size-36 rounded-full border border-primary-foreground/15" />
      <div className="finance-hero-band absolute bottom-0 right-28 h-32 w-56 bg-primary-foreground/[0.08]" />
      <div className="finance-hero-line absolute left-[46%] top-5 h-24 w-px bg-primary-foreground/15" />
      <div className="finance-hero-dot absolute left-[49%] top-9 size-2 rounded-full bg-primary-foreground/25" />
      <div className="finance-hero-dot finance-hero-dot-delayed absolute left-[51%] top-16 size-1.5 rounded-full bg-primary-foreground/20" />
    </div>
    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4 sm:gap-5"><Target24Regular aria-hidden="true" className="size-8 shrink-0 text-primary-foreground/90" /><div aria-hidden="true" className="h-12 w-px shrink-0 bg-primary-foreground/25" /><div className="flex min-w-0 flex-col gap-1">{section && section !== "KPI Management" && <Text as="p" size={200} weight="semibold" className="uppercase tracking-[0.18em]" style={{ color: tokens.colorNeutralForegroundOnBrand, opacity: 0.75 }}>{section}</Text>}{leadingContent}<Text as="h1" size={500} weight="semibold" className="tracking-tight" style={{ color: tokens.colorNeutralForegroundOnBrand, fontFamily: titleFontFamily }}>{title}</Text>{description && <Text as="p" size={300} style={{ color: tokens.colorNeutralForegroundOnBrand, opacity: 0.85 }}>{description}</Text>}</div></div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 [&_a]:inline-flex [&_a]:h-9 [&_a]:items-center [&_a]:whitespace-nowrap [&_a]:rounded-md [&_a]:border [&_a]:border-white/30 [&_a]:bg-transparent [&_a]:px-3 [&_a]:text-sm [&_a]:font-medium [&_a]:text-white [&_a:hover]:bg-white/10 [&_button]:!whitespace-nowrap [&_button]:!border-white/35 [&_button]:!bg-transparent [&_button]:!text-white [&_button:hover]:!bg-white/10">{actions}</div>}
    </div>
  </header>
}

export function KpiFeedback({ intent, children }: { intent: "error" | "success" | "warning" | "info"; children: React.ReactNode }) {
  return <MessageBar intent={intent} role={intent === "error" ? "alert" : "status"}><MessageBarBody>{children}</MessageBarBody></MessageBar>
}

export function KpiLoading({ label }: { label: string }) {
  return <div className="py-4"><Spinner label={label} size="small" /></div>
}
