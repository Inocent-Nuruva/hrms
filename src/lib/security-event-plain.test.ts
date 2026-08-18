import { describe, expect, it } from "vitest"

import { describeApiPath, describeSecurityEvent } from "./security-event-plain"

describe("describeSecurityEvent", () => {
  it("turns an analytics permission denial into plain language", () => {
    const described = describeSecurityEvent(
      {
        event_type: "ACCESS_DENIED",
        outcome: "DENIED",
        actor_user_id: 2,
        reason: "Required permission check failed",
        metadata: JSON.stringify({
          path: "/api/analytics/freshness",
          missing_permissions: ["analytics:datasets:read"],
        }),
        occurred_at: "2026-08-18T14:45:00.000Z",
      },
      new Map([[2, "Ally Mwenda"]]),
    )

    expect(described.what).toBe("Tried to open company reports")
    expect(described.who).toBe("Ally Mwenda")
    expect(described.why).toBe("They do not have permission to view reports.")
  })

  it("names common API areas", () => {
    expect(describeApiPath("/api/leave/balances")).toBe("leave")
    expect(describeApiPath("/api/attendance/daily-summaries")).toBe("attendance")
  })
})
