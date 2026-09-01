"use client"

import * as React from "react"
import * as FlagIcons from "country-flag-icons/react/3x2"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  DEFAULT_SMS_DIAL_DIGITS,
  SMS_NATIONAL_DIGIT_COUNT,
  digitsOnly,
  filterSmsCountryOptions,
  formatDialCode,
  isoFromDialDigits,
  listSmsCountryOptions,
  parseRecipientPhoneInput,
  splitNationalDigits,
} from "@/components/dashboard/sms-recipient-phone-utils"

const FLAG_COMPONENTS = FlagIcons as Record<
  string,
  React.ComponentType<{ title?: string; className?: string }>
>

const COUNTRY_OPTIONS = listSmsCountryOptions()

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
  const Flag = iso ? FLAG_COMPONENTS[iso] : null
  const boxes = splitNationalDigits(nationalDigits)
  const boxRefs = React.useRef<Array<HTMLInputElement | null>>([])
  const [countryOpen, setCountryOpen] = React.useState(false)
  const [countryQuery, setCountryQuery] = React.useState("")
  const filteredCountries = React.useMemo(
    () => filterSmsCountryOptions(COUNTRY_OPTIONS, countryQuery),
    [countryQuery],
  )

  const setDial = (raw: string) => {
    onChange({
      countryCode: digitsOnly(raw).slice(0, 4),
      nationalDigits: digitsOnly(nationalDigits).slice(0, SMS_NATIONAL_DIGIT_COUNT),
    })
  }

  const setNational = (nextDigits: string, focusIndex?: number) => {
    const next = digitsOnly(nextDigits).slice(0, SMS_NATIONAL_DIGIT_COUNT)
    onChange({ countryCode: dialDigits, nationalDigits: next })
    if (typeof focusIndex === "number") {
      window.requestAnimationFrame(() => {
        boxRefs.current[Math.min(Math.max(focusIndex, 0), SMS_NATIONAL_DIGIT_COUNT - 1)]?.focus()
      })
    }
  }

  const applyPastedValue = (raw: string) => {
    const parsed = parseRecipientPhoneInput(raw)
    onChange({
      countryCode: parsed.dialDigits,
      nationalDigits: parsed.nationalDigits,
    })
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-[7.5rem] gap-1.5 text-sm">
          <span className="font-medium">Country code</span>
          <span className="relative">
            <Popover
              open={countryOpen}
              onOpenChange={(open) => {
                setCountryOpen(open)
                if (!open) setCountryQuery("")
              }}
            >
              <PopoverTrigger
                disabled={disabled}
                render={
                  <button
                    type="button"
                    className="absolute inset-y-0 left-1 z-10 flex items-center rounded-sm px-1 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    aria-label="Select country"
                  />
                }
              >
                {Flag ? (
                  <Flag
                    title={iso ?? undefined}
                    className="h-4 w-6 rounded-sm border border-border"
                  />
                ) : (
                  <span className="h-4 w-6 rounded-sm border border-dashed border-border bg-muted/40" />
                )}
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2">
                <input
                  value={countryQuery}
                  onChange={(event) => setCountryQuery(event.target.value)}
                  placeholder="Search country or code"
                  className="mb-2 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
                  autoFocus
                />
                <div className="max-h-56 overflow-auto">
                  {filteredCountries.map((option) => {
                    const OptionFlag = FLAG_COMPONENTS[option.iso]
                    const selected = option.dial === dialDigits
                    return (
                      <button
                        key={`${option.iso}-${option.dial}`}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                          selected && "bg-primary/10",
                        )}
                        onClick={() => {
                          onChange({
                            countryCode: option.dial,
                            nationalDigits: digitsOnly(nationalDigits).slice(
                              0,
                              SMS_NATIONAL_DIGIT_COUNT,
                            ),
                          })
                          setCountryOpen(false)
                          setCountryQuery("")
                        }}
                      >
                        {OptionFlag ? (
                          <OptionFlag className="h-4 w-6 shrink-0 rounded-sm border border-border" />
                        ) : (
                          <span className="h-4 w-6 shrink-0 rounded-sm border border-dashed border-border" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {option.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          +{option.dial}
                        </span>
                      </button>
                    )
                  })}
                  {filteredCountries.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      No countries match that search.
                    </p>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
            <input
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
              inputMode="tel"
              autoComplete="tel-country-code"
              disabled={disabled}
              value={formatDialCode(dialDigits)}
              onChange={(event) => setDial(event.target.value)}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text")
                if (digitsOnly(text).length > 4) {
                  event.preventDefault()
                  applyPastedValue(text)
                }
              }}
              aria-label="Country calling code"
            />
          </span>
        </label>

        <div className="grid min-w-0 flex-1 gap-1.5 text-sm">
          <span className="font-medium">Phone number</span>
          <div className="flex flex-wrap gap-1">
            {boxes.map((digit, index) => (
              <input
                key={`sms-digit-${index}`}
                ref={(node) => {
                  boxRefs.current[index] = node
                }}
                className={cn(
                  "h-10 w-8 rounded-md border border-slate-300 bg-white text-center text-sm font-semibold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background sm:w-9",
                )}
                inputMode="numeric"
                maxLength={1}
                disabled={disabled}
                value={digit}
                aria-label={`Phone digit ${index + 1} of ${SMS_NATIONAL_DIGIT_COUNT}`}
                onChange={(event) => {
                  const nextDigit = digitsOnly(event.target.value).slice(-1)
                  const next = boxes.map((current, boxIndex) =>
                    boxIndex === index ? nextDigit : current,
                  )
                  setNational(next.join(""), nextDigit ? index + 1 : index)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !boxes[index] && index > 0) {
                    event.preventDefault()
                    const next = [...boxes]
                    next[index - 1] = ""
                    setNational(next.join(""), index - 1)
                  }
                  if (event.key === "ArrowLeft" && index > 0) {
                    event.preventDefault()
                    boxRefs.current[index - 1]?.focus()
                  }
                  if (event.key === "ArrowRight" && index < SMS_NATIONAL_DIGIT_COUNT - 1) {
                    event.preventDefault()
                    boxRefs.current[index + 1]?.focus()
                  }
                }}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text")
                  if (!text) return
                  event.preventDefault()
                  if (digitsOnly(text).length > 1) {
                    applyPastedValue(
                      text.includes("+") || digitsOnly(text).length > SMS_NATIONAL_DIGIT_COUNT
                        ? text
                        : `${formatDialCode(dialDigits)}${boxes.slice(0, index).join("")}${text}`,
                    )
                    return
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
