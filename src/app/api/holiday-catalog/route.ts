import Holidays from "date-holidays"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SUPPORTED_COUNTRIES = {
  TZ: "Tanzania",
  KE: "Kenya",
  UG: "Uganda",
} as const

type SupportedCountryCode = keyof typeof SUPPORTED_COUNTRIES

type HolidayCatalogEntry = {
  countryCode: SupportedCountryCode
  countryName: string
  name: string
  localName: string
  holidayDate: string
  isRecurring: boolean
  type: string
}

function isSupportedCountryCode(value: string): value is SupportedCountryCode {
  return value in SUPPORTED_COUNTRIES
}

function toDateOnly(value: string) {
  const [datePart] = value.split(" ")
  return datePart ?? value
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get("country")?.trim().toUpperCase() ?? ""
  const yearValue = searchParams.get("year")?.trim() ?? ""
  const year = Number(yearValue)

  if (!isSupportedCountryCode(country)) {
    return NextResponse.json({ error: "Unsupported country." }, { status: 400 })
  }

  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 })
  }

  const holidays = new Holidays(country)
  const rows = holidays
    .getHolidays(year)
    .filter((entry) => String(entry.type).toLowerCase() === "public")
    .map<HolidayCatalogEntry>((entry) => ({
      countryCode: country,
      countryName: SUPPORTED_COUNTRIES[country],
      name: entry.name,
      localName: entry.name,
      holidayDate: toDateOnly(entry.date),
      isRecurring: typeof entry.rule === "string" && /^\d{2}-\d{2}$/.test(entry.rule),
      type: String(entry.type),
    }))
    .sort((left, right) => left.holidayDate.localeCompare(right.holidayDate) || left.name.localeCompare(right.name))

  return NextResponse.json({
    countryCode: country,
    countryName: SUPPORTED_COUNTRIES[country],
    year,
    holidays: rows,
  })
}
