// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { QuestionFields } from "./question-fields"
import { identityNotice } from "@/lib/forms-feedback"
vi.mock("@/lib/admin-api", () => ({ adminRequest: vi.fn() }))
vi.mock("@/lib/session-client", () => ({
  readStoredSessionTokens: () => ({ accessToken: "" }),
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
it("shows labelled ratings, preserves false answers, and has no upload control", async () => {
  await act(async () =>
    root.render(
      <QuestionFields
        questions={[
          {
            id: "rating",
            label: "Satisfaction",
            type: "rating",
            required: true,
          },
          {
            id: "answer",
            label: "Would you recommend us?",
            type: "yes_no",
            required: true,
          },
        ]}
        answers={{ rating: 4, answer: false }}
        onChange={() => {}}
      />,
    ),
  )
  expect(container.querySelector("select")?.value).toBe("4")
  expect(
    container.querySelector<HTMLInputElement>('input[value="false"]')?.checked,
  ).toBe(true)
  expect(container.querySelector('input[type="file"]')).toBeNull()
  expect(container.textContent).toContain("Very dissatisfied")
})
it("explains identity and finality before anonymous submission", () => {
  expect(identityNotice("anonymous")).toContain("not linked")
  expect(identityNotice("anonymous")).toContain("cannot be changed")
  expect(identityNotice("identified")).toContain("name and employee details")
})
