"use client"

import * as React from "react"
import { Combobox, Option } from "@fluentui/react-components"

import { CountryFlag } from "@/components/country-flag"
import { findCountry, matchesCountry, orderedCountries } from "@/lib/countries"
import { cn } from "@/lib/utils"

/**
 * Searchable country picker with flags, in the same Fluent style as every
 * other dropdown. Stores the country name by default (what profile records
 * keep) or the ISO code with `valueType="iso"`.
 */
export function CountrySelect({
  value,
  onChange,
  valueType = "name",
  id,
  placeholder = "Select country",
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  valueType?: "name" | "iso"
  id?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  "aria-label"?: string
}) {
  const selected = findCountry(value)
  const [query, setQuery] = React.useState<string | null>(null)
  const typed = query ?? ""
  const options = React.useMemo(() => orderedCountries().filter((country) => matchesCountry(country, typed)), [typed])

  return (
    <Combobox
      id={id}
      aria-label={ariaLabel ?? placeholder}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      placeholder={placeholder}
      className={cn("w-full min-w-0", invalid && "hrms-invalid", className)}
      // Show the typed search while open, otherwise the selected name.
      value={query ?? selected?.name ?? value ?? ""}
      selectedOptions={selected ? [selected.iso] : []}
      onChange={(event) => setQuery(event.target.value)}
      onOpenChange={(_event, data) => {
        if (!data.open) setQuery(null)
      }}
      onOptionSelect={(_event, data) => {
        const country = findCountry(data.optionValue)
        setQuery(null)
        if (country) onChange(valueType === "iso" ? country.iso : country.name)
      }}
    >
      {options.length ? (
        options.map((country) => (
          <Option key={country.iso} value={country.iso} text={country.name}>
            <span className="flex min-w-0 items-center gap-2">
              <CountryFlag code={country.iso} className="h-3.5 w-5 shrink-0 rounded-[2px]" />
              <span className="truncate">{country.name}</span>
            </span>
          </Option>
        ))
      ) : (
        <Option key="none" value="" text="" disabled>
          No country matches
        </Option>
      )}
    </Combobox>
  )
}
