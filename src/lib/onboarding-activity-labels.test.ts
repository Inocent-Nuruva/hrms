import { describe, expect, it } from "vitest"

import {
  filterAssigneesForStep,
  isOnboardingActableStatus,
  isOnboardingDraftStatus,
  mergeAdminRecords,
  preferredAssigneeId,
  recordHasRole,
  recordMatchesId,
  resolveApprovalOwnerLabel,
  resolveAuditActorLabel,
  resolveCatalogLabel,
  resolvePersonLabel,
  resolveResponsiblePartyLabel,
  resolveRoleLabel,
  summarizeOnboardingApprovals,
} from "@/lib/onboarding-activity-labels"

describe("onboarding activity labels", () => {
  const roles = [{ id: 19, display_name: "Human Resource", name: "hr" }]
  const users = [
    {
      id: 50,
      company_user_id: 146,
      user: {
        first_name: "Jane",
        last_name: "Namakula",
        email: "jane@example.com",
      },
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
    expect(resolveCatalogLabel(users, 146, ["id", "company_user_id"], ["full_name", "name", "email"])).toBe(
      "Jane Namakula",
    )
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
        [],
      ),
    ).toBe("Role: Human Resource • User: Jane Namakula")
  })

  it("looks up owner names from catalogs when the step only has ids", () => {
    expect(resolveResponsiblePartyLabel({ assigned_role_id: 19, assigned_user_id: 146 }, roles, users)).toBe(
      "Role: Human Resource • User: Jane Namakula",
    )
  })

  it("does not render Role: #19 or User: #146 when names cannot be resolved", () => {
    expect(resolveResponsiblePartyLabel({ assigned_role_id: 19, assigned_user_id: 146 }, [], [])).toBe("Assigned team member")
  })

  it("resolves audit actors from nested objects or numeric created_by", () => {
    expect(resolveAuditActorLabel({ action: "Onboarding Request.Created", created_by: 146 }, users)).toBe(
      "Jane Namakula",
    )

    expect(resolveAuditActorLabel({ actor: { full_name: "Kevin Kiggundu" }, created_by: 1 }, [])).toBe("Kevin Kiggundu")
  })

  it("resolves approval owners from nested approver records", () => {
    expect(
      resolveApprovalOwnerLabel({ approver: { full_name: "Line Manager" }, assigned_role_id: 19 }, roles, []),
    ).toBe("Line Manager")
  })

  it("resolves pending onboarding approvers from approver_company_user_id", () => {
    expect(
      resolveApprovalOwnerLabel({ approver_company_user_id: 146, status: "pending", approval_level: 1 }, [], users),
    ).toBe("Jane Namakula")
  })

  it("summarizes who the request is waiting on", () => {
    const summary = summarizeOnboardingApprovals(
      [
        {
          status: "in_review",
          current_approval_level: 1,
          approvals: [
            {
              id: 11,
              approval_level: 1,
              status: "pending",
              approver: {
                user: {
                  first_name: "Ssali",
                  last_name: "Ronald",
                  email: "ssali.ronald@example.com",
                },
              },
            },
            {
              id: 12,
              approval_level: 2,
              status: "pending",
              approver_company_user_id: 146,
            },
          ],
        },
      ],
      [],
      users,
    )
    expect(summary.waitingLabel).toBe("Pending with Ssali Ronald (ssali.ronald@example.com)")
    expect(summary.pendingNames).toEqual(["Ssali Ronald"])
    expect(summary.pendingLabels).toEqual(["Ssali Ronald (ssali.ronald@example.com)"])
    expect(summary.rows[0]?.email).toBe("ssali.ronald@example.com")
    expect(summary.rows[1]?.name).toBe("Jane Namakula")
  })

  it("treats draft requests as not yet approvable", () => {
    expect(isOnboardingDraftStatus("draft")).toBe(true)
    expect(isOnboardingDraftStatus("not_started")).toBe(true)
    expect(isOnboardingDraftStatus("pending")).toBe(true)
    expect(isOnboardingActableStatus("submitted")).toBe(true)
    expect(isOnboardingActableStatus("in_review")).toBe(true)
    expect(isOnboardingActableStatus("draft")).toBe(false)
  })

  it("merges company-user and user catalog rows without dropping either identity", () => {
    const merged = mergeAdminRecords(
      [{ id: 146, full_name: "Company Jane" }],
      [{ id: 50, company_user_id: 146, email: "jane@example.com" }],
    )
    expect(merged.length).toBeGreaterThan(0)
    expect(resolvePersonLabel(merged, 146)).toBeTruthy()
  })

  it("keeps an assigned user visible and filters the rest by role", () => {
    const hrUser = {
      id: 62,
      company_user_id: 62,
      first_name: "Asha",
      last_name: "Mwinyi",
      email: "asha@alliance.co.tz",
      roles: [{ id: 14, name: "HR" }],
    }
    const itUser = {
      id: 8,
      first_name: "John",
      last_name: "IT",
      roles: [{ id: 11, name: "IT" }],
    }
    expect(preferredAssigneeId(hrUser)).toBe(62)
    expect(
      preferredAssigneeId({
        user: { id: 77, first_name: "Nested", last_name: "RoleUser" },
      }),
    ).toBe(77)
    expect(recordHasRole(hrUser, 14)).toBe(true)
    expect(recordHasRole(itUser, 14)).toBe(false)
    expect(
      filterAssigneesForStep([hrUser, itUser], {
        roleId: 14,
        selectedId: 8,
      }).map((row) => preferredAssigneeId(row)),
    ).toEqual([62, 8])
    expect(
      filterAssigneesForStep([hrUser, itUser], {
        roleId: 14,
        search: "asha",
      }).map((row) => preferredAssigneeId(row)),
    ).toEqual([62])
  })
})
