export const HOLIDAY_IMPORT_COUNTRIES = [
  { code: "TZ", label: "Tanzania" },
  { code: "KE", label: "Kenya" },
  { code: "UG", label: "Uganda" },
] as const

export type HolidayImportCountryCode = (typeof HOLIDAY_IMPORT_COUNTRIES)[number]["code"]
