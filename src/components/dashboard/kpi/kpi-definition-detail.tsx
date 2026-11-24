"use client"

import * as React from "react"
import Link from "next/link"
import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle } from "@fluentui/react-components"
import { Archive16Regular as Archive, ArrowLeft16Regular as ArrowLeft, ArrowRight16Regular as ArrowRight, ArrowTrending20Regular as TrendingUp, Calendar16Regular as CalendarDays, CheckmarkCircle20Regular as CheckCircle2, Clock20Regular as Clock3, Dismiss16Regular as X, DocumentAdd16Regular as FilePlus2, Edit16Regular as Pencil, Eye16Regular as Eye, History20Regular as FileClock, Layer20Regular as Layers3, Send16Regular as Send, Target20Regular as Target } from "@fluentui/react-icons"
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { kpiApi, type KpiDefinition, type KpiPeriod, type KpiVersion } from "@/lib/kpi-api"
import { kpiEnabled, readKpiToken } from "@/lib/kpi-session"
import { KpiFluentButton } from "./kpi-fluent-button"
import { KpiDefinitionEditDialog } from "./kpi-definition-edit-dialog"
import { KpiAssignmentWizard } from "./kpi-setup-wizards"
import { KpiFeedback, KpiStatusBadge } from "./kpi-page-elements"

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null) {
  if (!value) return "Not published"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
}

function sameText(first: string | null | undefined, second: string | null | undefined) {
  return Boolean(first?.trim() && second?.trim()) && first?.trim().toLocaleLowerCase() === second?.trim().toLocaleLowerCase()
}

function VersionDetails({ version }: { version: KpiVersion }) {
  const rows = [
    ["Category", version.category],
    ["Measurement", `${formatLabel(version.measurementType)}${version.measurementUnit ? ` · ${version.measurementUnit}` : ""}`],
    ["Direction", formatLabel(version.direction)],
    ["Frequency", formatLabel(version.frequency)],
    ["Strategic objective", version.strategicObjective || "—"],
    ["Description", version.description || "—"],
  ]
  return <dl className="divide-y divide-border">{rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-sm font-medium">{value}</dd></div>)}</dl>
}

export function KpiDefinitionDetail({ id, embedded = false, onTitleChange, onAssign }: { id: number; embedded?: boolean; onTitleChange?: (title: string) => void; onAssign?: (definitionId: number) => void }) {
  const actor = useDashboardActor()
  const canArchive = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role)) ?? false
  const canEdit = canArchive || actor.roleNames?.some((role) => ["DEPARTMENT_MANAGER", "BRANCH_MANAGER"].includes(role)) || actor.permissionLabels.includes("kpi_definitions:create")
  const canAssign = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER"].includes(role)) || actor.permissionLabels.includes("kpi_assignments:create")
  const [record, setRecord] = React.useState<KpiDefinition | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [selectedVersion, setSelectedVersion] = React.useState<KpiVersion | null>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [assignLoading, setAssignLoading] = React.useState(false)
  const [assignError, setAssignError] = React.useState("")
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([])
  const token = readKpiToken()
  const onTitleChangeRef = React.useRef(onTitleChange)
  React.useEffect(() => { onTitleChangeRef.current = onTitleChange }, [onTitleChange])
  const reload = React.useCallback(async () => {
    if (!token || !kpiEnabled) return
    setLoading(true)
    try {
      const definition = await kpiApi.definition(token, id)
      setRecord(definition)
      onTitleChangeRef.current?.(definition.currentVersion?.name ?? definition.versions?.[0]?.name ?? "KPI")
      setError("")
    }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load KPI") }
    finally { setLoading(false) }
  }, [token, id])
  React.useEffect(() => { void reload() }, [reload])
  async function action(task: () => Promise<unknown>) {
    setBusy(true)
    try { await task(); await reload(); window.dispatchEvent(new Event("hrms:refresh-page-data")) }
    catch (err) { setError(err instanceof Error ? err.message : "Action failed") }
    finally { setBusy(false) }
  }
  function openAssignment() {
    if (onAssign) { onAssign(id); return }
    setAssignOpen(true)
    setAssignLoading(true)
    setAssignError("")
    void kpiApi.periods(token).then(setPeriods).catch((cause: unknown) => {
      setAssignError(cause instanceof Error ? cause.message : "Could not load reporting periods")
    }).finally(() => setAssignLoading(false))
  }
  if (!kpiEnabled) return <p className="p-6">KPI definitions are disabled.</p>

  const versions = record?.versions ?? []
  const currentVersion = record?.currentVersion ?? versions[0]
  const hasDraft = Boolean(record?.draftVersion) || Boolean(currentVersion && !currentVersion.publishedAt)
  const archived = record?.status === "archived"
  const metrics = [
    { label: "Measurement", value: currentVersion ? `${formatLabel(currentVersion.measurementType)}${currentVersion.measurementUnit ? ` · ${currentVersion.measurementUnit}` : ""}` : "—", icon: Target },
    { label: "Direction", value: currentVersion ? formatLabel(currentVersion.direction) : "—", icon: TrendingUp },
    { label: "Frequency", value: currentVersion ? formatLabel(currentVersion.frequency) : "—", icon: CalendarDays },
    { label: "Versions", value: String(versions.length), icon: Layers3 },
  ]

  return <div className="mx-auto min-w-0 max-w-6xl space-y-8 pb-10 pt-4">
    <header className="space-y-5 border-b border-border pb-6">
      {!embedded && <Link href="/dashboard/kpi" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft aria-hidden="true" /> KPI Library</Link>}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-3xl">
          {!embedded && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">KPI definition {record?.code && !sameText(record.code, currentVersion?.name) && `· ${record.code}`}</p>}
          <div className={`${embedded ? "" : "mt-2"} flex flex-wrap items-center gap-3`}>{!embedded && <h1 className="break-words font-semibold tracking-tight" style={{ fontFamily: "var(--font-fredoka), sans-serif", fontSize: "clamp(28px, 3vw, 38px)", lineHeight: 1.15 }}>{currentVersion?.name ?? "KPI definition"}</h1>}{record && <KpiStatusBadge status={record.status === "published" && hasDraft ? "draft_revision" : record.status} />}</div>
          {currentVersion?.category && !sameText(currentVersion.category, currentVersion.name) && <p className="mt-2 break-words text-xs text-muted-foreground">Category: <span className="font-medium text-primary">{currentVersion.category}</span></p>}
          {currentVersion?.description && !sameText(currentVersion.description, currentVersion.name) && !sameText(currentVersion.description, currentVersion.category) && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{currentVersion.description}</p>}
        </div>
        {record && <div className="flex flex-wrap items-center gap-2">
          {canEdit && !archived && (hasDraft ? <><Button type="button" appearance="secondary" icon={<Pencil aria-hidden="true" />} onClick={() => setEditOpen(true)}>Edit draft</Button><KpiFluentButton type="button" disabled={busy} className="bg-[var(--primary)]" onClick={() => void action(() => kpiApi.publishDefinition(token, id))}><Send aria-hidden="true" />Publish draft</KpiFluentButton></> : <KpiFluentButton type="button" disabled={busy} className="bg-[var(--primary)]" onClick={() => void action(() => kpiApi.reviseDefinition(token, id))}><FilePlus2 aria-hidden="true" />Create draft revision</KpiFluentButton>)}
          {canArchive && !archived && <KpiFluentButton type="button" disabled={busy} className="text-red-700" onClick={() => { void fluentConfirm("Archive this KPI definition? Existing assignments will remain.").then((confirmed) => { if (confirmed) void action(() => kpiApi.archiveDefinition(token, id)) }) }}><Archive aria-hidden="true" />Archive</KpiFluentButton>}
        </div>}
      </div>
    </header>

    {loading && <p className="text-sm text-muted-foreground" role="status">Loading KPI definition…</p>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {record && <>
      <section aria-labelledby="definition-overview" className="space-y-4">
        <div className="flex items-start gap-3"><Target className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div><h2 id="definition-overview" className="text-base font-semibold">How this KPI is measured</h2><p className="mt-1 text-sm text-muted-foreground">The rules used when setting targets and recording results.</p></div></div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <div key={label} className="min-w-0 border-t border-border pt-4"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="shrink-0 text-primary" aria-hidden="true" />{label}</dt><dd className="mt-2 break-words text-base font-semibold">{value}</dd></div>)}</dl>
        {currentVersion?.strategicObjective && ![currentVersion.name, currentVersion.category, currentVersion.description].some((value) => sameText(currentVersion.strategicObjective, value)) && <div className="border-t border-border pt-4"><h3 className="text-sm font-medium text-muted-foreground">Strategic objective</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{currentVersion.strategicObjective}</p></div>}
      </section>

      <section aria-labelledby="definition-next" className="border-y border-border py-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-start gap-3">{archived ? <Clock3 className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}<div><h2 id="definition-next" className="text-base font-semibold">{archived ? "Archived definition" : hasDraft ? "Prepare this definition" : "Ready to assign"}</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{archived ? "Existing assignments and their history remain available." : hasDraft ? "Review the draft and publish it before using it for new assignments." : "Use this published definition to set targets and assign the KPI for a reporting period."}</p></div></div>{!archived && !hasDraft && canAssign && <Button type="button" appearance="secondary" icon={<ArrowRight aria-hidden="true" />} onClick={openAssignment}>Assign this KPI</Button>}</div>
      </section>

      <section aria-labelledby="definition-history" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><FileClock className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div><h2 id="definition-history" className="text-base font-semibold">Version history</h2><p className="mt-1 text-sm text-muted-foreground">Past assignments and reports keep their original published version.</p></div></div><span className="text-sm text-muted-foreground">{versions.length} {versions.length === 1 ? "version" : "versions"}</span></div>
        {versions.length ? <ul className="divide-y divide-border border-y border-border">{versions.map((version) => <li key={version.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">v{version.version}</span><div className="min-w-0 flex-1 basis-40"><p className="break-words text-sm font-semibold">{version.name}</p><p className="mt-1 break-words text-xs text-muted-foreground">{!sameText(version.category, version.name) && <>Category: <span className="font-medium text-primary">{version.category}</span> · </>}{formatLabel(version.measurementType)}{version.measurementUnit ? ` · ${version.measurementUnit}` : ""}</p></div><div className="flex flex-wrap items-center gap-3"><KpiStatusBadge status={version.publishedAt ? "published" : "draft"} /><span className="text-xs text-muted-foreground">{formatDate(version.publishedAt)}</span><Button appearance="subtle" size="small" aria-label={`View details for version ${version.version}`} onClick={() => setSelectedVersion(version)} icon={<Eye aria-hidden="true" />}>View details</Button></div></li>)}</ul> : <p className="border-t border-border py-5 text-sm text-muted-foreground">No versions are available yet.</p>}
      </section>
    </>}
    <Dialog open={!!selectedVersion} onOpenChange={(_, data) => { if (!data.open) setSelectedVersion(null) }}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>{selectedVersion ? `Version ${selectedVersion.version}: ${selectedVersion.name}` : "Version details"}</DialogTitle><DialogContent>{selectedVersion && <><div className="flex flex-wrap items-center gap-2"><KpiStatusBadge status={selectedVersion.publishedAt ? "published" : "draft"} /><span className="text-sm text-muted-foreground">{formatDate(selectedVersion.publishedAt)}</span></div><VersionDetails version={selectedVersion} /></>}</DialogContent><div className="flex justify-end pt-3"><Button appearance="secondary" onClick={() => setSelectedVersion(null)} icon={<X aria-hidden="true" />}>Close</Button></div></DialogBody></DialogSurface></Dialog>
    {!onAssign && <Dialog open={assignOpen} onOpenChange={(_, data) => { if (!data.open) setAssignOpen(false) }}><DialogSurface style={{ width: "min(64rem, calc(100vw - 2rem))", maxWidth: "calc(100vw - 2rem)" }} className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>Assign {currentVersion?.name ?? "KPI"}</DialogTitle><DialogContent className="max-h-[calc(90vh-8rem)] overflow-y-auto">{assignLoading ? <p role="status">Loading reporting periods…</p> : assignError ? <KpiFeedback intent="error">{assignError}</KpiFeedback> : record && <KpiAssignmentWizard token={token} definitions={[record]} periods={periods} initialDefinitionId={String(id)} onCancel={() => setAssignOpen(false)} onDone={() => { setAssignOpen(false); window.dispatchEvent(new Event("hrms:refresh-page-data")) }} />}</DialogContent></DialogBody></DialogSurface></Dialog>}
    <KpiDefinitionEditDialog definitionId={editOpen ? id : null} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); void reload() }} />
  </div>
}
