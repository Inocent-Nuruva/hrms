import { getCountryCallingCode, type CountryCode } from "libphonenumber-js"
import { countries as flagCountryCodes } from "country-flag-icons"

/** One country, as used by the shared country picker and phone input. */
export type Country = {
  /** ISO 3166-1 alpha-2, e.g. "TZ". */
  iso: string
  /** English name, e.g. "Tanzania". */
  name: string
  /** Dialling code with "+", e.g. "+255". */
  dialCode: string
}

const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

function dialCodeFor(iso: string): string {
  try {
    return `+${getCountryCallingCode(iso as CountryCode)}`
  } catch {
    return ""
  }
}

/** Countries that have both a flag and a dialling code, sorted by name. */
export const COUNTRIES: Country[] = (flagCountryCodes as string[])
  .filter((iso) => /^[A-Z]{2}$/.test(iso))
  .map((iso) => ({ iso, name: regionNames?.of(iso) ?? iso, dialCode: dialCodeFor(iso) }))
  .filter((country) => country.dialCode)
  .sort((a, b) => a.name.localeCompare(b.name))

/** Countries listed first in pickers (the company's main markets). */
export const PREFERRED_COUNTRY_ISOS = ["TZ", "UG", "KE", "RW"]

export const DEFAULT_COUNTRY_ISO = "TZ"

export function findCountry(value: string | null | undefined): Country | null {
  const text = value?.trim()
  if (!text) return null
  const upper = text.toUpperCase()
  return (
    COUNTRIES.find((country) => country.iso === upper) ??
    COUNTRIES.find((country) => country.name.toLowerCase() === text.toLowerCase()) ??
    null
  )
}

/** Preferred countries first, then the rest alphabetically. */
export function orderedCountries(): Country[] {
  const preferred = PREFERRED_COUNTRY_ISOS.map((iso) => COUNTRIES.find((country) => country.iso === iso)).filter(
    (country): country is Country => Boolean(country)
  )
  return [...preferred, ...COUNTRIES.filter((country) => !PREFERRED_COUNTRY_ISOS.includes(country.iso))]
}

export function matchesCountry(country: Country, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^\+/, "")
  if (!q) return true
  return (
    country.name.toLowerCase().includes(q) ||
    country.iso.toLowerCase() === q ||
    country.dialCode.replace("+", "").startsWith(q)
  )
}
