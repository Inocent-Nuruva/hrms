import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestNotification,
  createNotificationRule,
  createNotificationTemplate,
  deleteNotification,
  dismissAllNotifications,
  getNotificationRule,
  getNotificationTemplate,
  getNotificationChannelRegistryItem,
  getNotificationChannelSetting,
  getNotificationDelivery,
  getNotificationMailLog,
  getPlatformNotificationMailLog,
  listNotificationChannelRegistry,
  listNotificationRules,
  listNotificationTemplates,
  listNotifications,
  listNotificationChannelSettings,
  listNotificationDeliveries,
  listNotificationMailLogs,
  listMyNotificationPreferences,
  listPlatformNotificationChannelRegistry,
  listPlatformNotificationChannelSettings,
  listPlatformNotificationMailLogs,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsSeen,
  retryPlatformNotificationMailLog,
  retryNotificationMailLog,
  setMyNotificationPreference,
  updateNotificationChannelRegistryItem,
  updateNotificationChannelSetting,
  updateNotificationRule,
  updateNotificationTemplate,
  updatePlatformNotificationChannelRegistryItem,
  updatePlatformNotificationChannelSetting,
} from "./admin-api";

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

describe("notifications admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists notifications with the supported dashboard filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [
            {
              id: 81,
              title: "Leave request approved",
              status: "UNREAD",
              category: "HR",
              priority: "HIGH",
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listNotifications("token", {
      page: 1,
      limit: 20,
      status: "UNREAD",
      category: "HR",
      priority: "HIGH",
      seen: false,
      include_archived: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications?page=1&limit=20&status=UNREAD&category=HR&priority=HIGH&seen=false&include_archived=true",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 81,
        title: "Leave request approved",
        status: "UNREAD",
      }),
    ]);
    expect(result.total).toBe(1);
  });

  it("marks a notification as read and unwraps the updated record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 81,
          status: "READ",
          read_at: "2026-08-14T09:15:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await markNotificationAsRead("token", 81);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications/81/read",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 81,
        status: "READ",
      }),
    );
  });

  it("marks a notification as seen and unwraps the updated record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result: {
          id: 81,
          seen: true,
          seen_at: "2026-08-14T09:16:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await markNotificationAsSeen("token", 81);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications/81/seen",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 81,
        seen: true,
      }),
    );
  });

  it("marks all notifications as read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { status: "OK" } }));
    vi.stubGlobal("fetch", fetchMock);

    await markAllNotificationsAsRead("token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications/read-all",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("creates a dashboard test notification", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 98,
          title: "Dashboard test notification",
          status: "UNREAD",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createTestNotification("token", {
      receiver_company_user_id: 12,
      title: "Dashboard test notification",
      message: "Triggered from tests.",
      type: "dashboard_test",
      category: "SYSTEM",
      priority: "LOW",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          receiver_company_user_id: 12,
          title: "Dashboard test notification",
          message: "Triggered from tests.",
          type: "dashboard_test",
          category: "SYSTEM",
          priority: "LOW",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 98,
        status: "UNREAD",
      }),
    );
  });

  it("handles empty-body permanent delete responses without throwing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteNotification("token", 81);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications/81",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
    expect(result).toBeNull();
  });

  it("dismisses all notifications in one request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { deleted_count: 43 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await dismissAllNotifications("token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/notifications",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result).toEqual({ deleted_count: 43 });
  });

  it("lists and updates my notification preferences", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 21,
              notification_type: "LEAVE_APPROVED",
              channel: "EMAIL",
              is_enabled: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 21,
            notification_type: "LEAVE_APPROVED",
            channel: "EMAIL",
            is_enabled: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listMyNotificationPreferences("token");
    const updated = await setMyNotificationPreference("token", {
      notification_type: "LEAVE_APPROVED",
      channel: "EMAIL",
      is_enabled: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/notifications/preferences",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/me/notifications/preferences",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          notification_type: "LEAVE_APPROVED",
          channel: "EMAIL",
          is_enabled: false,
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 21,
        notification_type: "LEAVE_APPROVED",
      }),
    ]);
    expect(updated).toEqual(
      expect.objectContaining({
        id: 21,
        is_enabled: false,
      }),
    );
  });

  it("lists and updates notification channel settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 1,
              channel: "EMAIL",
              isEnabled: true,
              description: "Email delivery controls",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 1,
            channel: "EMAIL",
            isEnabled: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 1,
            channel: "EMAIL",
            isEnabled: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listNotificationChannelSettings("token");
    const detail = await getNotificationChannelSetting("token", "EMAIL");
    const updated = await updateNotificationChannelSetting("token", "EMAIL", {
      is_enabled: false,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/channel-settings",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/channel-settings/EMAIL",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/notifications/channel-settings/EMAIL",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: false,
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        channel: "EMAIL",
      }),
    ]);
    expect(detail).toEqual(
      expect.objectContaining({
        channel: "EMAIL",
      }),
    );
    expect(updated).toEqual(
      expect.objectContaining({
        isEnabled: false,
      }),
    );
  });

  it("lists notification deliveries with channel and status filters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              {
                id: 14,
                channel: "EMAIL",
                status: "DELIVERED",
                notification_id: 81,
              },
            ],
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 14,
            channel: "EMAIL",
            status: "DELIVERED",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const list = await listNotificationDeliveries("token", {
      page: 1,
      limit: 20,
      channel: "EMAIL",
      status: "DELIVERED",
      notification_id: 81,
    });
    const detail = await getNotificationDelivery("token", 14);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/deliveries?page=1&limit=20&channel=EMAIL&status=DELIVERED&notification_id=81",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/deliveries/14",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(list.rows).toEqual([
      expect.objectContaining({
        id: 14,
        status: "DELIVERED",
      }),
    ]);
    expect(detail).toEqual(
      expect.objectContaining({
        id: 14,
        channel: "EMAIL",
      }),
    );
  });

  it("lists mail logs, fetches detail, and retries a failed send", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              {
                id: 22,
                recipient_email: "hr@example.com",
                status: "FAILED",
              },
            ],
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 22,
            recipient_email: "hr@example.com",
            status: "FAILED",
            error_message: "SMTP timeout",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            id: 23,
            recipient_email: "hr@example.com",
            status: "PENDING",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const list = await listNotificationMailLogs("token", {
      page: 1,
      limit: 20,
      status: "FAILED",
      recipient_email: "hr@example.com",
      only_unscoped: false,
    });
    const detail = await getNotificationMailLog("token", 22);
    const retried = await retryNotificationMailLog("token", 22);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/mail-logs?page=1&limit=20&status=FAILED&recipient_email=hr%40example.com&only_unscoped=false",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/mail-logs/22",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/notifications/mail-logs/22/retry",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(list.rows).toEqual([
      expect.objectContaining({
        id: 22,
        status: "FAILED",
      }),
    ]);
    expect(detail).toEqual(
      expect.objectContaining({
        id: 22,
        error_message: "SMTP timeout",
      }),
    );
    expect(retried).toEqual(
      expect.objectContaining({
        id: 23,
        status: "PENDING",
      }),
    );
  });

  it("lists and updates notification channel registry items", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 11,
              channel: "EMAIL",
              code: "LEAVE_APPROVED",
              name: "Leave approved",
              module: "leave",
              isEnabled: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 11,
            channel: "EMAIL",
            code: "LEAVE_APPROVED",
            isEnabled: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 11,
            channel: "EMAIL",
            code: "LEAVE_APPROVED",
            isEnabled: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listNotificationChannelRegistry("token", {
      channel: "EMAIL",
      module: "leave",
      search: "approved",
    });
    const detail = await getNotificationChannelRegistryItem(
      "token",
      "EMAIL",
      "LEAVE_APPROVED",
    );
    const updated = await updateNotificationChannelRegistryItem(
      "token",
      "EMAIL",
      "LEAVE_APPROVED",
      {
        is_enabled: false,
        description: "Temporarily disabled",
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/channel-registry?channel=EMAIL&module=leave&search=approved",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/channel-registry/EMAIL/LEAVE_APPROVED",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/notifications/channel-registry/EMAIL/LEAVE_APPROVED",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: false,
          description: "Temporarily disabled",
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        code: "LEAVE_APPROVED",
      }),
    ]);
    expect(detail).toEqual(
      expect.objectContaining({
        code: "LEAVE_APPROVED",
      }),
    );
    expect(updated).toEqual(
      expect.objectContaining({
        isEnabled: false,
      }),
    );
  });

  it("lists, creates, fetches, and updates notification templates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 7,
              template_code: "leave.approved",
              title: "Leave approved",
              status: "ACTIVE",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 8,
            template_code: "probation.due",
            title: "Probation due",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 7,
            template_code: "leave.approved",
            title: "Leave approved",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 7,
            status: "INACTIVE",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listNotificationTemplates("token", {
      search: "leave",
      status: "ACTIVE",
    });
    await createNotificationTemplate("token", {
      template_code: "probation.due",
      title: "Probation due",
      system_message: "{{employee_name}} probation is due.",
    });
    await getNotificationTemplate("token", 7);
    await updateNotificationTemplate("token", 7, { status: "INACTIVE" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/templates?search=leave&status=ACTIVE",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/templates",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/notifications/templates/7",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/notifications/templates/7",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
    );
  });

  it("lists, creates, fetches, and updates notification rules", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 12, enabled: true }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: 13, enabled: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 12, enabled: true } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 12, enabled: false } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listNotificationRules("token", {
      notification_type: "LEAVE_APPROVAL_REQUIRED",
      enabled: true,
    });
    await createNotificationRule("token", {
      notification_type: "LEAVE_APPROVAL_REQUIRED",
      trigger_event: "leave.pending",
      recipient_type: "CURRENT_APPROVER",
      channels: ["IN_APP", "EMAIL"],
    });
    await getNotificationRule("token", 12);
    await updateNotificationRule("token", 12, { enabled: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/rules?notification_type=LEAVE_APPROVAL_REQUIRED&enabled=true",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/rules",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/notifications/rules/12",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/notifications/rules/12",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
    );
  });

  it("lists and updates platform notification channel settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 4,
              channel: "SMS",
              isEnabled: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 4,
            channel: "SMS",
            isEnabled: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listPlatformNotificationChannelSettings("token");
    const updated = await updatePlatformNotificationChannelSetting(
      "token",
      "SMS",
      {
        is_enabled: false,
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/platform/channel-settings",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/platform/channel-settings/SMS",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: false,
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        channel: "SMS",
      }),
    ]);
    expect(updated).toEqual(
      expect.objectContaining({
        channel: "SMS",
        isEnabled: false,
      }),
    );
  });

  it("lists platform mail logs, fetches detail, and retries a failed entry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              {
                id: 44,
                recipient_email: "ops@example.com",
                status: "FAILED",
              },
            ],
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 44,
            recipient_email: "ops@example.com",
            status: "FAILED",
            error_message: "Provider unavailable",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            id: 45,
            recipient_email: "ops@example.com",
            status: "PENDING",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listPlatformNotificationMailLogs("token", {
      page: 1,
      limit: 20,
      status: "FAILED",
      recipient_email: "ops@example.com",
    });
    const detail = await getPlatformNotificationMailLog("token", 44);
    const retried = await retryPlatformNotificationMailLog("token", 44);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/platform/mail-logs?page=1&limit=20&status=FAILED&recipient_email=ops%40example.com",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/platform/mail-logs/44",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/notifications/platform/mail-logs/44/retry",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(rows.rows).toEqual([
      expect.objectContaining({
        id: 44,
        status: "FAILED",
      }),
    ]);
    expect(detail).toEqual(
      expect.objectContaining({
        id: 44,
        error_message: "Provider unavailable",
      }),
    );
    expect(retried).toEqual(
      expect.objectContaining({
        id: 45,
        status: "PENDING",
      }),
    );
  });

  it("lists and updates platform notification channel registry items", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 31,
              channel: "SMS",
              code: "SYSTEM_ALERT",
              name: "System alert",
              module: "system",
              isEnabled: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 31,
            channel: "SMS",
            code: "SYSTEM_ALERT",
            isEnabled: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await listPlatformNotificationChannelRegistry("token", {
      channel: "SMS",
      module: "system",
      search: "alert",
    });
    const updated = await updatePlatformNotificationChannelRegistryItem(
      "token",
      "SMS",
      "SYSTEM_ALERT",
      {
        is_enabled: false,
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/notifications/platform/channel-registry?channel=SMS&module=system&search=alert",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/notifications/platform/channel-registry/SMS/SYSTEM_ALERT",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: false,
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        code: "SYSTEM_ALERT",
      }),
    ]);
    expect(updated).toEqual(
      expect.objectContaining({
        channel: "SMS",
        isEnabled: false,
      }),
    );
  });
});
