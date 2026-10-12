"use client"

import { Skeleton, SkeletonItem } from "@fluentui/react-components"

import { cn } from "@/lib/utils"

export function AccessSkeleton({
  className,
  variant = "table",
}: {
  className?: string
  variant?: "table" | "dashboard"
}) {
  return (
    <Skeleton
      aria-label="Checking access"
      className={cn("w-full p-3 sm:p-4", className)}
    >
      {variant === "dashboard" ? (
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-border/60 p-4">
              <SkeletonItem className="max-w-36" size={16} />
              <SkeletonItem className="max-w-20" size={32} />
              <SkeletonItem className="max-w-52" size={12} />
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SkeletonItem className="max-w-52" size={20} />
            <div className="flex items-center gap-2">
              <SkeletonItem className="w-28" size={32} />
              <SkeletonItem className="w-20" size={32} />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <div className="grid grid-cols-4 gap-4 border-b border-border/60 px-3 py-3">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonItem key={index} className="h-3 max-w-28" />
              ))}
            </div>
            {Array.from({ length: 5 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-4 gap-4 border-b border-border/60 px-3 py-3 last:border-b-0"
              >
                {Array.from({ length: 4 }, (_, columnIndex) => (
                  <SkeletonItem
                    key={columnIndex}
                    className={cn("h-3", columnIndex === 0 ? "max-w-36" : "max-w-24")}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Skeleton>
  )
}

export function DashboardShellSkeleton() {
  return (
    <div className="grid min-h-svh grid-cols-1 bg-background md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-[var(--sidebar)] p-3 md:block">
        <Skeleton aria-label="Loading navigation" className="grid gap-3">
          <SkeletonItem className="mb-3 w-7" size={28} />
          {Array.from({ length: 11 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-1">
              <SkeletonItem shape="square" size={20} />
              <SkeletonItem className={index % 3 === 0 ? "max-w-32" : "max-w-28"} size={12} />
            </div>
          ))}
        </Skeleton>
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <Skeleton aria-label="Loading header" className="flex w-full items-center justify-between gap-4">
            <SkeletonItem className="max-w-72" size={32} />
            <div className="flex items-center gap-3">
              <SkeletonItem className="w-24" size={20} />
              <SkeletonItem shape="circle" size={28} />
            </div>
          </Skeleton>
        </header>
        <main className="p-4">
          <Skeleton aria-label="Loading page" className="grid gap-4">
            <div className="flex items-center gap-3">
              <SkeletonItem className="max-w-24" size={20} />
              <SkeletonItem className="max-w-32" size={20} />
              <SkeletonItem className="max-w-28" size={20} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <SkeletonItem className="max-w-52" size={20} />
              <div className="flex items-center gap-2">
                <SkeletonItem className="w-28" size={32} />
                <SkeletonItem className="w-20" size={32} />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="grid grid-cols-4 gap-4 border-b border-border/60 px-3 py-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <SkeletonItem key={index} className="h-3 max-w-28" />
                ))}
              </div>
              {Array.from({ length: 5 }, (_, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid grid-cols-4 gap-4 border-b border-border/60 px-3 py-3 last:border-b-0"
                >
                  {Array.from({ length: 4 }, (_, columnIndex) => (
                    <SkeletonItem
                      key={columnIndex}
                      className={cn("h-3", columnIndex === 0 ? "max-w-36" : "max-w-24")}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Skeleton>
        </main>
      </div>
    </div>
  )
}
