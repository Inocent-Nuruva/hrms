function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-4 gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6 px-4 py-5 md:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}
