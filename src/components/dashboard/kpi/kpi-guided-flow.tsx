"use client"

import * as React from "react"
import {
  Badge, Button, Card, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, MessageBar, MessageBarBody, ProgressBar, tokens,
} from "@fluentui/react-components"
import { Edit24Regular, Sparkle24Regular } from "@fluentui/react-icons"

export type KpiEntryMode = "choose" | "guided" | "manual"
export type KpiFlowStep = { title: string; description: string }

export function KpiModeSelector({ title, description, onSelect, guidedLabel, manualLabel, blockedReason, resolveHref, owner }: {
  title: string; description: string; onSelect: (mode: "guided" | "manual") => void; guidedLabel?: string; manualLabel?: string; blockedReason?: string; resolveHref?: string; owner?: string
}) {
  return <div className="space-y-3" aria-label={`${title} creation method`}>
    {blockedReason && <MessageBar intent="warning"><MessageBarBody>{blockedReason}{owner ? ` Responsible: ${owner}.` : ""}{resolveHref && <Button as="a" href={resolveHref} appearance="subtle" size="small">Resolve prerequisite</Button>}</MessageBarBody></MessageBar>}
    <div className="grid gap-3 md:grid-cols-2">
    <Card appearance="filled-alternative" className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2"><Sparkle24Regular aria-hidden /><h2 className="font-semibold">Guided Wizard</h2><Badge color="brand">Recommended</Badge></div>
      <p className="text-sm" style={{ color: tokens.colorNeutralForeground2 }}>{description}</p>
      <Button appearance="primary" disabled={!!blockedReason} title={blockedReason} onClick={() => onSelect("guided")}>{guidedLabel ?? `Start guided ${title.toLowerCase()}`}</Button>
    </Card>
    <Card appearance="filled-alternative" className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2"><Edit24Regular aria-hidden /><h2 className="font-semibold">Manual Creation</h2></div>
      <p className="text-sm" style={{ color: tokens.colorNeutralForeground2 }}>Open the complete existing form. Both methods use the same records, API, and permissions.</p>
      <Button appearance="secondary" disabled={!!blockedReason} title={blockedReason} onClick={() => onSelect("manual")}>{manualLabel ?? "Open manual form"}</Button>
    </Card>
    </div>
  </div>
}

export function KpiWizardProgress({ steps, step }: { steps: KpiFlowStep[]; step: number }) {
  return <Card appearance="filled-alternative" className="space-y-4 p-4" aria-label="Workflow progress">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{steps[step]?.title}</h2><p className="text-sm" style={{ color: tokens.colorNeutralForeground2 }}>{steps[step]?.description}</p></div><Badge color="brand">Step {step + 1} of {steps.length}</Badge></div>
    <ProgressBar value={(step + 1) / steps.length} aria-label={`Step ${step + 1} of ${steps.length}`} />
    <ol className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">{steps.map((item, index) => <li key={`${index}-${item.title}`} aria-current={step === index ? "step" : undefined} className="flex items-center gap-1"><Badge appearance={step >= index ? "filled" : "outline"} color={step >= index ? "brand" : "informative"}>{index + 1}</Badge><span style={{ color: step === index ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground2 }}>{item.title}</span></li>)}</ol>
  </Card>
}

export function KpiWizardControls({ step, steps, busy = false, finishDisabled = false, hideFinish = false, error, onBack, onNext, onCancel, onFinish, finishLabel = "Save draft", confirmFinish = false }: {
  step: number; steps: KpiFlowStep[]; busy?: boolean; finishDisabled?: boolean; hideFinish?: boolean; error?: string
  onBack: () => void; onNext: () => void; onCancel: () => void
  onFinish: () => void; finishLabel?: string; confirmFinish?: boolean
}) {
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)
  const [confirmSubmit, setConfirmSubmit] = React.useState(false)
  return <>
    {error && <MessageBar intent="error" role="alert"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button appearance="subtle" disabled={busy} onClick={() => setConfirmDiscard(true)}>Cancel</Button>
      <div className="flex flex-wrap gap-2">{step > 0 && <Button appearance="secondary" disabled={busy} onClick={onBack}>Back</Button>}{step < steps.length - 1 ? <Button appearance="primary" disabled={busy} onClick={onNext}>Continue</Button> : !hideFinish && <Button appearance="primary" disabled={busy || finishDisabled} onClick={() => confirmFinish ? setConfirmSubmit(true) : onFinish()}>{busy ? "Saving…" : finishLabel}</Button>}</div>
    </div>
    <Dialog open={confirmDiscard} onOpenChange={(_, data) => setConfirmDiscard(data.open)}><DialogSurface><DialogBody><DialogTitle>Discard your changes?</DialogTitle><DialogContent>Information entered in this guided workflow will be lost.</DialogContent><DialogActions><Button appearance="secondary" onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button appearance="primary" onClick={() => { setConfirmDiscard(false); onCancel() }}>Discard changes</Button></DialogActions></DialogBody></DialogSurface></Dialog>
    <Dialog open={confirmSubmit} onOpenChange={(_, data) => setConfirmSubmit(data.open)}><DialogSurface><DialogBody><DialogTitle>Confirm {finishLabel.toLowerCase()}</DialogTitle><DialogContent>Review the information above before continuing.</DialogContent><DialogActions><Button appearance="secondary" onClick={() => setConfirmSubmit(false)}>Review again</Button><Button appearance="primary" disabled={busy} onClick={() => { setConfirmSubmit(false); onFinish() }}>Confirm</Button></DialogActions></DialogBody></DialogSurface></Dialog>
  </>
}
