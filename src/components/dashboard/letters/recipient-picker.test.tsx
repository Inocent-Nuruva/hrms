// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RecipientPicker } from "./recipient-picker"
import type { LetterRecipient } from "@/lib/letters-api"

const mock = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock("@/lib/letters-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  searchLetterRecipients: mock.search,
}))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  document.body.innerHTML = ""
})

const rows: LetterRecipient[] = [
  { kind: "employee", id: 7, name: "Filbert Msaki", employee_no: "E007", department: "Finance", position: "Accountant", email: null, status: "ACTIVE" },
  { kind: "candidate", id: 3, name: "Fatma Ali", employee_no: null, department: null, position: "Driver", email: "f@x.tz", status: "OFFER" },
]

function Harness({ onChange }: { onChange: (row: LetterRecipient | null) => void }) {
  const [value, setValue] = React.useState<LetterRecipient | null>(null)
  return (
    <RecipientPicker
      token="t"
      kind="any"
      value={value}
      onChange={(row) => {
        setValue(row)
        onChange(row)
      }}
    />
  )
}

function typeInto(input: HTMLInputElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

function key(target: Element, keyName: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true }))
}

describe("RecipientPicker", () => {
  it("searches after the debounce and selects with the keyboard", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.useFakeTimers()
    mock.search.mockResolvedValue(rows)
    const onChange = vi.fn()
    const element = document.createElement("div")
    document.body.append(element)
    const root = createRoot(element)
    await act(async () => root.render(<Harness onChange={onChange} />))
    const input = element.querySelector("input")!
    expect(input.getAttribute("role")).toBe("combobox")

    await act(async () => {
      typeInto(input, "f")
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(mock.search).not.toHaveBeenCalled()

    await act(async () => {
      typeInto(input, "fa")
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(mock.search).toHaveBeenCalledTimes(1)
    expect(mock.search.mock.calls[0].slice(0, 3)).toEqual(["t", "fa", "any"])
    const options = element.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options[0].textContent).toContain("E007 · Finance · Accountant")
    expect(options[1].textContent).toContain("Candidate")
    expect(options[0].getAttribute("aria-selected")).toBe("true")

    await act(async () => key(input, "ArrowDown"))
    const second = element.querySelectorAll('[role="option"]')[1]
    expect(second.getAttribute("aria-selected")).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(second.id)

    await act(async () => key(input, "Enter"))
    expect(onChange).toHaveBeenCalledWith(rows[1])
    expect(element.textContent).toContain("Fatma Ali")
    expect(element.querySelector('[role="listbox"]')).toBeNull()
    await act(async () => root.unmount())
  })
})
