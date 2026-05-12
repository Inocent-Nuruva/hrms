"use client"

import * as React from "react"

import {
  Tabs as BaseTabs,
  TabsContent as BaseTabsContent,
  TabsList as BaseTabsList,
  TabsTrigger as BaseTabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<typeof BaseTabs>) {
  return <BaseTabs className={cn("w-full", className)} {...props} />
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabsList>) {
  return (
    <BaseTabsList
      className={cn("w-full rounded-md border border-border/70 bg-muted/30 p-1", className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabsTrigger>) {
  return (
    <BaseTabsTrigger
      className={cn(
        "h-8 rounded-sm px-3 text-sm font-medium transition-all duration-300 ease-out data-active:bg-background data-active:text-foreground data-active:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContents({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300 ease-out",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof BaseTabsContent>) {
  return (
    <BaseTabsContent
      className={cn("animate-in fade-in-0 zoom-in-[0.99] duration-300", className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger }
