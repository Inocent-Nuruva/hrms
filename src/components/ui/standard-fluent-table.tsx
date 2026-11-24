"use client"

import * as React from "react"
import {
  Table as FluentTable,
  TableBody as FluentTableBody,
  TableCell as FluentTableCell,
  TableHeader as FluentTableHeader,
  TableHeaderCell as FluentTableHeaderCell,
  TableRow as FluentTableRow,
} from "@fluentui/react-components"

import { cn } from "@/lib/utils"

export function StandardTable({ className, ...props }: React.ComponentProps<typeof FluentTable>) {
  return <FluentTable size="small" className={cn("w-full text-left text-sm", className)} {...props} />
}

export function StandardTableHeader({ className, ...props }: React.ComponentProps<typeof FluentTableHeader>) {
  return <FluentTableHeader className={cn("bg-muted/40", className)} {...props} />
}

export function StandardTableBody({ className, ...props }: React.ComponentProps<typeof FluentTableBody>) {
  return <FluentTableBody className={className} {...props} />
}

export function StandardTableRow({ className, ...props }: React.ComponentProps<typeof FluentTableRow>) {
  return <FluentTableRow className={cn("border-b border-border/70 last:border-b-0 hover:bg-muted/40", className)} {...props} />
}

export function StandardTableHead({ className, ...props }: React.ComponentProps<typeof FluentTableHeaderCell>) {
  return <FluentTableHeaderCell className={cn("px-3 py-2 text-left text-xs font-semibold text-muted-foreground", className)} {...props} />
}

export function StandardTableCell({ className, ...props }: React.ComponentProps<typeof FluentTableCell>) {
  return <FluentTableCell className={cn("px-3 py-2 text-sm text-foreground", className)} {...props} />
}
