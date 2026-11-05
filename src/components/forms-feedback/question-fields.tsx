"use client"
import { FeedbackDropdown } from "./feedback-dropdown"
import { DateInput } from "@/components/ui/date-input"
import {
  Checkbox,
  Field,
  Input,
  Radio,
  RadioGroup,
  Rating,
  Option,
  SpinButton,
  Textarea,
} from "@fluentui/react-components"
import type { Question } from "@/lib/forms-feedback"
export function QuestionFields({
  questions,
  answers,
  onChange,
  disabled = false,
}: {
  questions: Question[]
  answers: Record<string, unknown>
  onChange: (id: string, value: unknown) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {questions.map((q, index) => (
        <Field
          key={q.id}
          label={`${index + 1}. ${q.label}`}
          required={q.required}
          hint={
            q.type === "rating"
              ? "1 — Very dissatisfied · 5 — Very satisfied"
              : undefined
          }
        >
          {q.type === "long_text" ? (
            <Textarea
              disabled={disabled}
              required={q.required}
              maxLength={5000}
              value={String(answers[q.id] ?? "")}
              onChange={(_, d) => onChange(q.id, d.value)}
            />
          ) : q.type === "multiple_choice" ? (
            <div className="flex flex-col">
              {q.options?.map((o) => (
                <Checkbox
                  key={o}
                  disabled={disabled}
                  label={o}
                  checked={
                    Array.isArray(answers[q.id]) &&
                    (answers[q.id] as string[]).includes(o)
                  }
                  onChange={(_, d) => {
                    const selected = Array.isArray(answers[q.id])
                      ? (answers[q.id] as string[])
                      : []
                    onChange(
                      q.id,
                      d.checked
                        ? [...selected, o]
                        : selected.filter((v) => v !== o),
                    )
                  }}
                />
              ))}
            </div>
          ) : q.type === "yes_no" ? (
            <RadioGroup
              disabled={disabled}
              value={answers[q.id] === undefined ? "" : String(answers[q.id])}
              onChange={(_, d) => onChange(q.id, d.value === "true")}
            >
              <Radio value="true" label="Yes" />
              <Radio value="false" label="No" />
            </RadioGroup>
          ) : q.type === "rating" ? (
            <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
              <Rating
                aria-label={`${index + 1}. ${q.label}`}
                aria-required={q.required}
                color="brand"
                max={5}
                size="extra-large"
                value={
                  typeof answers[q.id] === "number"
                    ? (answers[q.id] as number)
                    : 0
                }
                itemLabel={(value) => `${value} out of 5 stars`}
                onChange={(_, data) => onChange(q.id, data.value || undefined)}
              />
            </fieldset>
          ) : q.type === "single_choice" ? (
            <FeedbackDropdown
              disabled={disabled}
              required={q.required}
              value={String(answers[q.id] ?? "")}
              onChange={(_, data) => onChange(q.id, data.value)}
            >
              <Option value="">Select an answer</Option>
              {(q.options ?? []).map((option) => (
                <Option key={option} value={option}>
                  {option}
                </Option>
              ))}
            </FeedbackDropdown>
          ) : q.type === "date" ? (
            <DateInput
              disabled={disabled}
              required={q.required}
              value={String(answers[q.id] ?? "")}
              onValueChange={(value) => onChange(q.id, value)}
            />
          ) : q.type === "number" ? (
            <SpinButton
              value={
                typeof answers[q.id] === "number"
                  ? (answers[q.id] as number)
                  : null
              }
              disabled={disabled}
              aria-required={q.required}
              displayValue={String(answers[q.id] ?? "")}
              onChange={(_, data) => {
                const value =
                  data.value ??
                  (data.displayValue?.trim()
                    ? Number(data.displayValue)
                    : undefined)
                onChange(q.id, value)
              }}
            />
          ) : (
            <Input
              disabled={disabled}
              required={q.required}
              maxLength={500}
              value={String(answers[q.id] ?? "")}
              onChange={(_, data) => onChange(q.id, data.value)}
            />
          )}
        </Field>
      ))}
    </div>
  )
}
