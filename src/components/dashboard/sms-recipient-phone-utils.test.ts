import { describe, expect, it } from "vitest"

import {
  composeE164,
  filterSmsCountryOptions,
  formatDialCode,
  isoFromDialDigits,
  listSmsCountryOptions,
  parseRecipientPhoneInput,
  splitNationalDigits,
} from "./sms-recipient-phone-utils"

describe("sms recipient phone", () => {
  it("maps a country code to its flag iso", () => {
    expect(isoFromDialDigits("255")).toBe("TZ")
    expect(isoFromDialDigits("+254")).toBe("KE")
    expect(isoFromDialDigits("1")).toBe("US")
    expect(isoFromDialDigits("")).toBeNull()
  })

  it("formats the country-code field with a plus", () => {
    expect(formatDialCode("255")).toBe("+255")
    expect(formatDialCode("+27")).toBe("+27")
    expect(formatDialCode("")).toBe("+")
  })

  it("splits a pasted international number into code and 9 national digits", () => {
    expect(parseRecipientPhoneInput("+255712345678")).toEqual({
      dialDigits: "255",
      nationalDigits: "712345678",
    })
    expect(parseRecipientPhoneInput("0712345678")).toEqual({
      dialDigits: "255",
      nationalDigits: "712345678",
    })
  })

  it("lists countries with names and filters by name or code", () => {
    const options = listSmsCountryOptions()
    expect(options[0]?.iso).toBe("TZ")
    expect(options.some((option) => option.iso === "KE" && option.name === "Kenya")).toBe(true)
    expect(filterSmsCountryOptions(options, "kenya").map((option) => option.iso)).toContain("KE")
    expect(filterSmsCountryOptions(options, "+255").map((option) => option.iso)).toContain("TZ")
  })

  it("builds E.164 only when country code and 9 digits are present", () => {
    expect(composeE164("255", "712345678")).toBe("+255712345678")
    expect(composeE164("255", "71234")).toBe("")
    expect(splitNationalDigits("712345678")).toEqual([
      "7",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ])
  })
})
