export type OnboardingWorkflowMapNode = {
  key: string
  index: number
  actionLabel: string
  status: string
  owner: string
  completedAt: string
  required: boolean
}

function titleCase(value: string) {
  return value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/^It\b/, "IT")
}

export function OnboardingWorkflowMap({ nodes, pendingApprovers = [] }: { nodes: OnboardingWorkflowMapNode[]; pendingApprovers?: string[] }) {
  if (!nodes.length) return <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">No workflow steps are available for this request.</p>
  return <ol aria-label="Onboarding workflow steps" className="overflow-hidden rounded-lg border border-border bg-background">
    {nodes.map((node, index) => {
      const done = /complete|approved|done|verified/.test(node.status)
      const pending = /pending|review|in_progress|active/.test(node.status)
      const owner = pending && pendingApprovers.length ? pendingApprovers.join(", ") : node.owner && node.owner !== "-" ? node.owner : "Unassigned"
      return <li key={node.key} className="relative flex gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
        {index < nodes.length - 1 ? <span className="absolute bottom-0 left-[25px] top-9 w-px bg-border" aria-hidden="true" /> : null}
        <span className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-600 text-white" : pending ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`} aria-hidden="true">{node.index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{titleCase(node.actionLabel)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700" : pending ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>{titleCase(node.status)}</span></div>
          <p className="mt-0.5 text-xs text-muted-foreground">{pending && pendingApprovers.length ? "Pending approver" : "Owner"}: <span className="font-medium text-foreground">{owner}</span></p>
          <p className="mt-0.5 text-xs text-muted-foreground">{node.required ? "Required step" : "Optional step"}{done && node.completedAt !== "-" ? ` · Completed ${node.completedAt}` : !done ? ` · ${pending ? "Waiting to be completed" : "Not started"}` : ""}</p>
        </div>
      </li>
    })}
  </ol>
}
