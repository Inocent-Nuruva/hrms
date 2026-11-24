"use client"

import * as React from "react"
import Link from "next/link"
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  ProgressBar,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tooltip,
} from "@fluentui/react-components"
import { Add16Regular, Delete16Regular, Dismiss20Regular, Info20Regular } from "@fluentui/react-icons"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session"
import { scorecardApi, type RatingBand, type ScoringConfig, type ScoringPolicy } from "@/lib/scorecard-api"
import { KpiFluentSelect } from "./kpi-fluent-fields"
import { kpiIdentifierFromName } from "./kpi-identifier"
import { KpiFeedback, KpiPageHeader } from "./kpi-page-elements"

const initialBands: RatingBand[] = [
  { label: "Unsatisfactory", from: 0, to: 60 },
  { label: "Needs Improvement", from: 60, to: 70 },
  { label: "Satisfactory", from: 70, to: 80 },
  { label: "Good", from: 80, to: 90 },
  { label: "Excellent", from: 90, to: 100 },
]
const initialConfig: ScoringConfig = {
  minScore: 0,
  maxScore: 100,
  scoreCap: 100,
  displayDecimals: 2,
  missingTreatment: "block",
  notApplicableTreatment: "block",
  exactTolerance: 0,
  qualitativeRubric: [],
}
const policySteps = ["Details", "Calculation", "Rating bands", "Qualitative", "Review"] as const

function SectionHeading({ id, number, title, description, action }: { id: string; number: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 border-l-2 border-primary pl-2 text-xs font-bold tracking-wider text-primary">{number}</span>
      <div><h3 id={id} className="text-base font-semibold text-foreground sm:text-lg">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
    </div>
    {action}
  </div>
}

function SettingRow({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.9fr)] sm:items-center sm:gap-6">
    <div className="min-w-0"><label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>{hint && <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}</div>
    <div className="min-w-0">{children}</div>
  </div>
}

function NumberField({ id, label, value, onChange, hint, min, max, step }: { id: string; label: string; value: number; onChange: (value: number) => void; hint?: string; min?: number; max?: number; step?: string }) {
  return <SettingRow id={id} label={label} hint={hint}>
    <Input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className="w-full" type="number" min={min} max={max} step={step ?? "any"} value={String(value)} onChange={(_, data) => onChange(Number(data.value))} />
  </SettingRow>
}

export function ScorecardPolicies() {
  const actor = useDashboardActor()
  const token = readKpiToken()
  const [policies, setPolicies] = React.useState<ScoringPolicy[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<number | null>(null)
  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [method, setMethod] = React.useState<"weighted" | "strategic">("weighted")
  const [config, setConfig] = React.useState<ScoringConfig>(initialConfig)
  const [bands, setBands] = React.useState<RatingBand[]>(initialBands)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [step, setStep] = React.useState(0)
  const loadSequence = React.useRef(0)
  const saveInFlight = React.useRef(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { contentRef.current?.scrollTo({ top: 0 }) }, [step])

  const load = React.useCallback(async () => {
    if (!token || !scorecardsEnabled) return
    const sequence = ++loadSequence.current
    setLoading(true)
    try {
      const next = await scorecardApi.policies(token)
      if (sequence === loadSequence.current) { setPolicies(next); setError("") }
    } catch (cause) {
      if (sequence === loadSequence.current) setError(cause instanceof Error ? cause.message : "Unable to load policies")
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [token])
  React.useEffect(() => { if (actor.ready) void load() }, [actor.ready, load])

  const canEdit = actor.roleNames.some((role) => ["COMPANY_ADMIN", "HR_MANAGER"].includes(role))
  function reset() {
    setEditing(null); setCode(""); setName(""); setMethod("weighted")
    setConfig({ ...initialConfig, qualitativeRubric: [] }); setBands(initialBands.map((band) => ({ ...band })))
    setError(""); setStep(0)
  }
  function closeDialog() { if (!busy) { setDialogOpen(false); reset() } }
  function edit(row: ScoringPolicy) {
    const version = row.versions[0]
    setEditing(row.id); setCode(row.code); setName(version.name); setMethod(version.method)
    setConfig({ ...version.config, qualitativeRubric: version.config.qualitativeRubric.map((item) => ({ ...item })) })
    setBands(version.ratingBands.map((band) => ({ ...band })))
    setNotice(""); setError(""); setStep(0); setDialogOpen(true)
  }
  async function action(run: () => Promise<ScoringPolicy>, message: string) {
    if (busy) return false
    setBusy(true); setError(""); setNotice("")
    try {
      const updated = await run()
      ++loadSequence.current
      setPolicies((rows) => [updated, ...rows.filter((row) => row.id !== updated.id)])
      setNotice(message)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed")
      return false
    } finally { setBusy(false) }
  }
  function stepError(index: number) {
    if (index === 0 && (!name.trim() || !code.trim())) return "Enter a policy name and identifier."
    if (index === 1 && (!Number.isFinite(config.minScore) || !Number.isFinite(config.maxScore) || !Number.isFinite(config.scoreCap) || config.maxScore <= config.minScore || config.scoreCap < config.minScore || config.scoreCap > config.maxScore || !Number.isInteger(config.displayDecimals) || config.displayDecimals < 0 || config.displayDecimals > 6 || !Number.isFinite(config.exactTolerance) || config.exactTolerance < 0)) return "Check the score range, cap, decimal places, and tolerance."
    const ordered = [...bands].sort((a, b) => a.from - b.from)
    if (index === 2 && (!ordered.length || ordered.some((band) => !band.label.trim()) || ordered[0].from !== config.minScore || ordered.at(-1)?.to !== config.scoreCap || ordered.some((band, position) => !Number.isFinite(band.from) || !Number.isFinite(band.to) || band.from >= band.to || (position > 0 && ordered[position - 1].to !== band.from)))) return "Name each rating and cover the full score range without gaps or overlaps."
    if (index === 3 && config.qualitativeRubric.some((item) => !item.label.trim() || !Number.isFinite(item.score) || item.score < config.minScore || item.score > config.scoreCap)) return "Give every qualitative rating a name and a score within the policy range."
    return ""
  }
  function nextStep() {
    const problem = stepError(step)
    if (problem) { setError(problem); return }
    setError(""); setStep((current) => Math.min(current + 1, policySteps.length - 1))
  }
  async function save(event?: React.FormEvent, publish = false) {
    event?.preventDefault()
    if (saveInFlight.current || busy) return
    if (step < policySteps.length - 1) { nextStep(); return }
    for (let index = 0; index < policySteps.length - 1; index += 1) {
      const problem = stepError(index)
      if (problem) { setStep(index); setError(problem); return }
    }
    const ordered = [...bands].sort((a, b) => a.from - b.from)
    saveInFlight.current = true
    setBusy(true); setError(""); setNotice("")
    let saved: ScoringPolicy | null = null
    try {
      const draft = editing
        ? await scorecardApi.updatePolicy(token, editing, { name, method, config, ratingBands: ordered })
        : await scorecardApi.createPolicy(token, { code, name, method, config, ratingBands: ordered })
      saved = draft
      setEditing(draft.id)
      ++loadSequence.current
      setPolicies((rows) => [draft, ...rows.filter((row) => row.id !== draft.id)])
      if (publish) {
        const published = await scorecardApi.publishPolicy(token, draft.id)
        setPolicies((rows) => [published, ...rows.filter((row) => row.id !== published.id)])
      }
      setNotice(publish ? "Scoring policy published and ready for scorecards." : "Policy draft saved.")
      setDialogOpen(false)
      reset()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Action failed"
      setError(saved && publish ? `Draft saved, but publication failed: ${message}. You can try publishing again.` : message)
    } finally {
      saveInFlight.current = false
      setBusy(false)
    }
  }
  function updateBand(index: number, change: Partial<RatingBand>) {
    setBands((rows) => rows.map((band, position) => position === index ? { ...band, ...change } : band))
  }
  function updateRubric(index: number, change: Partial<ScoringConfig["qualitativeRubric"][number]>) {
    setConfig((current) => ({ ...current, qualitativeRubric: current.qualitativeRubric.map((item, position) => position === index ? { ...item, ...change } : item) }))
  }

  if (!scorecardsEnabled) return <p className="p-6">Scorecards are disabled in this environment.</p>
  return <div className="space-y-4">
    <KpiPageHeader title="Scoring Policies" description="Set the rules for calculating KPI scorecards." actions={<Link className="inline-flex h-8 items-center border border-border px-3 text-xs font-medium hover:bg-muted" href="/dashboard/kpi/scorecards">Back to scorecards</Link>} />
    {loading && <p>Loading policies…</p>}
    {!dialogOpen && error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
    {canEdit && <Button appearance="primary" icon={<Add16Regular />} onClick={() => { reset(); setDialogOpen(true) }}>Create scoring policy</Button>}

    <Dialog open={canEdit && dialogOpen} onOpenChange={(_, data) => { if (!data.open) closeDialog() }}>
      <DialogSurface style={{ width: "min(92vw, 760px)", maxWidth: "none" }} className="!h-[min(90dvh,42rem)] !rounded-none !p-0">
        <DialogBody className="!flex h-full min-h-0 flex-col gap-0">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5 sm:px-8">
            <DialogTitle className="text-xl font-semibold sm:text-2xl">{editing ? "Edit scoring policy" : "Create scoring policy"}</DialogTitle>
            <Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close scoring policy" onClick={closeDialog} />
          </div>
          <div className="shrink-0 border-b border-border px-6 py-4 sm:px-8">
            <div className="flex items-center justify-between gap-3 text-sm"><strong>{policySteps[step]}</strong><span className="text-muted-foreground">Step {step + 1} of {policySteps.length}</span></div>
            <ProgressBar className="mt-2" value={(step + 1) / policySteps.length} aria-label={`Step ${step + 1} of ${policySteps.length}`} />
            <ol className="mt-3 grid grid-cols-5 gap-2" aria-label="Scoring policy steps">{policySteps.map((label, index) => <li key={label} className={`flex min-w-0 items-center gap-2 text-xs ${index === step ? "font-semibold text-primary" : index < step ? "text-foreground" : "text-muted-foreground"}`} aria-current={index === step ? "step" : undefined}><span className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${index <= step ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{index + 1}</span><span className="hidden truncate sm:inline">{label}</span></li>)}</ol>
          </div>
          <DialogContent ref={contentRef} style={{ padding: "clamp(24px, 3vw, 36px) clamp(24px, 4vw, 40px)" }} className="!m-0 min-h-0 flex-1 overflow-y-auto">
            <form id="scoring-policy-form" onSubmit={(event) => void save(event)} className="space-y-10">
              {error && <KpiFeedback intent="error">{error}</KpiFeedback>}

              {step === 0 && <section className="space-y-8" aria-labelledby="policy-basics-heading">
                <SectionHeading id="policy-basics-heading" number="01" title="Policy details" description="Give this rule set a name and choose how scorecards will use it." action={<Tooltip content="Approved KPI results use this policy to become scores. Review the rules and rating bands, then save a draft or publish directly." relationship="description"><Button type="button" appearance="subtle" icon={<Info20Regular />} aria-label="About scoring policies" /></Tooltip>} />
                <div className="grid gap-y-6">
                  <Field label="Policy name" required><Input className="w-full" value={name} maxLength={160} placeholder="e.g. Monthly employee performance" onChange={(_, data) => { if (!editing && (!code || code === kpiIdentifierFromName(name))) setCode(kpiIdentifierFromName(data.value)); setName(data.value) }} /></Field>
                  <Field label="Identifier" hint="Generated from the name; you can adjust it before saving." required><Input className="w-full" value={code} disabled={!!editing} maxLength={80} onChange={(_, data) => setCode(data.value.toUpperCase())} /></Field>
                  <Field label="Scoring method" hint={method === "weighted" ? "Combines KPI results using the weights on a scorecard." : "Shows KPI progress without one combined score."}>
                    <KpiFluentSelect className="w-full" value={method} onChange={(event) => setMethod(event.target.value as "weighted" | "strategic")}>
                      <option value="weighted">Weighted score</option><option value="strategic">Strategic status only</option>
                    </KpiFluentSelect>
                  </Field>
                </div>
              </section>}

              {step === 1 && <section className="space-y-8" aria-labelledby="policy-calculation-heading">
                <SectionHeading id="policy-calculation-heading" number="02" title="Calculation rules" description="Use 0 to 100 for a standard score. These settings control rounding and how incomplete results are handled." />
                <div className="divide-y divide-border/70 border-y border-border/70">
                  <NumberField id="policy-min-score" label="Minimum score" value={config.minScore} onChange={(value) => setConfig((current) => ({ ...current, minScore: value }))} />
                  <NumberField id="policy-max-score" label="Maximum score" value={config.maxScore} onChange={(value) => setConfig((current) => ({ ...current, maxScore: value }))} />
                  <NumberField id="policy-score-cap" label="Score cap" hint="Highest score a KPI can contribute." value={config.scoreCap} onChange={(value) => setConfig((current) => ({ ...current, scoreCap: value }))} />
                  <NumberField id="policy-decimal-places" label="Decimal places" value={config.displayDecimals} min={0} max={6} step="1" onChange={(value) => setConfig((current) => ({ ...current, displayDecimals: value }))} />
                  <NumberField id="policy-exact-tolerance" label="Exact target tolerance" hint="Allowed difference from an exact target." value={config.exactTolerance} min={0} onChange={(value) => setConfig((current) => ({ ...current, exactTolerance: value }))} />
                  <SettingRow id="policy-missing-treatment" label="When a result is missing" hint="Choose whether an incomplete KPI prevents a score.">
                    <KpiFluentSelect id="policy-missing-treatment" className="w-full" value={config.missingTreatment} onChange={(event) => setConfig((current) => ({ ...current, missingTreatment: event.target.value as ScoringConfig["missingTreatment"] }))}>
                      <option value="block">Block scoring</option><option value="exclude_optional">Exclude optional KPIs</option>
                    </KpiFluentSelect>
                  </SettingRow>
                  <SettingRow id="policy-not-applicable-treatment" label="When a KPI is not applicable" hint="Choose how its weight affects the final score.">
                    <KpiFluentSelect id="policy-not-applicable-treatment" className="w-full" value={config.notApplicableTreatment} onChange={(event) => setConfig((current) => ({ ...current, notApplicableTreatment: event.target.value as ScoringConfig["notApplicableTreatment"] }))}>
                      <option value="block">Block scoring</option><option value="redistribute">Redistribute its weight</option>
                    </KpiFluentSelect>
                  </SettingRow>
                </div>
              </section>}

              {step === 2 && <section className="space-y-8" aria-labelledby="policy-bands-heading">
                <SectionHeading id="policy-bands-heading" number="03" title="Rating bands" description="Give each score range a rating. The ranges must meet with no gaps or overlaps, from minimum score to score cap." action={<Button type="button" appearance="subtle" icon={<Add16Regular />} onClick={() => setBands((rows) => [...rows, { label: "", from: rows.at(-1)?.to ?? config.minScore, to: config.scoreCap }])}>Add band</Button>} />
                <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_2.5rem] gap-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>Rating</span><span>From</span><span>To</span><span className="sr-only">Action</span>
                </div>
                <div className="divide-y divide-border/70">
                  {bands.map((band, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-end gap-4 py-5 first:pt-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_2.5rem]">
                    <div className="col-span-3 min-w-0 sm:col-span-1"><label className="mb-1 block text-xs text-muted-foreground sm:sr-only" htmlFor={`band-name-${index}`}>Rating</label><Input id={`band-name-${index}`} className="w-full" aria-label={`Rating ${index + 1} name`} value={band.label} placeholder="e.g. Excellent" onChange={(_, data) => updateBand(index, { label: data.value })} /></div>
                    <div className="min-w-0"><label className="mb-1 block text-xs text-muted-foreground sm:sr-only" htmlFor={`band-from-${index}`}>From</label><Input id={`band-from-${index}`} className="w-full" aria-label={`Rating ${index + 1} from`} type="number" step="any" value={String(band.from)} onChange={(_, data) => updateBand(index, { from: Number(data.value) })} /></div>
                    <div className="min-w-0"><label className="mb-1 block text-xs text-muted-foreground sm:sr-only" htmlFor={`band-to-${index}`}>To</label><Input id={`band-to-${index}`} className="w-full" aria-label={`Rating ${index + 1} to`} type="number" step="any" value={String(band.to)} onChange={(_, data) => updateBand(index, { to: Number(data.value) })} /></div>
                    <Button type="button" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove rating ${index + 1}`} title="Remove rating" onClick={() => setBands((rows) => rows.filter((_, position) => position !== index))} />
                  </div>)}
                </div>
              </section>}

              {step === 3 && <section className="space-y-8" aria-labelledby="policy-rubric-heading">
                <SectionHeading id="policy-rubric-heading" number="04" title="Qualitative rubric" description="Optional. Map descriptive employee results to scores when a qualitative KPI belongs to a weighted scorecard." action={<Button type="button" appearance="subtle" icon={<Add16Regular />} onClick={() => setConfig((current) => ({ ...current, qualitativeRubric: [...current.qualitativeRubric, { label: "", score: 0 }] }))}>Add rating</Button>} />
                {config.qualitativeRubric.length === 0 ? <p className="border-l-2 border-border pl-4 text-sm text-muted-foreground">No qualitative ratings added. You can leave this empty if your scorecards use numeric KPIs.</p> : <div className="divide-y divide-border/70">{config.qualitativeRubric.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_2.5rem] items-end gap-4 py-5 first:pt-0"><Field label="Result label" className="min-w-0"><Input className="w-full" value={item.label} placeholder="e.g. Meets expectations" onChange={(_, data) => updateRubric(index, { label: data.value })} /></Field><Field label="Score"><Input className="w-full" type="number" step="any" value={String(item.score)} onChange={(_, data) => updateRubric(index, { score: Number(data.value) })} /></Field><Button type="button" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove qualitative rating ${index + 1}`} onClick={() => setConfig((current) => ({ ...current, qualitativeRubric: current.qualitativeRubric.filter((_, position) => position !== index) }))} /></div>)}</div>}
              </section>}

              {step === 4 && <section className="space-y-8" aria-labelledby="policy-review-heading">
                <SectionHeading id="policy-review-heading" number="05" title="Review policy" description="Check the settings below, then save a draft or publish the policy now." />
                <dl className="grid gap-x-8 gap-y-4 border-y border-border py-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {[["Policy", name], ["Identifier", code], ["Method", method === "weighted" ? "Weighted score" : "Strategic status only"], ["Score range", `${config.minScore} to ${config.maxScore}`], ["Score cap", String(config.scoreCap)], ["Decimal places", String(config.displayDecimals)], ["Exact target tolerance", String(config.exactTolerance)], ["Missing results", config.missingTreatment === "block" ? "Block scoring" : "Exclude optional KPIs"], ["Not applicable", config.notApplicableTreatment === "block" ? "Block scoring" : "Redistribute its weight"], ["Rating bands", String(bands.length)], ["Qualitative ratings", String(config.qualitativeRubric.length)]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium text-foreground">{value}</dd></div>)}
                </dl>
                <div><h4 className="font-semibold">Rating scale</h4><div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">{[...bands].sort((a, b) => a.from - b.from).map((band, index) => <span key={index}><strong>{band.label}</strong> · {band.from}–{band.to}</span>)}</div></div>
              </section>}
            </form>
          </DialogContent>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-6 py-4 sm:px-8">
            <Button appearance="subtle" disabled={busy} onClick={closeDialog}>Cancel</Button>
            <div className="flex flex-wrap gap-2">{step > 0 && <Button appearance="secondary" disabled={busy} onClick={() => { setError(""); setStep((current) => current - 1) }}>Back</Button>}{step < policySteps.length - 1 ? <Button appearance="primary" disabled={busy} onClick={nextStep}>Continue</Button> : <><Button type="submit" form="scoring-policy-form" appearance="secondary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button><Button type="button" appearance="primary" disabled={busy} onClick={() => void save(undefined, true)}>{busy ? "Publishing…" : "Save & publish"}</Button></>}</div>
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Policy library</h2>
      <div className="overflow-x-auto border border-border"><Table aria-label="Scoring policies" size="small" className="min-w-[44rem] w-full"><TableHeader><TableRow><TableHeaderCell>Policy</TableHeaderCell><TableHeaderCell>Method</TableHeaderCell><TableHeaderCell>Version</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Actions</TableHeaderCell></TableRow></TableHeader><TableBody>{policies.map((policy) => { const version = policy.versions[0]; return <TableRow key={policy.id}><TableCell><span className="block font-semibold">{version.name}</span><span className="text-xs text-muted-foreground">{policy.code}</span></TableCell><TableCell>{version.method === "weighted" ? "Weighted score" : "Strategic status"}</TableCell><TableCell>v{version.version}</TableCell><TableCell><Badge appearance="outline" color={version.publishedAt ? "success" : "warning"}>{version.publishedAt ? "Published" : "Draft"}</Badge></TableCell><TableCell><div className="flex flex-wrap gap-2">{canEdit && (version.publishedAt ? <Button appearance="subtle" disabled={busy} onClick={() => void action(() => scorecardApi.revisePolicy(token, policy.id), "New policy draft created")}>Create revision</Button> : <><Button appearance="subtle" onClick={() => edit(policy)}>Edit draft</Button><Button appearance="primary" disabled={busy} onClick={() => void action(() => scorecardApi.publishPolicy(token, policy.id), "Policy version published")}>Publish</Button></>)}</div></TableCell></TableRow> })}</TableBody></Table></div>
      {!loading && policies.length === 0 && <p className="text-sm text-muted-foreground">No scoring policies yet. Create one to calculate weighted scorecards.</p>}
    </section>
  </div>
}
