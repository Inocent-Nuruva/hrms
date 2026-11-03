"use client"
import {
  Checkbox,
  Field,
  Input,
  Radio,
  RadioGroup,
  Select,
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
          ) : q.type === "single_choice" || q.type === "rating" ? (
            <Select
              disabled={disabled}
              required={q.required}
              value={String(answers[q.id] ?? "")}
              onChange={(_, d) =>
                onChange(
                  q.id,
                  q.type === "rating"
                    ? d.value
                      ? Number(d.value)
                      : undefined
                    : d.value,
                )
              }
            >
              <option value="">Select an answer</option>
              {(q.type === "rating"
                ? ["1", "2", "3", "4", "5"]
                : (q.options ?? [])
              ).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              disabled={disabled}
              required={q.required}
              type={
                q.type === "number"
                  ? "number"
                  : q.type === "date"
                    ? "date"
                    : "text"
              }
              maxLength={500}
              value={String(answers[q.id] ?? "")}
              onChange={(_, d) =>
                onChange(
                  q.id,
                  q.type === "number"
                    ? d.value
                      ? Number(d.value)
                      : undefined
                    : d.value,
                )
              }
            />
          )}
        </Field>
      ))}
    </div>
  )
}
