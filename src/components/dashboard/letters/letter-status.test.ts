import { describe, expect, it } from "vitest"

import { LETTER_STATUSES, letterStatusMeta, letterTypeLabel, placeholdersIn } from "@/lib/letters-api"

describe("letter status tags", () => {
  it("maps every status to the agreed tone", () => {
    expect(Object.fromEntries(LETTER_STATUSES.map((status) => [status, letterStatusMeta(status).tone]))).toEqual({
      DRAFT: "neutral",
      PENDING_APPROVAL: "warning",
      APPROVED: "primary",
      REJECTED: "danger",
      ISSUED: "success",
      CANCELLED: "neutral",
      SUPERSEDED: "neutral",
    })
    expect(letterStatusMeta("PENDING_APPROVAL").label).toBe("Pending approval")
    expect(letterStatusMeta("WEIRD")).toEqual({ label: "WEIRD", tone: "neutral" })
  })

  it("labels types and finds placeholders", () => {
    expect(letterTypeLabel("CERTIFICATE_OF_SERVICE")).toBe("Certificate of service")
    expect(placeholdersIn("Dear {{employee_first_name}}", "{{ position }} and {{employee_first_name}}")).toEqual(["employee_first_name", "position"])
  })
})
