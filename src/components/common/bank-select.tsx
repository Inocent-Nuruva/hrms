"use client"

import * as React from "react"
import { Combobox, Option } from "@fluentui/react-components"
import { Add20Regular, BuildingBank20Regular } from "@fluentui/react-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listCompanyBanks, resolveBackendMediaUrl } from "@/lib/admin-api"
import { readAccessToken } from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

export type DirectoryBank = { name: string; logoUrl: string }

const OTHER_BANK = "__other_bank__"

// One request per page load, shared by every BankSelect on the page.
let directoryPromise: Promise<DirectoryBank[]> | null = null

function loadBankDirectory(token: string): Promise<DirectoryBank[]> {
  if (!directoryPromise) {
    directoryPromise = listCompanyBanks(token)
      .then((rows) =>
        rows
          .map((row) => ({
            name: typeof row.name === "string" ? row.name.trim() : "",
            logoUrl: typeof row.logo_url === "string" ? row.logo_url : "",
          }))
          .filter((bank) => bank.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      .catch(() => {
        directoryPromise = null
        return []
      })
  }
  return directoryPromise
}

/** Forget the cached directory (call after the bank directory is edited). */
export function refreshBankDirectory() {
  directoryPromise = null
}

/** The company's bank directory (name + logo), loaded once and shared. */
export function useBankDirectory() {
  const [banks, setBanks] = React.useState<DirectoryBank[] | null>(null)
  React.useEffect(() => {
    const token = readAccessToken()
    if (!token) {
      setBanks([])
      return
    }
    let active = true
    void loadBankDirectory(token).then((rows) => {
      if (active) setBanks(rows)
    })
    return () => {
      active = false
    }
  }, [])
  return banks
}

export function BankLogo({ name, url, className }: { name: string; url?: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter((word) => !["bank", "tanzania", "limited", "plc", "ltd"].includes(word.toLowerCase()))
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "B"
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-primary/10 text-[8px] font-bold text-primary",
        className
      )}
    >
      {url ? (
        <>
          {initials}
          {/* Institution logos are decorative and externally hosted. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveBackendMediaUrl(url) ?? undefined}
            referrerPolicy="no-referrer"
            alt=""
            className="absolute inset-0 size-full bg-white object-contain"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        </>
      ) : (
        <BuildingBank20Regular className="size-4" />
      )}
    </span>
  )
}

/**
 * Bank name picker backed by the company bank directory (Settings → Banks).
 * Searchable, shows bank logos, and stores the bank's name. "Other bank"
 * switches to a text field for banks not in the directory; an existing value
 * that is not in the directory opens in that text mode so it is never lost.
 */
export function BankSelect({
  value,
  onChange,
  id,
  placeholder = "Select a bank",
  disabled,
  invalid,
  allowOther = true,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (name: string) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  /** Offer "Other bank — enter manually". Default true. */
  allowOther?: boolean
  className?: string
  "aria-label"?: string
}) {
  const banks = useBankDirectory()
  const [manual, setManual] = React.useState(false)
  const [query, setQuery] = React.useState<string | null>(null)

  const inDirectory = Boolean(value) && Boolean(banks?.some((bank) => bank.name.toLowerCase() === value.trim().toLowerCase()))
  // A saved bank that is not in the directory is shown as typed text.
  const manualMode = allowOther && (manual || (Boolean(value) && banks !== null && !inDirectory))
  const selected = banks?.find((bank) => bank.name.toLowerCase() === value.trim().toLowerCase()) ?? null

  const typed = (query ?? "").trim().toLowerCase()
  const options = (banks ?? []).filter((bank) => !typed || bank.name.toLowerCase().includes(typed))

  if (manualMode) {
    return (
      <div className={cn("flex min-w-0 gap-2", className)}>
        <Input
          id={id}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel ?? "Bank name"}
          aria-invalid={invalid || undefined}
          placeholder="Enter bank name"
          onChange={(event) => onChange(event.target.value)}
        />
        {banks && banks.length ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              setManual(false)
              onChange("")
            }}
          >
            Choose from list
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      {selected && query === null ? (
        <BankLogo
          name={selected.name}
          url={selected.logoUrl}
          className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2"
        />
      ) : null}
      <Combobox
        id={id}
        aria-label={ariaLabel ?? "Bank name"}
        aria-invalid={invalid || undefined}
        disabled={disabled || banks === null}
        placeholder={banks === null ? "Loading banks…" : placeholder}
        className={cn("w-full min-w-0", invalid && "hrms-invalid")}
        input={{ className: cn(selected && query === null && "!pl-8") }}
        value={query ?? selected?.name ?? value}
        selectedOptions={selected ? [selected.name] : []}
        onChange={(event) => setQuery(event.target.value)}
        onOpenChange={(_event, data) => {
          if (!data.open) setQuery(null)
        }}
        onOptionSelect={(_event, data) => {
          setQuery(null)
          if (data.optionValue === OTHER_BANK) {
            setManual(true)
            onChange("")
            return
          }
          if (data.optionValue) onChange(data.optionValue)
        }}
      >
        {options.map((bank) => (
          <Option key={bank.name} value={bank.name} text={bank.name}>
            <span className="flex min-w-0 items-center gap-2.5">
              <BankLogo name={bank.name} url={bank.logoUrl} />
              <span className="truncate">{bank.name}</span>
            </span>
          </Option>
        ))}
        {allowOther ? (
          <Option value={OTHER_BANK} text="Other bank">
            <span className="flex items-center gap-2.5 text-muted-foreground">
              <Add20Regular className="size-5" />
              Other bank — enter manually
            </span>
          </Option>
        ) : null}
      </Combobox>
    </div>
  )
}
