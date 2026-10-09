import { describe, expect, it } from "vitest"
import {
  isStrongPassword,
  registrationMode,
  validateRegistration,
} from "./invitation-registration"

describe("registrationMode", () => {
  it("uses the existing-account flow only when the backend says so", () => {
    expect(registrationMode({ has_existing_account: true })).toBe("existing")
    expect(registrationMode({ has_existing_account: false })).toBe("create")
  })

  it("falls back to creating an account for older backends without the flag", () => {
    expect(registrationMode({})).toBe("create")
    expect(registrationMode({ has_existing_account: null })).toBe("create")
  })
})

describe("isStrongPassword", () => {
  it.each([
    ["StrongPass#2026", true],
    ["short#A1", true],
    ["Sh#1", false],
    ["nouppercase#1", false],
    ["NOLOWERCASE#1", false],
    ["NoNumbers#here", false],
    ["NoSymbols2026", false],
  ])("%s -> %s", (password, expected) => {
    expect(isStrongPassword(password)).toBe(expected)
  })
})

describe("validateRegistration", () => {
  it("accepts an existing account's older, non-strong password without confirmation", () => {
    expect(validateRegistration("existing", "legacy123", "")).toBeNull()
  })

  it("requires a password for an existing account", () => {
    expect(validateRegistration("existing", "", "")).toBe(
      "Enter your current password.",
    )
  })

  it("enforces strength for a new account", () => {
    expect(validateRegistration("create", "legacy123", "legacy123")).toMatch(
      /at least 8 characters/,
    )
  })

  it("requires matching confirmation for a new account", () => {
    expect(
      validateRegistration("create", "StrongPass#2026", "StrongPass#2027"),
    ).toBe("The passwords do not match.")
  })

  it("passes a strong, confirmed new password", () => {
    expect(
      validateRegistration("create", "StrongPass#2026", "StrongPass#2026"),
    ).toBeNull()
  })
})
