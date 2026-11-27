"use client"

import * as React from "react"
import { ChevronDownIcon, SearchIcon } from "lucide-react"
import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

import { CountryFlag } from "@/components/country-flag"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO,
  findCountry,
  matchesCountry,
  orderedCountries,
  type Country,
} from "@/lib/countries"
import { cn } from "@/lib/utils"

/** Splits a stored number ("+255712345678" or "0712...") into country + national digits. */
export function parsePhoneValue(value: string | null | undefined, fallbackIso: string = DEFAULT_COUNTRY_ISO) {
  const text = (value ?? "").trim()
  if (!text) return { iso: fallbackIso, national: "" }
  const parsed = parsePhoneNumberFromString(text, fallbackIso as CountryCode)
  if (parsed) {
    return { iso: parsed.country ?? findCountryByDialCode(`+${parsed.countryCallingCode}`)?.iso ?? fallbackIso, national: parsed.nationalNumber }
  }
  // Partial numbers: match the longest dialling code prefix.
  if (text.startsWith("+")) {
    const country = findCountryByDialCode(text)
    if (country) return { iso: country.iso, national: text.slice(country.dialCode.length).replace(/\D/g, "") }
  }
  return { iso: fallbackIso, national: text.replace(/\D/g, "") }
}

function findCountryByDialCode(text: string): Country | null {
  // Prefer the main country for shared codes (+1 → US, +7 → RU, +44 → GB).
  const candidates = COUNTRIES.filter((country) => text.startsWith(country.dialCode)).sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  )
  if (!candidates.length) return null
  const longest = candidates[0].dialCode
  const same = candidates.filter((country) => country.dialCode === longest)
  return same.find((country) => ["US", "RU", "GB", "TZ"].includes(country.iso)) ?? same[0]
}

/** E.164 value ("+255712345678") for a country and national number, or "" when empty. */
export function toE164(iso: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "")
  if (!digits) return ""
  const country = findCountry(iso)
  return `${country?.dialCode ?? ""}${digits}`
}

/** True for a complete, valid international number. */
export function isValidPhone(value: string | null | undefined): boolean {
  const text = (value ?? "").trim()
  return Boolean(text) && isValidPhoneNumber(text)
}

/** "+255 712 345 678" style display of a stored number; the raw text when it cannot be parsed. */
export function formatPhoneForDisplay(value: string | null | undefined): string {
  const text = (value ?? "").trim()
  if (!text) return ""
  return parsePhoneNumberFromString(text)?.formatInternational() ?? text
}

export type PhoneInputProps = {
  /** E.164 number such as "+255712345678"; "" when empty. */
  value: string
  onChange: (value: string, details: { iso: string; national: string; valid: boolean }) => void
  /** Country shown when the value is empty. Defaults to Tanzania. */
  defaultCountry?: string
  /** Restrict the picker to these ISO codes (e.g. ["TZ", "UG"]). */
  countries?: string[]
  id?: string
  disabled?: boolean
  placeholder?: string
  /** Outlines the field in red. */
  invalid?: boolean
  onBlur?: () => void
  className?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

/**
 * One field holding the country flag, dialling code and the number. The
 * flag/code opens a searchable country list; the number is formatted as you
 * type for the chosen country and emitted as E.164.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    value,
    onChange,
    defaultCountry = DEFAULT_COUNTRY_ISO,
    countries,
    id,
    disabled,
    placeholder,
    invalid,
    onBlur,
    className,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
  },
  ref
) {
  const parsed = React.useMemo(() => parsePhoneValue(value, defaultCountry), [value, defaultCountry])
  // Keep the picked country even while the number is still empty.
  const [pickedIso, setPickedIso] = React.useState<string | null>(null)
  const iso = value ? parsed.iso : (pickedIso ?? parsed.iso)
  const country = findCountry(iso) ?? findCountry(defaultCountry)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const list = React.useMemo(() => {
    const base = orderedCountries().filter((item) => !countries || countries.includes(item.iso))
    return base.filter((item) => matchesCountry(item, query))
  }, [countries, query])

  const display = React.useMemo(() => {
    if (!parsed.national) return ""
    return new AsYouType(iso as CountryCode).input(parsed.national)
  }, [iso, parsed.national])

  const emit = (nextIso: string, national: string) => {
    const e164 = toE164(nextIso, national)
    onChange(e164, { iso: nextIso, national: national.replace(/\D/g, ""), valid: isValidPhone(e164) })
  }

  const exampleHint = country?.iso === "TZ" ? "712 345 678" : country?.iso === "UG" ? "712 345 678" : "Phone number"

  return (
    <Input
      ref={ref}
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      disabled={disabled}
      value={display}
      placeholder={placeholder ?? exampleHint}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid || undefined}
      onBlur={onBlur}
      className={cn("hrms-phone-input", invalid && "hrms-invalid", className)}
      onChange={(event) => {
        const raw = event.target.value
        // Pasting a full international number switches the country.
        if (raw.trim().startsWith("+")) {
          const next = parsePhoneValue(raw, iso)
          setPickedIso(next.iso)
          emit(next.iso, next.national)
          return
        }
        emit(iso, raw)
      }}
      contentBefore={
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setQuery("")
          }}
        >
          <PopoverTrigger
            disabled={disabled}
            render={
              <button
                type="button"
                aria-label={`Country code: ${country?.name ?? "select"} ${country?.dialCode ?? ""}`}
                className="-ml-1 mr-1 inline-flex h-7 items-center gap-1.5 rounded-sm px-1.5 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              />
            }
          >
            {country ? <CountryFlag code={country.iso} className="h-3.5 w-5 shrink-0 rounded-[2px]" /> : null}
            <span className="tabular-nums">{country?.dialCode ?? "+"}</span>
            <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="ml-0.5 h-5 w-px bg-border" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
            <div className="border-b border-border p-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search country or code"
                  aria-label="Search country or code"
                  data-control="free"
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </div>
            <ul role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto overscroll-contain p-1">
              {list.length ? (
                list.map((item) => (
                  <li key={item.iso} role="option" aria-selected={item.iso === country?.iso}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                        item.iso === country?.iso && "bg-primary/10 text-primary"
                      )}
                      onClick={() => {
                        setPickedIso(item.iso)
                        setOpen(false)
                        setQuery("")
                        emit(item.iso, parsed.national)
                      }}
                    >
                      <CountryFlag code={item.iso} className="h-3.5 w-5 shrink-0 rounded-[2px]" />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <span className="tabular-nums text-muted-foreground">{item.dialCode}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-2 py-3 text-center text-sm text-muted-foreground">No country matches.</li>
              )}
            </ul>
          </PopoverContent>
        </Popover>
      }
    />
  )
})
