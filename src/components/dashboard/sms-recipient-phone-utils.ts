import { getCountries, getCountryCallingCode } from "libphonenumber-js"

const PREFERRED_ISO_BY_DIAL: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "44": "GB",
  "255": "TZ",
  "254": "KE",
  "256": "UG",
  "250": "RW",
  "257": "BI",
  "260": "ZM",
  "27": "ZA",
}

const DIAL_TO_ISO = (() => {
  const map = new Map<string, string>()
  for (const iso of getCountries()) {
    const dial = String(getCountryCallingCode(iso))
    if (!map.has(dial)) map.set(dial, iso)
  }
  for (const [dial, iso] of Object.entries(PREFERRED_ISO_BY_DIAL)) {
    map.set(dial, iso)
  }
  return map
})()

export const DEFAULT_SMS_DIAL_DIGITS = "255"
export const SMS_NATIONAL_DIGIT_COUNT = 9

export type SmsCountryOption = {
  iso: string
  name: string
  dial: string
}

const PINNED_COUNTRY_ISOS = ["TZ", "KE", "UG", "RW", "BI", "ZM", "ZA", "GB", "US"]

export function listSmsCountryOptions(): SmsCountryOption[] {
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
  const options = getCountries().map((iso) => ({
    iso,
    name: regionNames.of(iso) ?? iso,
    dial: String(getCountryCallingCode(iso)),
  }))
  return options.sort((left, right) => {
    const leftPin = PINNED_COUNTRY_ISOS.indexOf(left.iso)
    const rightPin = PINNED_COUNTRY_ISOS.indexOf(right.iso)
    if (leftPin !== -1 || rightPin !== -1) {
      if (leftPin === -1) return 1
      if (rightPin === -1) return -1
      return leftPin - rightPin
    }
    return left.name.localeCompare(right.name)
  })
}

export function filterSmsCountryOptions(
  options: SmsCountryOption[],
  query: string,
) {
  const term = query.trim().toLowerCase()
  if (!term) return options
  return options.filter((option) => {
    return (
      option.name.toLowerCase().includes(term) ||
      option.iso.toLowerCase().includes(term) ||
      option.dial.includes(digitsOnly(term)) ||
      `+${option.dial}`.includes(term)
    )
  })
}

export function digitsOnly(value: string) {
  return value.replace(/\D+/g, "")
}

export function formatDialCode(digits: string) {
  const clean = digitsOnly(digits).slice(0, 4)
  return clean ? `+${clean}` : "+"
}

export function isoFromDialDigits(digits: string): string | null {
  const clean = digitsOnly(digits)
  if (!clean) return null
  for (let length = Math.min(clean.length, 4); length >= 1; length -= 1) {
    const iso = DIAL_TO_ISO.get(clean.slice(0, length))
    if (iso) return iso
  }
  return null
}

export function parseRecipientPhoneInput(raw: string): {
  dialDigits: string
  nationalDigits: string
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { dialDigits: DEFAULT_SMS_DIAL_DIGITS, nationalDigits: "" }
  }

  const hasPlus = trimmed.includes("+")
  const national = digitsOnly(trimmed)

  if (!hasPlus && national.startsWith("0") && national.length === 10) {
    return {
      dialDigits: DEFAULT_SMS_DIAL_DIGITS,
      nationalDigits: national.slice(1).slice(0, SMS_NATIONAL_DIGIT_COUNT),
    }
  }

  if (!hasPlus && national.length <= SMS_NATIONAL_DIGIT_COUNT) {
    return {
      dialDigits: DEFAULT_SMS_DIAL_DIGITS,
      nationalDigits: national.slice(0, SMS_NATIONAL_DIGIT_COUNT),
    }
  }

  for (let length = Math.min(national.length, 4); length >= 1; length -= 1) {
    const dial = national.slice(0, length)
    const rest = national.slice(length)
    if (DIAL_TO_ISO.has(dial) && rest.length >= 7) {
      return {
        dialDigits: dial,
        nationalDigits: rest.slice(0, SMS_NATIONAL_DIGIT_COUNT),
      }
    }
  }

  return {
    dialDigits: DEFAULT_SMS_DIAL_DIGITS,
    nationalDigits: national.slice(0, SMS_NATIONAL_DIGIT_COUNT),
  }
}

export function composeE164(dialDigits: string, nationalDigits: string) {
  const dial = digitsOnly(dialDigits)
  const national = digitsOnly(nationalDigits).slice(0, SMS_NATIONAL_DIGIT_COUNT)
  if (!dial || national.length !== SMS_NATIONAL_DIGIT_COUNT) return ""
  return `+${dial}${national}`
}

export function splitNationalDigits(value: string): string[] {
  const digits = digitsOnly(value).slice(0, SMS_NATIONAL_DIGIT_COUNT)
  return Array.from({ length: SMS_NATIONAL_DIGIT_COUNT }, (_, index) => digits[index] ?? "")
}
