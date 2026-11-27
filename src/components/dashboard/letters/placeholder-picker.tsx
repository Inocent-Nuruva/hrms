"use client"

import * as React from "react"
import { BracesIcon, LockIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import type { LetterPlaceholder } from "@/lib/letters-api"
import { cn } from "@/lib/utils"

/** Filters and groups placeholders by their group, keeping catalogue order. */
export function groupPlaceholders(placeholders: LetterPlaceholder[], search: string) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const groups = new Map<string, LetterPlaceholder[]>()
  for (const item of placeholders) {
    const text = `${item.key} ${item.label} ${item.group}`.toLowerCase()
    if (!terms.every((term) => text.includes(term))) continue
    groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  }
  return [...groups.entries()]
}

/**
 * "Insert placeholder" button with a searchable, grouped list. Returns the
 * chosen key; the caller inserts `{{key}}` at its cursor.
 */
export function PlaceholderPicker({
  placeholders,
  onPick,
  disabled,
  label = "Insert placeholder",
}: {
  placeholders: LetterPlaceholder[]
  onPick: (key: string) => void
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listId = React.useId()
  const groups = groupPlaceholders(placeholders, search)
  const flat = groups.flatMap(([, items]) => items)

  const choose = (key: string) => {
    onPick(key)
    setOpen(false)
    setSearch("")
    setActive(0)
  }

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next)}>
      <PopoverTrigger
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        <BracesIcon className="size-3.5" aria-hidden="true" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-2">
        <Input
          type="search"
          autoFocus
          placeholder="Search placeholders"
          aria-label="Search placeholders"
          aria-controls={listId}
          value={search}
          onChange={(_event, data) => {
            setSearch(data.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActive((index) => Math.min(flat.length - 1, index + 1))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActive((index) => Math.max(0, index - 1))
            } else if (event.key === "Enter" && flat[active]) {
              event.preventDefault()
              choose(flat[active].key)
            }
          }}
        />
        <div id={listId} role="listbox" aria-label="Placeholders" className="mt-2 max-h-72 overflow-y-auto">
          {groups.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No placeholders match.</p> : null}
          {groups.map(([group, items]) => (
            <div key={group} role="group" aria-label={group} className="mb-1">
              <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              {items.map((item) => {
                const index = flat.indexOf(item)
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(item.key)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm",
                      index === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      <code className="block truncate text-[11px] text-muted-foreground">{`{{${item.key}}}`}</code>
                    </span>
                    {item.confidential ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <LockIcon className="size-3" aria-hidden="true" />
                        Confidential
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Shared rich Textarea plus a placeholder picker that inserts `{{key}}` at the
 * last cursor position in the editor (appends when the editor was never focused).
 */
export function PlaceholderRichText({
  value,
  onChange,
  placeholders,
  ariaLabel,
  rows = 12,
  disabled,
  error,
}: {
  value: string
  onChange: (value: string) => void
  placeholders: LetterPlaceholder[]
  ariaLabel: string
  rows?: number
  disabled?: boolean
  error?: string
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const rangeRef = React.useRef<Range | null>(null)

  React.useEffect(() => {
    const remember = () => {
      const editor = wrapperRef.current?.querySelector<HTMLElement>("[role=textbox]")
      const selection = window.getSelection()
      if (!editor || !selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (editor.contains(range.startContainer)) rangeRef.current = range.cloneRange()
    }
    document.addEventListener("selectionchange", remember)
    return () => document.removeEventListener("selectionchange", remember)
  }, [])

  const insert = (key: string) => {
    const token = `{{${key}}}`
    const editor = wrapperRef.current?.querySelector<HTMLElement>("[role=textbox]")
    const range = rangeRef.current
    if (editor && range && editor.contains(range.startContainer)) {
      editor.focus()
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      // execCommand fires the editor's input event, which updates the value.
      if (document.execCommand("insertText", false, token)) return
    }
    onChange(value ? `${value}${value.endsWith(" ") || value.endsWith("\n") ? "" : " "}${token}` : token)
  }

  return (
    <div ref={wrapperRef} className="flex flex-col gap-2">
      <div className="flex justify-end">
        <PlaceholderPicker placeholders={placeholders} onPick={insert} disabled={disabled} />
      </div>
      <Textarea
        aria-label={ariaLabel}
        formatting
        rows={rows}
        value={value}
        disabled={disabled}
        error={error}
        onChange={(_event, data) => onChange(data.value)}
      />
    </div>
  )
}
