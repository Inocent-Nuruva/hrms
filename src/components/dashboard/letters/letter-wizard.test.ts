import { describe, expect, it } from "vitest"

import { EMPTY_WIZARD_STATE, firstInvalidStep, validateWizardStep, type WizardState } from "./letter-wizard"
import type { LetterTypeInfo } from "@/lib/letters-api"

const warning: LetterTypeInfo = {
  type: "WARNING",
  label: "Warning letter",
  recipient: "employee",
  default_requires_approval: true,
  extra_fields: [
    { key: "warning_reason", label: "Reason", kind: "textarea", required: true },
    { key: "incident_date", label: "Incident date", kind: "date", required: true },
    { key: "custom_note", label: "Note", kind: "text", required: false },
  ],
}
const employee = { kind: "employee" as const, id: 1, name: "A", employee_no: "E1", department: null, position: null, email: null, status: null }

describe("letter wizard step validation", () => {
  it("cannot continue without a recipient", () => {
    expect(validateWizardStep("recipient", EMPTY_WIZARD_STATE, null)).toHaveProperty("recipient")
    expect(validateWizardStep("recipient", { ...EMPTY_WIZARD_STATE, recipient: employee }, null)).toEqual({})
  })

  it("needs a letter type and template", () => {
    const state: WizardState = { ...EMPTY_WIZARD_STATE, recipient: employee }
    expect(Object.keys(validateWizardStep("letter", state, null)).sort()).toEqual(["letterType", "templateId"])
    expect(validateWizardStep("letter", { ...state, letterType: "WARNING", templateId: 4 }, warning)).toEqual({})
  })

  it("rejects non-offer letters for candidates", () => {
    const state: WizardState = { ...EMPTY_WIZARD_STATE, recipient: { ...employee, kind: "candidate" }, letterType: "WARNING", templateId: 4 }
    expect(validateWizardStep("letter", state, warning)).toHaveProperty("letterType")
  })

  it("requires the type's required extra fields only", () => {
    const state: WizardState = { ...EMPTY_WIZARD_STATE, recipient: employee, letterType: "WARNING", templateId: 4, extraValues: { warning_reason: "  " } }
    expect(Object.keys(validateWizardStep("details", state, warning)).sort()).toEqual(["extra.incident_date", "extra.warning_reason"])
    expect(validateWizardStep("details", { ...state, extraValues: { warning_reason: "Late", incident_date: "2026-11-01" } }, warning)).toEqual({})
  })

  it("reports the first invalid step", () => {
    expect(firstInvalidStep(EMPTY_WIZARD_STATE, null)).toBe("recipient")
    const ready: WizardState = {
      ...EMPTY_WIZARD_STATE,
      recipient: employee,
      letterType: "WARNING",
      templateId: 4,
      extraValues: { warning_reason: "Late", incident_date: "2026-11-01" },
      subject: "Warning",
      body: "Text",
    }
    expect(firstInvalidStep({ ...ready, extraValues: {} }, warning)).toBe("details")
    expect(firstInvalidStep({ ...ready, body: "" }, warning)).toBe("preview")
    expect(firstInvalidStep(ready, warning)).toBeNull()
  })
})
