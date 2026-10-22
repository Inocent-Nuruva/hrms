"use client"

import * as React from "react"
import { Badge, Button, Card, CardHeader, Field, MessageBar, MessageBarBody, Select, Text, Textarea, OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, Spinner } from "@fluentui/react-components"
import { addOnboardingWorkspaceNote, getOnboardingWorkspaceNotes, visitOnboardingWorkspace, type OnboardingWorkspaceNote } from "@/lib/admin-api"

export function onboardingActivityLabel(action: string) {
  const labels: Record<string, string> = {
    "onboarding_employee_details.reviewed": "Employee details approved",
    "onboarding_employee_details.changes_requested": "Corrections requested",
    "onboarding_employee_details.submitted": "Employee details submitted for review",
    "onboarding_task.completed": "Checklist task completed",
    "onboarding_request.completed": "Onboarding finalized",
    "onboarding_request.submitted": "Onboarding workflow started",
    "onboarding_request.created": "Onboarding request created",
  }
  return labels[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ")
}

export function OnboardingWorkspaceUpdates({ token, requestId, activity, onActivity }: { token: string; requestId: number; activity: Record<string, unknown>[]; onActivity: () => void }) {
  const visit = React.useRef<Promise<{ previous_viewed_at: string | null; viewed_at: string }> | null>(null)
  const [previous, setPrevious] = React.useState<string | null | undefined>(undefined)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    visit.current ??= visitOnboardingWorkspace(token, requestId)
    visit.current.then((result) => { if (!cancelled) setPrevious(result.previous_viewed_at) }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [token, requestId])
  const changes = previous ? activity.filter((entry) => new Date(String(entry.created_at ?? entry.timestamp)).getTime() > new Date(previous).getTime()) : []
  if (error) return <p className="text-sm text-muted-foreground">Last-review history is unavailable. The full activity record is still available.</p>
  if (previous === undefined) return null
  return <Card><CardHeader header={<Text weight="semibold">{previous ? "Since your last review" : "Your first recorded workspace review"}</Text>} description={previous ? new Date(previous).toLocaleString() : "Future visits will highlight new activity."} />
    {previous ? changes.length ? <ul className="flex flex-col gap-2">{changes.slice(0, 4).map((entry, index) => <li key={String(entry.id ?? index)}>{onboardingActivityLabel(String(entry.action ?? entry.event ?? "Updated"))}</li>)}</ul> : <p className="text-sm">No newer entries in the loaded activity record.</p> : null}
    <Button appearance="subtle" onClick={onActivity}>View activity</Button>
  </Card>
}

export function OnboardingEmployeeMessages({ token, requestId }: { token: string; requestId: number }) {
  const [notes, setNotes] = React.useState<OnboardingWorkspaceNote[]>([])
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    void getOnboardingWorkspaceNotes(token, requestId, true).then((result) => { if (!cancelled) setNotes(result) }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [token, requestId])
  if (error) return <MessageBar intent="warning"><MessageBarBody>Messages could not be loaded. Refresh to retry.</MessageBarBody></MessageBar>
  if (!notes.length) return null
  return <Card><CardHeader header={<Text weight="semibold">Messages from your onboarding team</Text>} />{notes.map((note) => <article key={note.id} className="flex flex-col gap-1 border-t border-border pt-3"><p className="whitespace-pre-wrap text-sm">{note.body}</p><p className="text-xs text-muted-foreground">{note.author_name} · {new Date(note.created_at).toLocaleString()}</p></article>)}</Card>
}

export function OnboardingHandoffDrawer({ token, requestId, employeeName, requirement, canWrite, onClose }: { token: string; requestId: number; employeeName: string; requirement: { id: string; label: string }; canWrite: boolean; onClose: () => void }) {
  const [notes, setNotes] = React.useState<OnboardingWorkspaceNote[]>([])
  const [body, setBody] = React.useState("")
  const [visibility, setVisibility] = React.useState<"internal" | "employee">("internal")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [revision, setRevision] = React.useState(0)
  const clientKey = React.useRef<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    void getOnboardingWorkspaceNotes(token, requestId).then((result) => { if (!cancelled) setNotes(result.filter((note) => note.requirement_id === requirement.id)) }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load notes") }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, requestId, requirement.id, revision])
  React.useEffect(() => {
    if (!body.trim()) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [body])
  const close = () => { if (!saving && (!body.trim() || window.confirm("Discard this unsaved handoff note?"))) onClose() }
  const save = async () => {
    if (!body.trim() || saving) return
    setSaving(true)
    setError("")
    clientKey.current ??= crypto.randomUUID()
    try {
      await addOnboardingWorkspaceNote(token, requestId, { requirement_id: requirement.id, body, visibility, client_key: clientKey.current })
      setBody(""); clientKey.current = null; setRevision((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save note. Your draft is retained.") }
    finally { setSaving(false) }
  }
  return <OverlayDrawer open position="end" size="medium" onOpenChange={(_, data) => { if (!data.open) close() }}>
    <DrawerHeader><DrawerHeaderTitle action={<Button appearance="subtle" onClick={close}>Close</Button>}>Notes & handoff</DrawerHeaderTitle><p className="text-sm">{employeeName} · {requirement.label}</p></DrawerHeader>
    <DrawerBody className="flex flex-col gap-4">
      {error ? <MessageBar intent="error"><MessageBarBody><p>{error}</p><Button onClick={() => setRevision((value) => value + 1)}>Retry loading notes</Button></MessageBarBody></MessageBar> : null}
      {loading ? <Spinner label="Loading handoff history" /> : notes.length ? notes.map((note) => <Card key={note.id}><Badge appearance="tint" color={note.visibility === "internal" ? "informative" : "warning"}>{note.visibility === "internal" ? "Internal team note" : "Visible to employee"}</Badge><p className="whitespace-pre-wrap text-sm">{note.body}</p><p className="text-xs text-muted-foreground">{note.author_name} · {new Date(note.created_at).toLocaleString()}</p></Card>) : <p>No notes yet. Explain what is missing and the next action.</p>}
      {canWrite ? <><Field label="Note visibility"><Select value={visibility} disabled={saving} onChange={(_, data) => { setVisibility(data.value as "internal" | "employee"); clientKey.current = null }}><option value="internal">Internal HR/team note</option><option value="employee">Share with employee</option></Select></Field>
        <Field label="Handoff note" hint="Describe the blocker, responsible team, and next action. Do not include sensitive information in employee-visible messages."><Textarea value={body} disabled={saving} maxLength={2000} resize="vertical" onChange={(_, data) => { setBody(data.value); clientKey.current = null }} /></Field>
        <Button appearance="primary" disabled={saving || !body.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save handoff note"}</Button><p className="text-xs text-muted-foreground">Drafts stay in this open drawer only. Failed saves retain your text. Existing scheduled reminders remain subject to their cooldowns.</p>
      </> : <p>This request is read-only for you.</p>}
    </DrawerBody>
  </OverlayDrawer>
}
