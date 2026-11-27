"use client"

import { PhoneInput } from "@/components/ui/phone-input"
import { FormField } from "@/components/ui/form-field"
import { findCountry } from "@/lib/countries"
import {
  DEFAULT_SMS_DIAL_DIGITS,
  SMS_NATIONAL_DIGIT_COUNT,
  digitsOnly,
  isoFromDialDigits,
} from "@/components/dashboard/sms-recipient-phone-utils"

export function SmsRecipientPhoneInput({
  countryCode,
  nationalDigits,
  onChange,
  disabled = false,
}: {
  countryCode: string
  nationalDigits: string
  onChange: (next: { countryCode: string; nationalDigits: string }) => void
  disabled?: boolean
}) {
  const dialDigits = digitsOnly(countryCode) || DEFAULT_SMS_DIAL_DIGITS
  const iso = isoFromDialDigits(dialDigits)
  const national = digitsOnly(nationalDigits)
  const value = national ? `+${dialDigits}${national}` : ""

  return (
    <FormField label="Phone number" htmlFor="sms-recipient-phone">
      <PhoneInput
        id="sms-recipient-phone"
        value={value}
        defaultCountry={iso ?? undefined}
        disabled={disabled}
        onChange={(_value, details) => {
          const nextDial = digitsOnly(findCountry(details.iso)?.dialCode ?? "") || dialDigits
          onChange({
            countryCode: nextDial,
            nationalDigits: digitsOnly(details.national).slice(0, SMS_NATIONAL_DIGIT_COUNT),
          })
        }}
      />
    </FormField>
  )
}
