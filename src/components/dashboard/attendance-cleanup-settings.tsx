"use client";

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input";
import * as React from "react";
import {
  getAttendanceCleanupSettings,
  updateAttendanceCleanupSettings,
  getAttendanceCleanupOverview,
  type AttendanceCleanupSettings,
  type AttendanceCleanupOverview,
} from "@/lib/admin-api";

const options = [
  {
    key: "recalculationJobs",
    title: "Successful recalculation jobs",
    description: "Remove completed job history from previous days.",
  },
  {
    key: "unmatchedLogs",
    title: "Unmatched attendance entries",
    description:
      "Remove previous-day entries only when a raw log remains. These entries disappear from the list and may reappear after reprocessing.",
  },
  {
    key: "expiredSignInRequests",
    title: "Expired sign-in requests",
    description: "Remove temporary single sign-on requests after expiry.",
  },
  {
    key: "notificationQueue",
    title: "Completed notification queue",
    description: "Keep entries with pending or failed deliveries.",
  },
  {
    key: "importQueue",
    title: "Completed import queue",
    description: "Keep unfinished imports and device-sync entries.",
  },
] as const;

const labels = Object.fromEntries(
  options.map((item) => [item.key, item.title]),
) as Record<string, string>;
Object.assign(labels, {
  employees: "Employees",
  dailySummaries: "Attendance daily summaries",
  leaveRequests: "Leave requests",
  notifications: "Notifications",
});
function size(value: string | number) {
  const n = Number(value);
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${(n / 1024).toFixed(1)} KB`;
}

export function AttendanceCleanupSettingsPanel({
  token,
}: {
  token: string | null;
}) {
  const [settings, setSettings] =
    React.useState<AttendanceCleanupSettings | null>(null);
  const [overview, setOverview] =
    React.useState<AttendanceCleanupOverview | null>(null);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!token) return;
    let active = true;
    getAttendanceCleanupSettings(token)
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active) setError("Could not load cleanup settings.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function refresh() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      setOverview(await getAttendanceCleanupOverview(token));
    } catch {
      setError(
        "Could not load cleanup preview and history. Check that the database migration has been applied.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!token || !settings) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setSettings(await updateAttendanceCleanupSettings(token, settings));
      setOverview(null);
      setMessage("Settings saved for your company.");
    } catch {
      setError("Could not save cleanup settings.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mb-4 rounded-xl border border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer text-base font-semibold">
        Automatic cleanup and storage
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-muted-foreground">
          Runs at 23:59 Dar es Salaam time. Missed scheduled runs are checked
          after restart. All options are controlled for this company.
        </p>
        <p className="text-xs text-muted-foreground">
          Abandoned upload-scan files are shared by the server and are managed
          separately by the system operator.
        </p>
        {settings && (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {options.map((item) => (
                <label
                  key={item.key}
                  className="flex gap-3 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    className="mt-1"
                    checked={settings[item.key]}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, [item.key]: checked })
                    }
                  />
                  <span>
                    <span className="block font-semibold">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="flex flex-wrap items-center gap-2 font-medium">
              Keep completed queue entries for{" "}
              <Input
                type="number"
                min={7}
                max={3650}
                value={String(settings.queueRetentionDays)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    queueRetentionDays: Number(e.target.value),
                  })
                }
              />{" "}
              days{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (7–3,650 days)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={
                  busy ||
                  settings.queueRetentionDays < 7 ||
                  settings.queueRetentionDays > 3650 ||
                  !Number.isInteger(settings.queueRetentionDays)
                }
                className="rounded-lg bg-primary px-3 py-2 font-semibold text-white disabled:opacity-60"
              >
                Save settings
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-60"
              >
                Preview and view history
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Preview uses the last saved retention period. Estimated row sizes
              exclude indexes and shared database overhead.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {overview && (
          <>
            <div>
              <h3 className="font-semibold">Storage and eligible records</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Estimated space for this company across selected tables and
                cleanup categories, ordered by size. Categories can overlap.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="py-2">Category</th>
                      <th>Records</th>
                      <th>Estimated size</th>
                      <th>Eligible now</th>
                      <th>Eligible size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...overview.storage]
                      .sort((a, b) => Number(b.bytes) - Number(a.bytes))
                      .map((row) => {
                        const eligible = overview.preview.find(
                          (p) => p.type === row.type,
                        );
                        return (
                          <tr key={row.type} className="border-t border-border">
                            <td className="py-2">
                              {labels[row.type] ?? row.type}
                            </td>
                            <td>{row.count}</td>
                            <td>{size(row.bytes)}</td>
                            <td>{eligible ? eligible.count : "—"}</td>
                            <td>{eligible ? size(eligible.bytes) : "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Recent cleanup runs</h3>
              {overview.history.length === 0 ? (
                <p className="mt-2 text-muted-foreground">
                  No runs recorded yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {overview.history.map((run, index) => (
                    <li
                      key={`${run.type}-${run.scheduledDate}-${index}`}
                      className="rounded-lg border border-border p-2 text-xs"
                    >
                      <span className="font-semibold">
                        {labels[run.type] ?? run.type}
                      </span>{" "}
                      ·{" "}
                      {run.status === "SUCCESS"
                        ? `Completed, ${run.deletedCount} removed`
                        : "Failed"}{" "}
                      ·{" "}
                      {new Date(run.executedAt).toLocaleString(undefined, {
                        timeZone: "Africa/Dar_es_Salaam",
                      })}{" "}
                      {run.errorMessage && (
                        <span className="block text-red-600">
                          {run.errorMessage}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
