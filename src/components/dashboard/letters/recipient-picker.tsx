"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { RecordTag } from "@/components/dashboard/employee-profile/profile-record-views"
import { searchLetterRecipients, type LetterRecipient, type RecipientKind } from "@/lib/letters-api"
import { cn } from "@/lib/utils"

export function recipientSummary(row: LetterRecipient) {
  return [row.employee_no, row.department, row.position].filter(Boolean).join(" · ")
}

/**
 * Searchable recipient combobox for letters (employees, and recruitment
 * candidates for offer letters). Debounced server search; arrow keys move
 * through the list, Enter selects, Escape closes.
 */
export function RecipientPicker({
  token,
  value,
  onChange,
  kind = "employee",
  id,
  placeholder = "Search by name, employee no, department or position",
  disabled,
  debounceMs = 250,
}: {
  token: string
  value: LetterRecipient | null
  onChange: (recipient: LetterRecipient | null) => void
  kind?: RecipientKind | "any"
  id?: string
  placeholder?: string
  disabled?: boolean
  debounceMs?: number
}) {
  const autoId = React.useId()
  const inputId = id ?? `${autoId}-input`
  const listId = `${autoId}-list`
  const [search, setSearch] = React.useState("")
  const [rows, setRows] = React.useState<LetterRecipient[]>([])
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setRows([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchLetterRecipients(token, term, kind, 10, controller.signal)
        .then((result) => {
          setRows(Array.isArray(result) ? result : [])
          setActive(Array.isArray(result) && result.length ? 0 : -1)
          setError(null)
          setOpen(true)
        })
        .catch((cause: unknown) => {
          if (cause instanceof Error && cause.name === "AbortError") return
          setRows([])
          setError(cause instanceof Error ? cause.message : "Search failed")
        })
        .finally(() => setLoading(false))
    }, debounceMs)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, token, kind, debounceMs])

  const pick = (row: LetterRecipient) => {
    onChange(row)
    setSearch("")
    setRows([])
    setOpen(false)
    setActive(-1)
  }

  if (value) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {value.name}
            {value.kind === "candidate" ? <RecordTag tone="primary">Candidate</RecordTag> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{recipientSummary(value) || value.email || "—"}</p>
        </div>
        {disabled ? null : (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Change recipient ${value.name}`}
            onClick={() => onChange(null)}
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  const showList = open && search.trim().length >= 2
  return (
    <div className="relative min-w-0">
      <Input
        id={inputId}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        contentBefore={<SearchIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
        placeholder={placeholder}
        value={search}
        onChange={(_event, data) => {
          setSearch(data.value)
          setOpen(true)
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActive((index) => (rows.length ? (index + 1) % rows.length : -1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((index) => (rows.length ? (index - 1 + rows.length) % rows.length : -1))
          } else if (event.key === "Enter") {
            if (showList && active >= 0 && rows[active]) {
              event.preventDefault()
              pick(rows[active])
            }
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching recipients"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {loading && !rows.length ? (
            <li className="px-3 py-2 text-sm text-muted-foreground" role="presentation">
              Searching…
            </li>
          ) : error ? (
            <li className="px-3 py-2 text-sm text-destructive" role="presentation">
              {error}
            </li>
          ) : !rows.length ? (
            <li className="px-3 py-2 text-sm text-muted-foreground" role="presentation">
              No matches
            </li>
          ) : (
            rows.map((row, index) => (
              <li
                key={`${row.kind}-${row.id}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(row)}
              >
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {row.name}
                  {row.kind === "candidate" ? <RecordTag tone="primary">Candidate</RecordTag> : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{recipientSummary(row) || row.email || ""}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
