"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FileTextIcon, LayoutTemplateIcon, MailIcon, PencilIcon, PlusIcon } from "lucide-react"

import { PageShell, PageShellBody, PageShellHeader, PageShellTabs } from "@/components/dashboard/page-shell"
import {
  ProfileRecordCollection,
  ProfileRecordEmpty,
  ProfileRecordViewToggle,
  RecordActionButton,
  RecordBadges,
  RecordTag,
  useProfileRecordView,
} from "@/components/dashboard/employee-profile/profile-record-views"
import { LetterDetailPanel } from "@/components/dashboard/letters/letter-detail-panel"
import { LetterTemplateEditor } from "@/components/dashboard/letters/letter-template-editor"
import { LetterWizard } from "@/components/dashboard/letters/letter-wizard"
import { LettersCollection } from "@/components/dashboard/letters/letters-list"
import {
  errorText,
  formatLetterDate,
  useLetterCatalogue,
  useLetterPermissions,
  useLettersToken,
} from "@/components/dashboard/letters/letter-shared"
import { Button } from "@/components/ui/button"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  LETTER_STATUSES,
  LETTER_STATUS_META,
  isLetterType,
  letterTypeLabel,
  listLetterTemplates,
  listLetters,
  type Letter,
  type LetterCatalogue,
  type LetterListMeta,
  type LetterStatus,
  type LetterTemplate,
  type LetterType,
} from "@/lib/letters-api"

type LettersTab = "letters" | "templates"
const PAGE_SIZE = 24

function typeOptions(catalogue: LetterCatalogue | null, allLabel: string) {
  return [{ value: "", label: allLabel }, ...(catalogue?.letter_types ?? []).map((row) => ({ value: row.type, label: row.label }))]
}

function LettersTabView({
  token,
  catalogue,
  initialType,
  refreshKey,
  onView,
}: {
  token: string
  catalogue: LetterCatalogue | null
  initialType: LetterType | ""
  refreshKey: number
  onView: (letter: Letter) => void
}) {
  const [view, setView] = useProfileRecordView()
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [status, setStatus] = React.useState<LetterStatus | "">("")
  const [type, setType] = React.useState<LetterType | "">(initialType)
  const [page, setPage] = React.useState(1)
  const [rows, setRows] = React.useState<Letter[] | null>(null)
  const [meta, setMeta] = React.useState<LetterListMeta | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  React.useEffect(() => setPage(1), [debounced, status, type])

  React.useEffect(() => {
    if (!token) return
    let active = true
    listLetters(token, { search: debounced, status, letter_type: type, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return
        setRows(result.data ?? [])
        setMeta(result.meta ?? null)
        setError(null)
      })
      .catch((cause) => active && setError(errorText(cause, "Could not load letters")))
    return () => {
      active = false
    }
  }, [token, debounced, status, type, page, refreshKey])

  const total = meta?.total ?? rows?.length ?? 0
  const pages = Math.max(1, meta?.totalPages ?? Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_16rem_auto] lg:items-center">
        <Input
          type="search"
          placeholder="Search reference or recipient"
          aria-label="Search letters"
          value={search}
          onChange={(_event, data) => setSearch(data.value)}
        />
        <FluentSelect
          ariaLabel="Status"
          value={status}
          onChange={(value) => setStatus(value as LetterStatus | "")}
          options={[{ value: "", label: "All statuses" }, ...LETTER_STATUSES.map((value) => ({ value, label: LETTER_STATUS_META[value].label }))]}
        />
        <FluentSelect ariaLabel="Letter type" value={type} onChange={(value) => setType(value as LetterType | "")} options={typeOptions(catalogue, "All letter types")} />
        <div className="flex justify-end">
          <ProfileRecordViewToggle view={view} onChange={setView} label="Letters" />
        </div>
      </div>
      {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <ProfileRecordEmpty title="Letters" message={debounced || status || type ? "No letters match these filters." : "Letters you create will be listed here."} />
      ) : (
        <LettersCollection token={token} letters={rows} view={view} onView={onView} />
      )}
      {pages > 1 ? (
        <nav aria-label="Letters pages" className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      ) : null}
    </div>
  )
}

function TemplatesTabView({
  token,
  catalogue,
  initialType,
  canManage,
}: {
  token: string
  catalogue: LetterCatalogue | null
  initialType: LetterType | ""
  canManage: boolean
}) {
  const [view, setView] = useProfileRecordView()
  const [type, setType] = React.useState<LetterType | "">(initialType)
  const [includeInactive, setIncludeInactive] = React.useState(false)
  const [rows, setRows] = React.useState<LetterTemplate[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [editor, setEditor] = React.useState<{ open: boolean; template: LetterTemplate | null }>({ open: false, template: null })

  const load = React.useCallback(() => {
    if (!token) return
    listLetterTemplates(token, { letter_type: type, include_inactive: includeInactive })
      .then((result) => {
        setRows(result)
        setError(null)
      })
      .catch((cause) => setError(errorText(cause, "Could not load templates")))
  }, [token, type, includeInactive])

  React.useEffect(() => load(), [load])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FluentSelect
          ariaLabel="Letter type"
          className="sm:max-w-xs"
          value={type}
          onChange={(value) => setType(value as LetterType | "")}
          options={typeOptions(catalogue, "All letter types")}
        />
        <Switch label="Show inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
        <div className="flex flex-1 items-center justify-end gap-2">
          <ProfileRecordViewToggle view={view} onChange={setView} label="Templates" />
          {canManage ? (
            <Button onClick={() => setEditor({ open: true, template: null })}>
              <PlusIcon className="size-4" aria-hidden="true" /> New template
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <ProfileRecordEmpty title="Letter templates" message="No templates for this filter." />
      ) : (
        <ProfileRecordCollection
          title="Letter templates"
          view={view}
          records={rows.map((row) => ({
            key: String(row.id),
            heading: row.name,
            badges: (
              <RecordBadges inline>
                {row.is_default ? <RecordTag tone="primary">Default</RecordTag> : null}
                {row.is_active ? <RecordTag tone="success">Active</RecordTag> : <RecordTag>Inactive</RecordTag>}
                {row.requires_approval ? <RecordTag tone="warning">Requires approval</RecordTag> : null}
              </RecordBadges>
            ),
            fields: [
              { label: "Type", value: letterTypeLabel(row.letter_type) },
              { label: "Version", value: String(row.current_version) },
              { label: "Subject", value: row.subject },
              { label: "Signatory", value: row.signatory_name ?? "" },
            ].filter((entry) => entry.value),
            meta: `Updated ${formatLetterDate(row.updated_at)}${row.updated_by_name ? ` by ${row.updated_by_name}` : ""}`,
            actions: (
              <RecordActionButton
                label={canManage ? "Edit" : "View"}
                icon={<PencilIcon className="size-4" aria-hidden="true" />}
                onClick={() => setEditor({ open: true, template: row })}
              />
            ),
          }))}
        />
      )}
      <LetterTemplateEditor
        open={editor.open}
        onOpenChange={(open) => setEditor((value) => ({ ...value, open }))}
        token={token}
        catalogue={catalogue}
        template={editor.template}
        defaultType={type}
        canManage={canManage}
        onSaved={() => load()}
      />
    </div>
  )
}

function EmploymentLettersContent() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const token = useLettersToken()
  const permissions = useLetterPermissions()
  const catalogue = useLetterCatalogue(token)
  const tab: LettersTab = params?.get("tab") === "templates" ? "templates" : "letters"
  const typeParam = params?.get("type")
  const initialType: LetterType | "" = isLetterType(typeParam) ? typeParam : ""

  const [refreshKey, setRefreshKey] = React.useState(0)
  const [detailId, setDetailId] = React.useState<number | null>(null)
  const [wizard, setWizard] = React.useState<{ open: boolean; letter: Letter | null }>({ open: false, letter: null })

  const setTab = (next: LettersTab) => {
    const search = new URLSearchParams(params?.toString() ?? "")
    if (next === "letters") search.delete("tab")
    else search.set("tab", next)
    const text = search.toString()
    router.replace(`${pathname}${text ? `?${text}` : ""}`, { scroll: false })
  }

  const canCreate = permissions.create
  return (
    <PageShell>
      <PageShellHeader
        withTabs
        title="Employee letters"
        description="Create, approve and issue letters from templates. Issued letters carry a verification QR code."
        actions={
          canCreate ? (
            <Button onClick={() => setWizard({ open: true, letter: null })}>
              <PlusIcon className="size-4" aria-hidden="true" /> New letter
            </Button>
          ) : null
        }
      />
      <PageShellTabs<LettersTab>
        idPrefix="letters"
        ariaLabel="Letters sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "letters", label: "Letters", icon: MailIcon },
          { id: "templates", label: "Templates", icon: LayoutTemplateIcon },
        ]}
      />
      <PageShellBody idPrefix="letters" tabId={tab}>
        {!token ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileTextIcon className="size-4" aria-hidden="true" /> Loading…
          </p>
        ) : tab === "letters" ? (
          <LettersTabView
            token={token}
            catalogue={catalogue}
            initialType={initialType}
            refreshKey={refreshKey}
            onView={(letter) => setDetailId(letter.id)}
          />
        ) : (
          <TemplatesTabView token={token} catalogue={catalogue} initialType={initialType} canManage={permissions.manageTemplates} />
        )}
      </PageShellBody>
      <LetterDetailPanel
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        token={token}
        letterId={detailId}
        onChanged={() => setRefreshKey((value) => value + 1)}
        onOpenLetter={(id) => setDetailId(id)}
        onEdit={(letter) => {
          setDetailId(null)
          setWizard({ open: true, letter })
        }}
      />
      <LetterWizard
        open={wizard.open}
        onOpenChange={(open) => setWizard((value) => ({ ...value, open }))}
        token={token}
        letter={wizard.letter}
        onSaved={(letter) => {
          setRefreshKey((value) => value + 1)
          setDetailId(letter.id)
        }}
      />
    </PageShell>
  )
}

/** Employees → Letters: letters register and letter templates. */
export function EmploymentLettersPage() {
  return (
    <React.Suspense fallback={null}>
      <EmploymentLettersContent />
    </React.Suspense>
  )
}
