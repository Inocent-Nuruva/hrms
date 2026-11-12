"use client"

import * as React from "react"
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text } from "@fluentui/react-components"
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { KpiFluentButton } from "./kpi-fluent-button"
import { KpiStatusBadge } from "./kpi-page-elements"
import Link from "next/link"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { kpiApi, type KpiDefinition, type KpiVersion } from "@/lib/kpi-api"
import { kpiEnabled, readKpiToken } from "@/lib/kpi-session"
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance"

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null) {
  if (!value) return "Draft"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
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
  return <div className="overflow-hidden rounded-md border border-border"><Table aria-label={`Version ${version.version} details`} size="small" className="w-full text-left text-sm"><TableBody>{rows.map(([label, value]) => <TableRow key={label}><TableHeaderCell className="w-1/3 px-3 py-2 font-medium">{label}</TableHeaderCell><TableCell className="px-3 py-2">{value}</TableCell></TableRow>)}</TableBody></Table></div>
}

export function KpiDefinitionDetail({ id }: { id: number }) {
  const actor = useDashboardActor()
  const canEdit = actor.roleNames?.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role)) ?? false
  const [record, setRecord] = React.useState<KpiDefinition | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [selectedVersion, setSelectedVersion] = React.useState<KpiVersion | null>(null)
  const token = readKpiToken()
  const reload = React.useCallback(async () => { if (!token || !kpiEnabled) return; setLoading(true); try { setRecord(await kpiApi.definition(token, id)); setError("") } catch (err) { setError(err instanceof Error ? err.message : "Failed to load KPI") } finally { setLoading(false) } }, [token, id])
  React.useEffect(() => { void reload() }, [reload])
  async function action(task: () => Promise<unknown>) { setBusy(true); try { await task(); await reload(); window.dispatchEvent(new Event("hrms:refresh-page-data")) } catch (err) { setError(err instanceof Error ? err.message : "Action failed") } finally { setBusy(false) } }
  if (!kpiEnabled) return <p className="p-6">KPI Phase 1A is disabled.</p>

  const versions = record?.versions ?? []
  const currentVersion = record?.currentVersion ?? versions[0]

  return <div className="space-y-4 pt-3">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="space-y-1"><Link href="/dashboard/kpi" className="text-sm text-primary hover:underline">KPI Library</Link><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{record ? `Definition ${record.code}` : "KPI definition"}</h1>{record && <KpiStatusBadge status={record.status} />}</div><p className="text-sm text-muted-foreground">Review details, workflow and version history.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {record && canEdit && record.status !== "archived" && (currentVersion?.publishedAt ? <KpiFluentButton disabled={busy} className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-white" onClick={() => void action(() => kpiApi.reviseDefinition(token, id))}>Create draft revision</KpiFluentButton> : <><Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted" href={`/dashboard/kpi/create?edit=${id}`}>Edit draft</Link><KpiFluentButton disabled={busy} className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-white" onClick={() => void action(() => kpiApi.publishDefinition(token, id))}>Publish draft</KpiFluentButton></>)}
        {record && canEdit && record.status !== "archived" && <KpiFluentButton disabled={busy} className="rounded border border-red-600 px-3 py-2 text-sm text-red-700" onClick={() => { void fluentConfirm("Archive this KPI definition? Existing assignments will remain.").then((confirmed) => { if (confirmed) void action(() => kpiApi.archiveDefinition(token, id)) }) }}>Archive</KpiFluentButton>}
      </div>
    </div>
    {record && <KpiWorkflowGuidancePanel recordKind="definition" recordId={id} compact />}
    {loading && <p className="py-5 text-sm text-muted-foreground">Loading KPI definition…</p>}
    {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    {record && <>
      <section className="rounded-lg border border-border bg-card" aria-label="KPI definition summary">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Current definition</h2>
          <p className="text-sm text-muted-foreground">{currentVersion?.name ?? "KPI definition"}{currentVersion?.category ? ` · ${currentVersion.category}` : ""}</p>
        </div>
        <div className="grid gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Text size={200} style={{ color: "var(--muted-foreground)" }}>Measurement</Text><p className="text-sm">{currentVersion ? `${formatLabel(currentVersion.measurementType)}${currentVersion.measurementUnit ? ` · ${currentVersion.measurementUnit}` : ""}` : "—"}</p></div>
          <div><Text size={200} style={{ color: "var(--muted-foreground)" }}>Direction</Text><p className="text-sm">{currentVersion ? formatLabel(currentVersion.direction) : "—"}</p></div>
          <div><Text size={200} style={{ color: "var(--muted-foreground)" }}>Frequency</Text><p className="text-sm">{currentVersion ? formatLabel(currentVersion.frequency) : "—"}</p></div>
          <div><Text size={200} style={{ color: "var(--muted-foreground)" }}>Versions</Text><p className="text-sm">{versions.length}</p></div>
        </div>
      </section>

      <section className="space-y-2" aria-label="Version history">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-semibold">Version history</h2><p className="text-sm text-muted-foreground">Published versions remain available to past assignments and reports.</p></div><Badge appearance="outline" color="informative">{versions.length} {versions.length === 1 ? "version" : "versions"}</Badge></div>
        {versions.length ? <div className="overflow-x-auto"><Table aria-label="KPI version history" size="small" className="w-full text-left text-sm"><TableHeader><TableRow><TableHeaderCell>Version</TableHeaderCell><TableHeaderCell>Name and category</TableHeaderCell><TableHeaderCell>Measurement</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Published</TableHeaderCell><TableHeaderCell>Details</TableHeaderCell></TableRow></TableHeader><TableBody>{versions.map((version) => <TableRow key={version.id}><TableCell>v{version.version}</TableCell><TableCell><span className="font-medium">{version.name}</span><span className="block text-xs text-muted-foreground">{version.category}</span></TableCell><TableCell>{formatLabel(version.measurementType)}{version.measurementUnit ? ` · ${version.measurementUnit}` : ""}</TableCell><TableCell><KpiStatusBadge status={version.publishedAt ? "published" : "draft"} /></TableCell><TableCell>{formatDate(version.publishedAt)}</TableCell><TableCell><Button appearance="subtle" size="small" aria-label={`View details for version ${version.version}`} onClick={() => setSelectedVersion(version)}>View</Button></TableCell></TableRow>)}</TableBody></Table></div> : <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No versions are available yet.</div>}
      </section>
    </>}

    <Dialog open={!!selectedVersion} onOpenChange={(_, data) => { if (!data.open) setSelectedVersion(null) }}><DialogSurface className="max-h-[90vh] overflow-y-auto"><DialogBody><DialogTitle>{selectedVersion ? `Version ${selectedVersion.version}: ${selectedVersion.name}` : "Version details"}</DialogTitle><DialogContent className="space-y-3">{selectedVersion && <><div className="flex flex-wrap items-center gap-2"><KpiStatusBadge status={selectedVersion.publishedAt ? "published" : "draft"} /><span className="text-sm text-muted-foreground">{formatDate(selectedVersion.publishedAt)}</span></div><VersionDetails version={selectedVersion} /></>}</DialogContent><div className="flex justify-end pt-3"><Button appearance="secondary" onClick={() => setSelectedVersion(null)}>Close</Button></div></DialogBody></DialogSurface></Dialog>
  </div>
}
