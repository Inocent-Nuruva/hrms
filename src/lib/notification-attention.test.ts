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

  it("keeps absolute evidence links on the employee request page", () => {
    expect(resolveNotificationUrl({ type: "LEAVE_EVIDENCE_REQUIRED", entity_type: "LEAVE_REQUEST", entity_id: 7, action_url: "https://hr.example/dashboard/me/leave/requests?highlight=7" })).toBe("/dashboard/me/leave/requests?highlight=7")
  })
  it("repairs historical leave links without opening nonexistent pages", () => {
    expect(resolveNotificationUrl({ type: "LEAVE_APPROVAL_REQUIRED", action_url: "https://hr.example/leave/7/review" })).toBe("/dashboard/leave-management/requests?highlight=7")
    expect(resolveNotificationUrl({ type: "LEAVE_APPROVED", action_url: "/leave/7" })).toBe("/dashboard/me/leave/requests?highlight=7")
    expect(resolveNotificationUrl({ type: "LEAVE_SUBMITTED", action_url: "/leave/7/review" })).toBe("/dashboard/me/leave/requests?highlight=7")
    expect(resolveNotificationUrl({ type: "LEAVE_ROUTING_REQUIRED", entity_id: 7 })).toBe("/dashboard/leave-management/requests?highlight=7")
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
