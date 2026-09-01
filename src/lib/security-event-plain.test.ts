import { describe, expect, it } from "vitest"

import { describeApiPath, describeSecurityEvent } from "./security-event-plain"

describe("describeSecurityEvent", () => {
  it("turns an analytics permission denial into plain language", () => {
    const described = describeSecurityEvent(
      {
        event_type: "ACCESS_DENIED",
        outcome: "DENIED",
        actor_user_id: 2,
        actor_company_user_id: 1,
        reason: "Required permission check failed",
        metadata: JSON.stringify({
          path: "/api/analytics/freshness",
          missing_permissions: ["analytics:datasets:read"],
        }),
        occurred_at: "2026-08-18T14:45:00.000Z",
      },
      {
        byCompanyUserId: new Map([[1, "Ally Mwenda"]]),
        byUserId: new Map([[2, "Ally Mwenda"]]),
      },
    )

    expect(described.what).toBe("Tried to open company reports")
    expect(described.who).toBe("Ally Mwenda")
    expect(described.why).toBe("They do not have permission to view reports.")
  })

  it("does not invent a name when the event only has ids", () => {
    const described = describeSecurityEvent({
      actor_user_id: 2,
      actor_company_user_id: 1,
      metadata: { path: "/api/analytics/freshness" },
    })
    expect(described.who).toBe("Name not provided")
  })

  it("uses the actor name returned with the event", () => {
    const described = describeSecurityEvent({
      actor_user_id: 2,
      actor_name: "Kelvin Kiggundu",
      actor_email: "kelvin@example.com",
      metadata: { path: "/api/analytics/freshness" },
    })
    expect(described.who).toBe("Kelvin Kiggundu")
  })

  it("falls back to the actor email stored on the event", () => {
    const described = describeSecurityEvent({
      actor_user_id: 2,
      metadata: {
        path: "/api/analytics/freshness",
        actor_email: "kelvin@example.com",
      },
    })
    expect(described.who).toBe("kelvin@example.com")
  })

  it("names common API areas", () => {
    expect(describeApiPath("/api/leave/balances")).toBe("leave")
    expect(describeApiPath("/api/attendance/daily-summaries")).toBe("attendance")
  })
})
