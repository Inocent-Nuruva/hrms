"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export interface AdminChartPoint {
  date: string
  users: number
  otherResources: number
}

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--primary)",
  },
  otherResources: {
    label: "Roles/Perms/Companies",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

interface ChartAreaInteractiveProps {
  data: AdminChartPoint[]
}

export function ChartAreaInteractive({ data }: ChartAreaInteractiveProps) {
  const [timeRange, setTimeRange] = React.useState("90d")

  const filteredData = React.useMemo(() => {
    if (data.length === 0) {
      return []
    }

    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    const lastDate = new Date(sorted[sorted.length - 1].date)
    const startDate = new Date(lastDate)

    if (timeRange === "30d") {
      startDate.setDate(startDate.getDate() - 30)
    } else if (timeRange === "7d") {
      startDate.setDate(startDate.getDate() - 7)
    } else {
      startDate.setDate(startDate.getDate() - 90)
    }

    return sorted.filter((item) => new Date(item.date) >= startDate)
  }, [data, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Platform Activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Records created across users, roles, permissions, and companies
          </span>
          <span className="@[540px]/card:hidden">Resource activity</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={(value) => setTimeRange(value[0] ?? "90d")}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={(value) => value && setTimeRange(value)}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select range"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No timestamped records returned yet. As data is created, the chart will populate.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-users)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-users)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillOther" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-otherResources)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-otherResources)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="otherResources"
                type="natural"
                fill="url(#fillOther)"
                stroke="var(--color-otherResources)"
                stackId="a"
              />
              <Area
                dataKey="users"
                type="natural"
                fill="url(#fillUsers)"
                stroke="var(--color-users)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
