import { describe, expect, it } from "vitest"

import {
  notificationAttentionIdsForRoute,
  notificationAttentionRoutes,
  resolveNotificationUrl,
  routesNeedAttention,
} from "./notification-attention"

describe("notification attention routing", () => {
  it("resolves direct destinations and preserves request highlighting", () => {
    expect(resolveNotificationUrl({
      action_url: "/dashboard/me/requests/actions",
      entity_id: "42",
    })).toBe("/dashboard/me/requests/actions?highlight=42")
  })

  it("falls back to the workflow destination for known notification types", () => {
    expect(resolveNotificationUrl({
      entity_type: "leave_request_submitted",
      entity_id: "7",
    })).toBe("/dashboard/leave-management/requests?highlight=7")
  })

  it("routes daily activity report reminders to the self-service report page", () => {
    expect(resolveNotificationUrl({
      type: "DAILY_ACTIVITY_NOT_SUBMITTED",
      entity_type: "DAILY_ACTIVITY_REPORT",
      action_url: "/me/daily-activities",
      title: "Daily Activity Not Submitted",
    })).toBe("/dashboard/me/activities/today")
  })

  it("only exposes unread notification destinations", () => {
    expect(notificationAttentionRoutes([
      { status: "UNREAD", action_url: "/dashboard/me/onboarding" },
      { status: "READ", action_url: "/dashboard/me/offboarding" },
      { status: "UNREAD", action_url: "/dashboard/me/onboarding" },
    ])).toEqual(["/dashboard/me/onboarding"])
  })

  it("acknowledges only unread notifications for the exact page being viewed", () => {
    expect(notificationAttentionIdsForRoute([
      { id: 11, status: "UNREAD", action_url: "/dashboard/employees/onboarding?highlight=7" },
      { notification_id: "12", status: "UNREAD", action_url: "/dashboard/employees/onboarding" },
      { id: 13, status: "READ", action_url: "/dashboard/employees/onboarding" },
      { id: 14, status: "UNREAD", action_url: "/dashboard/employees/profile-update-approvals" },
    ], "/dashboard/employees/onboarding")).toEqual([11, 12])
  })

  it("rolls attention up to a parent route without flagging Dashboard globally", () => {
    const attentionRoutes = ["/dashboard/me/requests/actions"]
    expect(routesNeedAttention(["/dashboard/me"], attentionRoutes)).toBe(true)
    expect(routesNeedAttention(["/dashboard/me/requests/actions"], attentionRoutes)).toBe(true)
    expect(routesNeedAttention(["/dashboard"], attentionRoutes)).toBe(false)
  })
})
