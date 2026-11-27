"use client";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ATTENDANCE_PAGE_STACK, AttendancePageHead } from "@/components/dashboard/attendance-ops-ui";

import * as React from "react";
import { Badge as FluentBadge, Button as FluentButton, Checkbox, MessageBar, MessageBarBody } from "@fluentui/react-components"
;
import {
  ArrowClockwise20Regular,
} from "@fluentui/react-icons";
import {
  listAttendanceExemptionCandidates,
  listAttendanceExemptions,
  updateAttendanceExemptions,
  type AttendanceExemptionRow,
} from "@/lib/admin-api";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";

function readToken() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens);
    if (!raw) return "";
    const tokens = JSON.parse(raw) as {
      accessToken?: string;
      access_token?: string;
    };
    return (tokens.accessToken ?? tokens.access_token ?? "").trim();
  } catch {
    return "";
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function firstOfMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

function EmployeeRow({
  row,
  checked,
  onToggle,
  detail,
}: {
  row: AttendanceExemptionRow;
  checked: boolean;
  onToggle: () => void;
  detail: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-3 py-3">
      <Checkbox checked={checked} onChange={onToggle} />
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {row.employee_name || `Employee #${row.employee_id}`}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {row.employee_no}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </label>
  );
}

export function AttendanceExemptionsClient() {
  const actor = useDashboardActor();
  const canManage = actor.permissionLabels.includes(
    "attendance_recalculation:execute",
  );
  const [candidates, setCandidates] = React.useState<AttendanceExemptionRow[]>(
    [],
  );
  const [exempt, setExempt] = React.useState<AttendanceExemptionRow[]>([]);
  const [selectedCandidates, setSelectedCandidates] = React.useState<
    Set<number>
  >(new Set());
  const [selectedExempt, setSelectedExempt] = React.useState<Set<number>>(
    new Set(),
  );
  const [exemptFrom, setExemptFrom] = React.useState(firstOfMonth());
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [candidateRows, exemptRows] = await Promise.all([
        listAttendanceExemptionCandidates(token),
        listAttendanceExemptions(token),
      ]);
      setCandidates(candidateRows);
      setExempt(exemptRows);
      setSelectedCandidates(new Set());
      setSelectedExempt(new Set());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    id: number,
  ) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async (employeeIds: number[], from: string | null) => {
    const token = readToken();
    if (!token || employeeIds.length === 0) return;
    const confirmed = await fluentConfirm(
      from
        ? `${employeeIds.length} employee(s) will no longer be marked absent or late from ${from}. Their attendance will be recalculated from that date.`
        : `${employeeIds.length} employee(s) will be tracked again. Their attendance since the exemption date will be recalculated.`,
      {
        title: from ? "Exempt from attendance?" : "Resume attendance tracking?",
        confirmLabel: from ? "Exempt" : "Resume tracking",
      },
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateAttendanceExemptions(token, {
        employee_ids: employeeIds,
        exempt_from: from,
        reason: from ? reason.trim() || undefined : undefined,
      });
      setMessage(
        from
          ? `${employeeIds.length} employee(s) exempted. Recalculation is running in the background.`
          : `${employeeIds.length} employee(s) back on tracking. Recalculation is running in the background.`,
      );
      await refresh();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={ATTENDANCE_PAGE_STACK}>
      <AttendancePageHead
        section="Attendance operations"
        title="Exemptions"
        description="Exempt employees are never marked absent or late and receive no attendance alerts. Days they punch show as Present; other days show as Not Tracked. The exempt date must fall after the last closed payroll period."
        actions={
        <FluentButton
          aria-label="Refresh"
          title="Refresh"
          type="button"
          appearance="subtle"
          size="small"
          icon={
            <ArrowClockwise20Regular
              className={loading ? "animate-spin" : undefined}
            />
          }
          onClick={() => void refresh()}
          disabled={loading || saving}
        />
        }
      />

      {message ? (
        <MessageBar intent="success">
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      ) : null}
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-foreground">Suggested</h2>
            <p className="text-xs text-muted-foreground">
              No device assignment and no punches in the last 30 days. Review
              before exempting.
            </p>
          </div>
          <FluentBadge appearance="tint" color="warning" shape="rounded">
            {candidates.length} suggested
          </FluentBadge>
        </div>
        {canManage ? (
          <div className="grid gap-3 border-b border-border py-4 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-end">
            <FormField label="Exempt from" required>
              <DatePickerPresets
                value={exemptFrom}
                onChange={setExemptFrom}
                placeholder="Select date"
              />
            </FormField>
            <FormField label="Reason">
              <Input
                maxLength={255}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Field staff, no device at site"
              />
            </FormField>
            <FluentButton
              appearance="primary"
              disabled={saving || !exemptFrom || selectedCandidates.size === 0}
              onClick={() => void save([...selectedCandidates], exemptFrom)}
            >
              Exempt selected ({selectedCandidates.size})
            </FluentButton>
          </div>
        ) : null}
        {!loading && candidates.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No employees to suggest.
          </p>
        ) : null}
        <div className="divide-y divide-border">
          {candidates.map((row) => (
            <EmployeeRow
              key={row.employee_id}
              row={row}
              checked={selectedCandidates.has(row.employee_id)}
              onToggle={() => toggle(setSelectedCandidates, row.employee_id)}
              detail={`${row.absent_days} absent day(s) in the last 30 days`}
            />
          ))}
        </div>
      </section>

      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-foreground">Exempt employees</h2>
            <p className="text-xs text-muted-foreground">
              Resuming tracking recalculates attendance from the exemption
              date.
            </p>
          </div>
          <FluentBadge appearance="tint" color="informative" shape="rounded">
            {exempt.length} exempt
          </FluentBadge>
          {canManage ? (
            <FluentButton
              disabled={saving || selectedExempt.size === 0}
              onClick={() => void save([...selectedExempt], null)}
            >
              Resume tracking ({selectedExempt.size})
            </FluentButton>
          ) : null}
        </div>
        {!loading && exempt.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No employees are exempt.
          </p>
        ) : null}
        <div className="divide-y divide-border">
          {exempt.map((row) => (
            <EmployeeRow
              key={row.employee_id}
              row={row}
              checked={selectedExempt.has(row.employee_id)}
              onToggle={() => toggle(setSelectedExempt, row.employee_id)}
              detail={`Exempt from ${row.attendance_exempt_from ?? "—"}${row.attendance_exempt_reason ? ` · ${row.attendance_exempt_reason}` : ""}`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
