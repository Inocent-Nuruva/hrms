"use client";
import { ATTENDANCE_PAGE_STACK, AttendancePageHead } from "@/components/dashboard/attendance-ops-ui";

import * as React from "react";
import {
  Badge as FluentBadge,
  Button as FluentButton,
  Field,
  Input as FluentInput,
  MessageBar,
  MessageBarBody,
  Textarea as FluentTextarea,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  CalendarLtr20Regular,
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  MailInbox20Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import {
  cancelManagedAttendanceWorkFromHomeRequest,
  cancelAttendanceWorkFromHomeRequest,
  createAttendanceWorkFromHomeRequest,
  listAttendanceWorkFromHomeRequests,
  listTeamAttendanceWorkFromHomeRequests,
  reviewAttendanceWorkFromHomeRequest,
} from "@/lib/admin-api";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { getSessionSnapshot } from "@/lib/auth-session-store";
import { readStoredSessionTokens } from "@/lib/session-client";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";

type WorkFromHomeRequest = {
  id: number;
  employee_id: number;
  employee_name?: string | null;
  start_date: string;
  end_date: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  review_comment?: string | null;
  reviewed_at?: string | null;
  approval_stage?: string | null;
  waiting_on?: string | null;
  requested_days?: number;
  used_days?: number;
  unused_days?: number;
  cancelled_at?: string | null;
};



function readRequests(value: unknown): WorkFromHomeRequest[] {
  if (Array.isArray(value)) return value as WorkFromHomeRequest[];
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.data) ? record.data : [];
  return rows as WorkFromHomeRequest[];
}

function errorMessage(error: unknown) {
  if (
    error instanceof Error &&
    /databaseName|Cannot read properties of undefined/i.test(error.message)
  ) {
    return "Work-from-home requests are temporarily unavailable. Refresh in a moment.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "The work-from-home request could not be completed.";
}

function requestStatusColor(status: WorkFromHomeRequest["status"]) {
  if (status === "APPROVED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "REJECTED") return "danger" as const;
  return "informative" as const;
}

function requestStatusLabel(request: WorkFromHomeRequest) {
  if (request.status === "CANCELLED") {
    return request.reviewed_at ? "returned to office" : "withdrawn";
  }
  return request.status.toLowerCase();
}

function inclusiveDays(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime < startTime
  )
    return 0;
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function requestUsage(request: WorkFromHomeRequest) {
  const requested =
    request.requested_days ??
    inclusiveDays(request.start_date, request.end_date);
  if (request.status !== "CANCELLED")
    return { requested, used: null, unused: null };
  const cancellationDate =
    request.cancelled_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const usedEnd =
    cancellationDate < request.end_date ? cancellationDate : request.end_date;
  const used =
    cancellationDate < request.start_date
      ? 0
      : inclusiveDays(request.start_date, usedEnd);
  return {
    requested,
    used: request.used_days ?? used,
    unused: request.unused_days ?? Math.max(requested - used, 0),
  };
}

function linkedEmployeeId() {
  try {
    const user = getSessionSnapshot().user;
    if (!user) return null;
    const employee =
      typeof user.employee === "object" && user.employee !== null
        ? (user.employee as Record<string, unknown>)
        : null;
    const value = user.employeeId ?? user.employee_id ?? employee?.id;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function AttendanceWorkFromHomeClient() {
  const actor = useDashboardActor();
  const canReadCompany = actor.permissionLabels.includes("attendance_processing:read");
  const canReview = actor.permissionLabels.includes(
    "attendance_processing:execute",
  );
  const canReviewTeam = actor.permissionLabels.some((permission) =>
    ["manager_self_service:read", "manager:read", "manager_team:read"].includes(
      permission,
    ),
  );
  const [canRequest, setCanRequest] = React.useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = React.useState<
    number | null
  >(null);
  const [token, setToken] = React.useState("");
  const [ownRequestIds, setOwnRequestIds] = React.useState<Set<number>>(new Set());
  const [reviewableTeamIds, setReviewableTeamIds] = React.useState<Set<number>>(new Set());
  const [requests, setRequests] = React.useState<WorkFromHomeRequest[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [comments, setComments] = React.useState<Record<number, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const pendingCount = requests.filter(
    (request) => request.status === "PENDING",
  ).length;
  const approvedCount = requests.filter(
    (request) => request.status === "APPROVED",
  ).length;
  const closedCount = requests.filter((request) =>
    ["REJECTED", "CANCELLED"].includes(request.status),
  ).length;

  React.useEffect(() => {
    setToken(readStoredSessionTokens().accessToken);
    const employeeId = linkedEmployeeId();
    setCurrentEmployeeId(employeeId);
    setCanRequest(actor.accessMode === "employee" || employeeId !== null);
  }, [actor.accessMode]);

  const refresh = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Sign in again to manage work-from-home requests.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const needsOwnList = canRequest && (!canReadCompany || currentEmployeeId === null);
      const [companyPayload, minePayload, teamPayload] = await Promise.all([
        canReadCompany ? listAttendanceWorkFromHomeRequests(token, false) : [],
        needsOwnList ? listAttendanceWorkFromHomeRequests(token, true) : [],
        canReviewTeam && canRequest && (!canReadCompany || !canReview)
          ? listTeamAttendanceWorkFromHomeRequests(token)
          : [],
      ]);
      const mine = readRequests(minePayload);
      const team = readRequests(teamPayload);
      setOwnRequestIds(new Set(mine.map((request) => request.id)));
      setReviewableTeamIds(new Set(team.map((request) => request.id)));
      const combined = [...readRequests(companyPayload), ...mine, ...team];
      setRequests(Array.from(new Map(combined.map((request) => [request.id, request])).values()));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canReadCompany, canRequest, canReview, canReviewTeam, currentEmployeeId, token]);

  React.useEffect(() => {
    if (actor.ready && token) void refresh();
  }, [actor.ready, refresh, token]);

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createAttendanceWorkFromHomeRequest(token, {
        start_date: startDate,
        end_date: endDate,
        reason,
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      setMessage("Request submitted for approval.");
      await refresh();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const review = async (
    request: WorkFromHomeRequest,
    decision: "APPROVE" | "REJECT",
  ) => {
    if (!token) return;
    const comment = comments[request.id]?.trim() ?? "";
    if (decision === "REJECT" && !comment) {
      setError("Add a reason before rejecting this request.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await reviewAttendanceWorkFromHomeRequest(token, request.id, {
        decision,
        comment: comment || undefined,
      });
      setMessage(
        decision === "APPROVE" ? "Request approved." : "Request rejected.",
      );
      await refresh();
    } catch (reviewError) {
      setError(errorMessage(reviewError));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (request: WorkFromHomeRequest) => {
    if (!token) return;
    const actionLabel =
      request.status === "APPROVED"
        ? "Return to the office"
        : "Withdraw this request";
    if (
      !(await fluentConfirm(
        `${actionLabel} for ${request.start_date} to ${request.end_date}?`,
      ))
    )
      return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (canReview && currentEmployeeId !== request.employee_id && !ownRequestIds.has(request.id)) {
        await cancelManagedAttendanceWorkFromHomeRequest(token, request.id);
      } else {
        await cancelAttendanceWorkFromHomeRequest(token, request.id);
      }
      setMessage(
        request.status === "APPROVED"
          ? "Return to office recorded."
          : "Request withdrawn.",
      );
      await refresh();
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={ATTENDANCE_PAGE_STACK}>
      <AttendancePageHead
        section="Attendance"
        title="Work from home"
        description="Request remote-work dates and track approval before recording attendance away from the office."
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

      {canRequest ? (
        <form
          onSubmit={submitRequest}
          className="grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_1fr_auto] sm:items-end"
        >
          <div className="sm:col-span-4">
            <h2 className="font-semibold text-foreground">
              New remote-work request
            </h2>
            <p className="text-xs text-muted-foreground">
              Approval must cover every requested date.
            </p>
          </div>
          <Field label="Start date" required>
            <DatePickerPresets
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
          </Field>
          <Field
            label="End date"
            required
            validationMessage={
              startDate && endDate && endDate < startDate
                ? "End date cannot be before the start date."
                : undefined
            }
            validationState={
              startDate && endDate && endDate < startDate ? "error" : "none"
            }
          >
            <DatePickerPresets
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
            />
          </Field>
          <Field label="Reason" required>
            <FluentTextarea
              required
              maxLength={2000}
              resize="none"
              value={reason}
              onChange={(_event, data) => setReason(data.value)}
              placeholder="Why do you need to work remotely?"
              className="min-h-8"
            />
          </Field>
          <FluentButton
            disabled={
              saving ||
              !startDate ||
              !endDate ||
              endDate < startDate ||
              !reason.trim()
            }
            type="submit"
            appearance="primary"
            icon={<Send20Regular />}
          >
            {saving ? "Submitting…" : "Submit request"}
          </FluentButton>
        </form>
      ) : null}

      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <div className="mr-auto">
            <h2 className="font-semibold text-foreground">
              {canReadCompany
                ? "Company requests"
                : canReviewTeam
                  ? "My and team requests"
                  : "My requests"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {canReadCompany
                ? "View remote-work requests across the company."
                : canReviewTeam
                  ? "Track your requests and review requests from employees who report to you."
                  : "Track your submitted requests and decisions."}
            </p>
          </div>
          <FluentBadge appearance="tint" color="warning" shape="rounded">
            {pendingCount} pending
          </FluentBadge>
          <FluentBadge appearance="tint" color="success" shape="rounded">
            {approvedCount} approved
          </FluentBadge>
          <FluentBadge appearance="tint" color="informative" shape="rounded">
            {closedCount} closed
          </FluentBadge>
          <FluentButton
            aria-label="Refresh requests"
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
        </div>
        {loading ? (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            Loading requests…
          </p>
        ) : null}
        {!loading && requests.length === 0 ? (
          <div className="flex items-center gap-3 py-8">
            <MailInbox20Regular
              className="size-6 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div>
              <p className="font-medium text-foreground">
                {canReadCompany
                  ? "No requests need review"
                  : "No remote-work requests yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {canReadCompany
                  ? "New employee requests will appear here."
                  : "Submit a request to begin the approval process."}
              </p>
            </div>
          </div>
        ) : null}
        <div className="divide-y divide-border">
          {requests.map((request) => {
            const usage = requestUsage(request);
            const isOwnRequest = currentEmployeeId === request.employee_id || ownRequestIds.has(request.id);
            return (
              <article
                key={request.id}
                className="grid min-w-0 gap-3 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <CalendarLtr20Regular
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {request.employee_name ||
                          `Employee #${request.employee_id}`}
                      </p>
                      <FluentBadge
                        appearance="tint"
                        color={requestStatusColor(request.status)}
                        shape="rounded"
                      >
                        {requestStatusLabel(request)}
                      </FluentBadge>
                    </div>
                    <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                      {request.start_date}
                      {request.end_date !== request.start_date
                        ? ` – ${request.end_date}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-foreground/80">
                      {request.reason}
                    </p>
                    {request.status === "PENDING" ? (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p className="font-semibold">Waiting for approval</p>
                        <p className="mt-0.5">
                          {request.waiting_on ||
                            request.approval_stage ||
                            "Attendance or HR reviewer"}
                        </p>
                      </div>
                    ) : null}
                    {request.review_comment ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Review note: {request.review_comment}
                      </p>
                    ) : null}
                    {request.status === "CANCELLED" ? (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          <strong className="text-foreground">
                            {usage.requested}
                          </strong>{" "}
                          requested
                        </span>
                        <span>
                          <strong className="text-foreground">
                            {usage.used}
                          </strong>{" "}
                          used
                        </span>
                        <span>
                          <strong className="text-foreground">
                            {usage.unused}
                          </strong>{" "}
                          unused
                        </span>
                        <span className="text-primary">
                          Unused dates are available for a new request.
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
                  {(canReview || reviewableTeamIds.has(request.id)) &&
                  !isOwnRequest &&
                  request.status === "PENDING" ? (
                    <>
                      <FluentInput
                        aria-label={`Review note for request ${request.id}`}
                        value={comments[request.id] ?? ""}
                        onChange={(_event, data) =>
                          setComments((current) => ({
                            ...current,
                            [request.id]: data.value,
                          }))
                        }
                        placeholder="Comment or rejection reason"
                        className="min-w-48 flex-1"
                      />
                      <FluentButton
                        type="button"
                        size="small"
                        appearance="primary"
                        icon={<CheckmarkCircle20Regular />}
                        disabled={saving}
                        onClick={() => void review(request, "APPROVE")}
                      >
                        Approve
                      </FluentButton>
                      <FluentButton
                        type="button"
                        size="small"
                        appearance="secondary"
                        icon={<DismissCircle20Regular />}
                        disabled={saving}
                        onClick={() => void review(request, "REJECT")}
                      >
                        Reject
                      </FluentButton>
                    </>
                  ) : null}
                  {(canReview || canReviewTeam) &&
                  isOwnRequest &&
                  request.status === "PENDING" ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      Your manager must review this request.
                    </span>
                  ) : null}
                  {(isOwnRequest || canReview) &&
                  (request.status === "PENDING" ||
                    request.status === "APPROVED") ? (
                    <FluentButton
                      type="button"
                      size="small"
                      appearance="subtle"
                      icon={<DismissCircle20Regular />}
                      disabled={saving}
                      onClick={() => void cancel(request)}
                    >
                      {request.status === "APPROVED"
                        ? "Return to office"
                        : "Withdraw request"}
                    </FluentButton>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
