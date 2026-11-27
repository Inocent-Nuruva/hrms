"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  acknowledgeLocationPrivacyNotice,
  getCurrentLocationPrivacyNotice,
  listLocationPrivacyAcknowledgements,
  listLocationPrivacyNotices,
  publishLocationPrivacyNotice,
} from "@/lib/admin-api";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Input } from "@/components/ui/input";

type Notice = {
  id: number;
  version: number;
  title: string;
  body: string;
  approval_status: string;
  demo: boolean;
  require_acknowledgement: boolean;
  published_at: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function toNotice(value: unknown): Notice | null {
  const item = record(value);
  if (!item || typeof item.id !== "number" || typeof item.title !== "string")
    return null;
  return item as unknown as Notice;
}

export default function LocationPrivacyPage() {
  const { tokens, user } = useAuth();
  const token = tokens?.accessToken;
  const canManage = Boolean(
    user?.permissions?.includes("location_privacy:manage"),
  );
  const [current, setCurrent] = useState<{
    notice: Notice | null;
    acknowledged: boolean;
  } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<unknown[]>([]);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<
    "DEMO_APPROVED" | "COMPANY_APPROVED"
  >("DEMO_APPROVED");
  const [approvalReference, setApprovalReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    const response = record(await getCurrentLocationPrivacyNotice(token));
    setCurrent({
      notice: toNotice(response?.notice),
      acknowledged: response?.acknowledged === true,
    });
    if (canManage) {
      const records = await listLocationPrivacyNotices(token);
      const parsed = Array.isArray(records)
        ? records.map(toNotice).filter((item): item is Notice => Boolean(item))
        : [];
      setNotices(parsed);
    }
  }, [canManage, token]);

  useEffect(() => {
    void load().catch((cause: unknown) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load location notice.",
      ),
    );
  }, [load]);

  const selectedNotice = useMemo(
    () => notices.find((item) => item.id === selectedNoticeId) ?? null,
    [notices, selectedNoticeId],
  );

  async function acknowledge() {
    if (!token || !current?.notice) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await acknowledgeLocationPrivacyNotice(token, current.notice.id);
      setMessage("Acknowledgement recorded for this notice version.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not record acknowledgement.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!token) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await publishLocationPrivacyNotice(token, {
        title,
        body,
        approval_status: approvalStatus,
        ...(approvalStatus === "COMPANY_APPROVED"
          ? { approval_reference: approvalReference }
          : {}),
        require_acknowledgement: true,
      });
      setTitle("");
      setBody("");
      setApprovalReference("");
      setMessage(
        approvalStatus === "DEMO_APPROVED"
          ? "UAT demo notice published. This is not company or legal approval."
          : "Company-approved notice published.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not publish notice.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function viewAcknowledgements(noticeId: number) {
    if (!token) return;
    setSelectedNoticeId(noticeId);
    setError("");
    try {
      setAcknowledgements(
        await listLocationPrivacyAcknowledgements(token, noticeId),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load acknowledgement records.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Privacy and attendance
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Location privacy notice</h1>
        <p className="mt-2 text-sm text-slate-600">
          Location is captured only for attendance and field visit events.
          Acknowledgement confirms receipt and review; it is not legal consent
          or policy approval.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        {!current ? (
          <p className="text-sm text-slate-600">
            Loading the current company notice…
          </p>
        ) : !current.notice ? (
          <p className="text-sm text-slate-600">
            There is no active company location notice.
          </p>
        ) : (
          <>
            {current.notice.demo ? (
              <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs font-bold text-amber-900">
                UAT DEMO — NOT COMPANY OR LEGAL APPROVAL
              </p>
            ) : null}
            <h2 className="text-lg font-semibold">{current.notice.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Version {current.notice.version} ·{" "}
              {current.notice.approval_status}
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {current.notice.body}
            </p>
            {current.acknowledged ? (
              <p className="mt-4 text-sm font-medium text-green-700">
                You have acknowledged this version.
              </p>
            ) : current.notice.require_acknowledgement !== true ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void acknowledge()}
                className="mt-5 rounded-md border px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Acknowledge (optional)
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void acknowledge()}
                className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Acknowledge notice"}
              </button>
            )}
          </>
        )}
      </section>

      {canManage ? (
        <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">HR notice management</h2>
            <p className="text-sm text-slate-600">
              Demo approval is restricted to UAT. Production notices require a
              company approval reference.
            </p>
          </div>
          <FormField label="Approval mode">
            <FluentSelect
              ariaLabel="Approval mode"
              className="w-full"
              value={approvalStatus}
              onChange={(value) =>
                setApprovalStatus(value as typeof approvalStatus)
              }
              options={[
                { value: "DEMO_APPROVED", label: "UAT demo approval" },
                { value: "COMPANY_APPROVED", label: "Company approved" },
              ]}
            />
          </FormField>
          {approvalStatus === "COMPANY_APPROVED" ? (
            <FormField label="Approval reference" required>
              <Input
                value={approvalReference}
                onChange={(event) => setApprovalReference(event.target.value)}
                placeholder="Policy approval reference"
              />
            </FormField>
          ) : (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              The API accepts this mode only when APP_ENV=uat and the configured
              database name is an isolated UAT database.
            </p>
          )}
          <FormField label="Notice title" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
            />
          </FormField>
          <FormField label="Notice text" required>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={7}
              className="min-h-40"
            />
          </FormField>
          <button
            type="button"
            disabled={
              busy ||
              !title.trim() ||
              body.trim().length < 30 ||
              (approvalStatus === "COMPANY_APPROVED" &&
                !approvalReference.trim())
            }
            onClick={() => void publish()}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish new version"}
          </button>
          <div className="border-t pt-4">
            <h3 className="mb-2 font-semibold">
              Published versions and acknowledgements
            </h3>
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-2 text-sm"
              >
                <span>
                  v{notice.version} · {notice.title}{" "}
                  {notice.demo ? "(UAT demo)" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void viewAcknowledgements(notice.id)}
                  className="text-blue-700 underline"
                >
                  View acknowledgements
                </button>
              </div>
            ))}
            {selectedNotice ? (
              <div className="mt-3 rounded-md bg-slate-50 p-3">
                <p className="font-medium">
                  Acknowledgement records for v{selectedNotice.version}
                </p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(acknowledgements, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
