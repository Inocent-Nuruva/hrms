"use client"

import * as React from "react"
import {
  Card as FluentCard, MessageBar, MessageBarBody, MessageBarTitle,
  Table as FluentTable, TableBody, TableCell, TableHeader,
  TableHeaderCell, TableRow,
} from "@fluentui/react-components"

type SectionProps = React.HTMLAttributes<HTMLDivElement>

/** Existing KPI analytics names retained while their controls use Fluent UI v9. */
export function Card({ size, className, ...props }: SectionProps & { size?: "sm" }) {
  return <FluentCard size={size === "sm" ? "small" : "medium"} className={className} {...props} />
}
export function CardHeader({ className = "", ...props }: SectionProps) {
  return <div className={`space-y-1 ${className}`} {...props} />
}
export function CardTitle({ className = "", ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`font-semibold text-foreground ${className}`} {...props} />
}
export function CardDescription({ className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm text-muted-foreground ${className}`} {...props} />
}
export function CardContent({ className = "", ...props }: SectionProps) {
  return <div className={className} {...props} />
}
export { FluentTable as Table, TableBody, TableCell, TableHeader, TableRow }
export const TableHead = TableHeaderCell

export function Alert({ variant, children, ...props }: React.ComponentProps<typeof MessageBar> & { variant?: "destructive" }) {
  return <MessageBar intent={variant === "destructive" ? "error" : "info"} {...props}><MessageBarBody>{children}</MessageBarBody></MessageBar>
}
export function AlertTitle(props: React.ComponentProps<typeof MessageBarTitle>) { return <MessageBarTitle {...props} /> }
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={className} {...props} /> }
