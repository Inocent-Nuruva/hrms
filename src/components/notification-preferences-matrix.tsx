"use client";

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react";
import { ArrowClockwise20Regular as Refresh } from "@fluentui/react-icons";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  listMyNotificationPreferences,
  setMyNotificationPreference,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationPreferenceType,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";

const CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "SMS", "PUSH"];
const GROUPS: Array<{ title: string; types: NotificationPreferenceType[] }> = [
  { title: "KPI & Performance", types: ["KPI_PERIOD_CREATED", "KPI_ASSIGNED"] },
  {
    title: "General",
    types: ["GENERAL", "AUTH_SECURITY", "ACCESS_CHANGE", "SYSTEM_ALERT"],
  },
  {
    title: "Leave",
    types: [
      "LEAVE_SUBMITTED",
      "LEAVE_APPROVAL_REQUIRED",
      "LEAVE_APPROVED",
      "LEAVE_REJECTED",
      "LEAVE_RETURNED_FOR_CORRECTION",
      "LEAVE_CANCELLED",
    ],
  },
  {
    title: "Onboarding",
    types: [
      "ONBOARDING_SUBMITTED",
      "ONBOARDING_APPROVAL_REQUIRED",
      "ONBOARDING_APPROVED",
      "ONBOARDING_REJECTED",
      "ONBOARDING_TASK_ASSIGNED",
      "ONBOARDING_TASK_OVERDUE",
      "ONBOARDING_APPROVAL_REMINDER",
      "ONBOARDING_COMPLETED",
      "ONBOARDING_CANCELLED",
    ],
  },
  {
    title: "Offboarding",
    types: [
      "OFFBOARDING_SUBMITTED",
      "OFFBOARDING_APPROVAL_REQUIRED",
      "OFFBOARDING_APPROVED",
      "OFFBOARDING_TASK_ASSIGNED",
      "OFFBOARDING_TASK_OVERDUE",
      "OFFBOARDING_APPROVAL_REMINDER",
      "OFFBOARDING_CLEARANCE_REQUIRED",
      "OFFBOARDING_CLEARANCE_OVERDUE",
      "OFFBOARDING_ASSET_OVERDUE",
      "OFFBOARDING_SETTLEMENT_OVERDUE",
      "OFFBOARDING_COMPLETED",
    ],
  },
  { title: "Attendance", types: ["ATTENDANCE_CORRECTION"] },
];

function label(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function key(type: NotificationPreferenceType, channel: NotificationChannel) {
  return `${type}:${channel}`;
}

function preferenceType(preference: NotificationPreference) {
  return (
    preference.notification_type ?? preference.notificationType
  )?.toUpperCase() as NotificationPreferenceType | undefined;
}

function enabled(preference?: NotificationPreference) {
  if (!preference) return true;
  return preference.is_enabled ?? preference.isEnabled ?? false;
}

export function NotificationPreferencesMatrix() {
  const [preferences, setPreferences] = React.useState<
    NotificationPreference[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setPreferences(await listMyNotificationPreferences(token));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load notification preferences.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => void load(), [load]);

  const byKey = React.useMemo(() => {
    const map = new Map<string, NotificationPreference>();
    preferences.forEach((preference) => {
      const type = preferenceType(preference);
      const channel = preference.channel?.toUpperCase() as
        NotificationChannel | undefined;
      if (type && channel) map.set(key(type, channel), preference);
    });
    return map;
  }, [preferences]);

  const groups = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return GROUPS;
    return GROUPS.map((group) => ({
      ...group,
      types: group.types.filter((type) =>
        `${label(type)} ${type}`.toLowerCase().includes(query),
      ),
    })).filter((group) => group.types.length > 0);
  }, [search]);

  async function toggle(
    type: NotificationPreferenceType,
    channel: NotificationChannel,
    isEnabled: boolean,
  ) {
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token) return;
    const preferenceKey = key(type, channel);
    setBusyKey(preferenceKey);
    setError(null);
    try {
      const updated = await setMyNotificationPreference(token, {
        notification_type: type,
        channel,
        is_enabled: isEnabled,
      });
      if (!updated) {
        await load();
        return;
      }
      setPreferences((current) => [
        ...current.filter(
          (item) =>
            key(
              preferenceType(item) ?? "GENERAL",
              item.channel as NotificationChannel,
            ) !== preferenceKey,
        ),
        updated,
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update notification preference.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notification types"
          aria-label="Search notification types"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh notification preferences"
        >
          {loading ? (
            <FluentLoadingIndicator className="size-4 animate-spin" />
          ) : (
            <Refresh className="size-4" />
          )}
        </Button>
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <FluentLoadingIndicator className="size-4 animate-spin" />
          Loading notification preferences…
        </div>
      ) : null}
      {!loading &&
        groups.map((group) => (
          <section key={group.title} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{group.title}</h4>
              <span className="text-xs text-muted-foreground">
                {group.types.length} types
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <StandardTable className="min-w-[42rem] w-full text-sm">
                <StandardTableHeader className="bg-muted/30">
                  <StandardTableRow>
                    <StandardTableHead className="px-3 py-2 text-left font-medium">
                      Notification
                    </StandardTableHead>
                    {CHANNELS.map((channel) => (
                      <StandardTableHead
                        key={channel}
                        className="px-3 py-2 text-center font-medium"
                      >
                        {label(channel)}
                      </StandardTableHead>
                    ))}
                  </StandardTableRow>
                </StandardTableHeader>
                <StandardTableBody>
                  {group.types.map((type) => (
                    <StandardTableRow key={type} className="border-t">
                      <StandardTableCell className="px-3 py-3">
                        <p className="font-medium">{label(type)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {type}
                        </p>
                      </StandardTableCell>
                      {CHANNELS.map((channel) => {
                        const preference = byKey.get(key(type, channel));
                        const busy = busyKey === key(type, channel);
                        return (
                          <StandardTableCell key={channel} className="px-3 py-3">
                            <div className="flex justify-center">
                              <Switch
                                checked={preference ? enabled(preference) : type !== "KPI_PERIOD_CREATED" || (channel === "IN_APP" && !CHANNELS.some((candidate) => enabled(byKey.get(key(type, candidate))) && byKey.has(key(type, candidate))))}
                                disabled={busy}
                                aria-label={`${label(type)} ${label(channel)}`}
                                onChange={(_event, data) =>
                                  void toggle(type, channel, data.checked)
                                }
                              />
                            </div>
                          </StandardTableCell>
                        );
                      })}
                    </StandardTableRow>
                  ))}
                </StandardTableBody>
              </StandardTable>
            </div>
          </section>
        ))}
      {!loading && groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No notification types match your search.
        </p>
      ) : null}
    </div>
  );
}
