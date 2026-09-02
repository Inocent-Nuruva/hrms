import { describe, expect, it } from "vitest"

import {
  isOnboardingActableStatus,
  isOnboardingDraftStatus,
  mergeAdminRecords,
  recordMatchesId,
  resolveApprovalOwnerLabel,
  resolveAuditActorLabel,
  resolveCatalogLabel,
  resolvePersonLabel,
  resolveResponsiblePartyLabel,
  resolveRoleLabel,
} from "@/lib/onboarding-activity-labels"

describe("onboarding activity labels", () => {
  const roles = [
    { id: 19, display_name: "Human Resource", name: "hr" },
  ]
  const users = [
    {
      id: 50,
      company_user_id: 146,
      user: { first_name: "Jane", last_name: "Namakula", email: "jane@example.com" },
    },
  ]

  it("matches a catalog row when any of the id keys equal the requested id", () => {
    expect(recordMatchesId(users[0], 146, ["id", "company_user_id", "user_id"])).toBe(true)
    expect(recordMatchesId(users[0], 50, ["id", "company_user_id", "user_id"])).toBe(true)
    expect(recordMatchesId(users[0], 99, ["id", "company_user_id", "user_id"])).toBe(false)
  })

  it("resolves role and user names instead of #id fallbacks", () => {
    expect(resolveRoleLabel(roles, 19)).toBe("Human Resource")
    expect(resolvePersonLabel(users, 146)).toBe("Jane Namakula")
    expect(
      resolveCatalogLabel(users, 146, ["id", "company_user_id"], ["full_name", "name", "email"])
    ).toBe("Jane Namakula")
  })

  it("builds the workflow owner line from nested objects even without catalogs", () => {
    expect(
      resolveResponsiblePartyLabel(
        {
          assigned_role_id: 19,
          assigned_user_id: 146,
          assigned_role: { id: 19, display_name: "Human Resource" },
          assigned_user: { id: 146, full_name: "Jane Namakula" },
        },
        [],
        []
      )
    ).toBe("Role: Human Resource • User: Jane Namakula")
  })

  it("looks up owner names from catalogs when the step only has ids", () => {
    expect(
      resolveResponsiblePartyLabel(
        { assigned_role_id: 19, assigned_user_id: 146 },
        roles,
        users
      )
    ).toBe("Role: Human Resource • User: Jane Namakula")
  })

  it("does not render Role: #19 or User: #146 when names cannot be resolved", () => {
    expect(
      resolveResponsiblePartyLabel(
        { assigned_role_id: 19, assigned_user_id: 146 },
        [],
        []
      )
    ).toBe("")
  })

  it("resolves audit actors from nested objects or numeric created_by", () => {
    expect(
      resolveAuditActorLabel(
        { action: "Onboarding Request.Created", created_by: 146 },
        users
      )
    ).toBe("Jane Namakula")

    expect(
      resolveAuditActorLabel(
        { actor: { full_name: "Kevin Kiggundu" }, created_by: 1 },
        []
      )
    ).toBe("Kevin Kiggundu")
  })

  it("resolves approval owners from nested approver records", () => {
    expect(
      resolveApprovalOwnerLabel(
        { approver: { full_name: "Line Manager" }, assigned_role_id: 19 },
        roles,
        []
      )
    ).toBe("Line Manager")
  })

  it("treats draft requests as not yet approvable", () => {
    expect(isOnboardingDraftStatus("draft")).toBe(true)
    expect(isOnboardingDraftStatus("active")).toBe(false)
    expect(isOnboardingActableStatus("active")).toBe(true)
    expect(isOnboardingActableStatus("draft")).toBe(false)
  })

  it("merges company-user and user catalog rows without dropping either identity", () => {
    const merged = mergeAdminRecords(
      [{ id: 146, full_name: "Company Jane" }],
      [{ id: 50, company_user_id: 146, email: "jane@example.com" }]
    )
    expect(merged.length).toBeGreaterThan(0)
    expect(resolvePersonLabel(merged, 146)).toBeTruthy()
  })
})
