"use client"

import * as React from "react"
import { Tab, TabList } from "@fluentui/react-components"
import { Grid20Regular, TextBulletListLtr20Regular } from "@fluentui/react-icons"
import {
  ArrowRightLeftIcon,
  AwardIcon,
  BriefcaseBusinessIcon,
  FileSignatureIcon,
  HistoryIcon,
  MailIcon,
  Building2Icon,
  FileTextIcon,
  GraduationCapIcon,
  HomeIcon,
  IdCardIcon,
  LandmarkIcon,
  LayersIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { CountryFlag } from "@/components/country-flag"
import { findCountryOption } from "@/components/dashboard/employee-profile/profile-shared"
import { readStorage, subscribeStorage, writeStorageBatch } from "@/lib/local-storage-store"

export type ProfileRecordView = "cards" | "list"

const VIEW_STORAGE_KEY = "hrms.employeeProfile.recordView"

/**
 * Card/List choice for profile record sections. Stored per browser and shared
 * by every section, so switching once applies to the whole profile.
 */
export function useProfileRecordView(): [ProfileRecordView, (view: ProfileRecordView) => void] {
  const view = React.useSyncExternalStore(
    subscribeStorage,
    () => (readStorage(VIEW_STORAGE_KEY) === "list" ? "list" : "cards"),
    () => "cards" as const
  )
  const setView = React.useCallback((next: ProfileRecordView) => {
    try {
      writeStorageBatch({ [VIEW_STORAGE_KEY]: next })
    } catch {
      // Storage blocked: the choice simply isn't remembered.
    }
  }, [])
  return [view, setView]
}

/** Same icon-only Fluent switch the Leave balance view uses. */
export function ProfileRecordViewToggle({
  view,
  onChange,
  label,
}: {
  view: ProfileRecordView
  onChange: (view: ProfileRecordView) => void
  label: string
}) {
  return (
    <TabList
      size="small"
      aria-label={`${label} view`}
      selectedValue={view}
      onTabSelect={(_event, data) => onChange(data.value === "list" ? "list" : "cards")}
    >
      <Tab value="cards" aria-label="Card view" title="Card view" icon={<Grid20Regular aria-hidden="true" />} />
      <Tab value="list" aria-label="List view" title="List view" icon={<TextBulletListLtr20Regular aria-hidden="true" />} />
    </TabList>
  )
}

const SECTION_ICONS: Array<[RegExp, LucideIcon]> = [
  [/contact/, PhoneIcon],
  [/address/, HomeIcon],
  [/relative|family|next of kin|dependant|dependent/, UsersIcon],
  [/identif|\bid\b/, IdCardIcon],
  [/bank/, LandmarkIcon],
  [/academic|education/, GraduationCapIcon],
  [/professional|certif|skill/, AwardIcon],
  [/experience|employment history/, BriefcaseBusinessIcon],
  [/department/, Building2Icon],
  [/position/, LayersIcon],
  [/letter/, MailIcon],
  [/document/, FileTextIcon],
  [/contract/, FileSignatureIcon],
  [/movement|transfer/, ArrowRightLeftIcon],
  [/status/, HistoryIcon],
  [/account|user/, UserRoundIcon],
]

export function sectionIconFor(title: string): LucideIcon {
  const key = title.toLowerCase()
  return SECTION_ICONS.find(([pattern]) => pattern.test(key))?.[1] ?? FileTextIcon
}

export type RecordFieldEntry = { label: string; value: string }

const META_LABELS = new Set(["created at", "updated at", "primary contact", "primary department", "verified", "is primary"])

/** Splits fields into what a card shows and the flags/meta it shows as badges. */
export function splitRecordFields(fields: RecordFieldEntry[]) {
  const visible = fields.filter(
    (entry) => entry.value.trim() !== "" && entry.value !== "-" && entry.value !== "Available"
  )
  const normalize = (label: string) => label.toLowerCase().trim()
  const find = (label: string) => visible.find((entry) => normalize(entry.label) === label)?.value
  return {
    details: visible.filter((entry) => !META_LABELS.has(normalize(entry.label))),
    all: visible,
    isPrimary: (find("primary contact") ?? find("primary department") ?? find("is primary")) === "Yes",
    verified: find("verified"),
    updatedAt: find("updated at") ?? find("created at"),
  }
}

export function formatFieldLabel(label: string) {
  const text = label.replace(/_/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function RecordFieldValue({ entry }: { entry: RecordFieldEntry }) {
  if (entry.label.toLowerCase().includes("country")) {
    const option = findCountryOption(entry.value)
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 break-words text-foreground">
        {option ? <CountryFlag code={option.code} className="h-3 w-4 shrink-0 rounded-sm border border-border" /> : null}
        <span className="min-w-0 break-words">{entry.value}</span>
      </span>
    )
  }
  return <span className="min-w-0 break-words text-foreground">{entry.value}</span>
}

/** Label above value, the layout used inside record cards and the View panel. */
export function RecordFieldGrid({ fields, columns = 2 }: { fields: RecordFieldEntry[]; columns?: 1 | 2 }) {
  return (
    <dl className={columns === 2 ? "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2" : "grid grid-cols-1 gap-y-3"}>
      {fields.map((entry) => (
        <div key={entry.label} className="min-w-0">
          <dt className="text-[11px] font-medium text-muted-foreground">{formatFieldLabel(entry.label)}</dt>
          <dd className="mt-0.5 text-sm">
            <RecordFieldValue entry={entry} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The section's icon (Contacts → phone, Addresses → home, ...). */
export function SectionGlyph({ title, className }: { title: string; className?: string }) {
  return React.createElement(sectionIconFor(title), { className, "aria-hidden": true })
}

export function RecordBadges({
  isPrimary = false,
  verified,
  inline = false,
  children,
}: {
  isPrimary?: boolean
  verified?: string
  inline?: boolean
  /** Extra badges (status, assignment type, ...). */
  children?: React.ReactNode
}) {
  if (!isPrimary && verified !== "Yes" && !children) return null
  return (
    <div className={inline ? "flex flex-wrap gap-1.5" : "mt-1.5 flex flex-wrap gap-1.5"}>
      {isPrimary ? (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          Primary
        </span>
      ) : null}
      {verified === "Yes" ? (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Verified
        </span>
      ) : null}
      {children}
    </div>
  )
}

/** Small rounded tag for statuses and types, in the profile badge style. */
export function RecordTag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "success" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export const RECORD_ACTION_CLASS =
  "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"

/** One labelled action (label hidden on phones), shared by every section. */
export function RecordActionButton({
  label,
  ariaLabel,
  icon,
  onClick,
  tone = "default",
  disabled,
  iconOnly = false,
}: {
  label: string
  ariaLabel?: string
  icon: React.ReactNode
  onClick: () => void
  tone?: "default" | "danger"
  disabled?: boolean
  iconOnly?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={
        tone === "danger"
          ? `${RECORD_ACTION_CLASS} hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30`
          : RECORD_ACTION_CLASS
      }
    >
      {icon}
      {iconOnly ? null : <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}

/** Section title bar: icon, title, count, Card/List switch and actions. */
export function ProfileSectionHeader({
  title,
  count,
  view,
  onViewChange,
  highlighted = false,
  actions,
  description,
}: {
  title: string
  count?: number
  view?: ProfileRecordView
  onViewChange?: (view: ProfileRecordView) => void
  highlighted?: boolean
  actions?: React.ReactNode
  /** Overrides the "N records" line. */
  description?: React.ReactNode
}) {
  const countText =
    count === undefined ? null : count === 0 ? "Not provided" : `${count} record${count === 1 ? "" : "s"}`
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <SectionGlyph title={title} className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ?? countText ? (
            <p className="text-xs text-muted-foreground">{description ?? countText}</p>
          ) : null}
        </div>
        {highlighted ? <RecordTag tone="warning">Needs attention</RecordTag> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {view && onViewChange && (count === undefined || count > 0) ? (
          <ProfileRecordViewToggle view={view} onChange={onViewChange} label={title} />
        ) : null}
        {actions}
      </div>
    </div>
  )
}

/** Outlined "+ Add" button used in every section header. */
export function ProfileAddButton({ onClick, label = "Add" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
      onClick={onClick}
    >
      <PlusIcon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

export function ProfileRecordEmpty({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SectionGlyph title={title} className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">No {title.toLowerCase()} yet</p>
      <p className="text-xs text-muted-foreground">{message ?? "Nothing has been recorded."}</p>
      {onAction && actionLabel ? (
        <button
          type="button"
          className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium !text-white hover:bg-primary/90"
          onClick={onAction}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export type ProfileRecordDisplay = {
  key: string
  heading: React.ReactNode
  /** Badges under the heading (Primary, Verified, status ...). */
  badges?: React.ReactNode
  fields: RecordFieldEntry[]
  /** Small text in the card footer, e.g. "Updated 3 Sept 2026". */
  meta?: React.ReactNode
  actions?: React.ReactNode
  /** Extra content under the heading (links, notes). */
  extra?: React.ReactNode
  /** Text the search box matches; defaults to the heading (if text) and fields. */
  searchText?: string
}

/** Fields shown on a card before "+N more". */
export const CARD_FIELD_LIMIT = 6
/** Fields summarised on one list row. */
export const LIST_FIELD_LIMIT = 3

function RecordCollectionBody({
  title,
  view,
  records,
  moreHint = "more in View",
}: {
  title: string
  view: ProfileRecordView
  records: ProfileRecordDisplay[]
  moreHint?: string
}) {
  if (view === "list") {
    return (
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
        {records.map((record) => (
          <li
            key={record.key}
            className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <SectionGlyph title={title} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="break-words text-sm font-semibold text-foreground">{record.heading}</p>
                  {record.badges}
                </div>
                {record.fields.length ? (
                  <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                    {record.fields
                      .slice(0, LIST_FIELD_LIMIT)
                      .map((entry) => `${formatFieldLabel(entry.label)}: ${entry.value}`)
                      .join(" · ")}
                  </p>
                ) : null}
                {record.extra}
              </div>
            </div>
            {record.actions ? <div className="flex shrink-0 items-center justify-end">{record.actions}</div> : null}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {records.map((record) => (
        <li
          key={record.key}
          className="flex min-w-0 flex-col rounded-lg border border-border bg-background transition-colors hover:border-primary/40"
        >
          <div className="flex items-start gap-2.5 p-4 pb-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <SectionGlyph title={title} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold text-foreground">{record.heading}</p>
              {record.badges ? <div className="mt-1.5">{record.badges}</div> : null}
              {record.extra}
            </div>
          </div>
          <div className="min-w-0 flex-1 px-4 pb-4">
            {record.fields.length ? (
              <RecordFieldGrid fields={record.fields.slice(0, CARD_FIELD_LIMIT)} />
            ) : (
              <p className="text-xs text-muted-foreground">No further details.</p>
            )}
            {record.fields.length > CARD_FIELD_LIMIT ? (
              <p className="mt-2 text-xs text-muted-foreground">
                +{record.fields.length - CARD_FIELD_LIMIT} {moreHint}
              </p>
            ) : null}
          </div>
          {record.meta || record.actions ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">{record.meta}</span>
              {record.actions}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** Lists with more records than this get a search box. */
export const SEARCH_THRESHOLD = 5

function recordSearchText(record: ProfileRecordDisplay) {
  if (record.searchText) return record.searchText
  const heading = typeof record.heading === "string" || typeof record.heading === "number" ? String(record.heading) : ""
  return [heading, ...record.fields.map((entry) => entry.value)].join(" ")
}

/**
 * Card grid or compact list of records, the same everywhere on the profile.
 * Long lists (more than SEARCH_THRESHOLD records) get a search box.
 */
export function ProfileRecordCollection({
  title,
  view,
  records,
  moreHint,
}: {
  title: string
  view: ProfileRecordView
  records: ProfileRecordDisplay[]
  moreHint?: string
}) {
  const [query, setQuery] = React.useState("")
  const searchable = records.length > SEARCH_THRESHOLD
  const terms = query.trim().toLowerCase().split(/s+/).filter(Boolean)
  const visible =
    searchable && terms.length
      ? records.filter((record) => {
          const text = recordSearchText(record).toLowerCase()
          return terms.every((term) => text.includes(term))
        })
      : records
  return (
    <div className="flex flex-col gap-3">
      {searchable ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}`}
              aria-label={`Search ${title.toLowerCase()}`}
              className="h-[var(--hrms-control-height)] w-full rounded-[var(--hrms-control-radius)] border border-input bg-background pl-8 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          {terms.length ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {visible.length} of {records.length}
            </span>
          ) : null}
        </div>
      ) : null}
      {visible.length ? (
        <RecordCollectionBody title={title} view={view} records={visible} moreHint={moreHint} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} match &ldquo;{query.trim()}&rdquo;.
        </p>
      )}
    </div>
  )
}

/** Days within which an expiry date is flagged as "Expires soon". */
export const EXPIRY_WARNING_DAYS = 30

/**
 * Red "Expired" or amber "Expires in N days" tag for IDs, permits and
 * certificates; nothing when the date is missing or further away.
 */
export function ExpiryTag({ date }: { date?: string | null }) {
  if (!date) return null
  const parsed = new Date(date.length === 10 ? `${date}T00:00:00` : date)
  if (Number.isNaN(parsed.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  parsed.setHours(0, 0, 0, 0)
  const days = Math.round((parsed.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return <RecordTag tone="danger">Expired</RecordTag>
  if (days === 0) return <RecordTag tone="danger">Expires today</RecordTag>
  if (days <= EXPIRY_WARNING_DAYS) {
    return <RecordTag tone="warning">{`Expires in ${days} day${days === 1 ? "" : "s"}`}</RecordTag>
  }
  return null
}
