import { HOLIDAY_IMPORT_COUNTRIES, type HolidayImportCountryCode } from "@/lib/holiday-catalog"
import Holidays from "date-holidays"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type HolidayCatalogEntry = {
  countryCode: HolidayImportCountryCode
  countryName: string
  name: string
  localName: string
  holidayDate: string
  isRecurring: boolean
  type: string
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

  const option = HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === country)
  if (!option) {
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
      countryCode: option.code,
      countryName: option.label,
      name: entry.name,
      localName: entry.name,
      holidayDate: toDateOnly(entry.date),
      isRecurring: typeof entry.rule === "string" && /^\d{2}-\d{2}$/.test(entry.rule),
      type: String(entry.type),
    }))
    .sort((left, right) => left.holidayDate.localeCompare(right.holidayDate) || left.name.localeCompare(right.name))

  return NextResponse.json({
    countryCode: option.code,
    countryName: option.label,
    year,
    holidays: rows,
  })
}
