"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Clock3,
  RotateCcw,
  ShieldAlert,
  ShieldX,
  XCircle,
} from "lucide-react";

import {
  lookupLeaveVerification,
  type LeaveVerificationResult,
  type LeaveVerificationStatus,
} from "@/lib/leave-verification";

type StatusView = {
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  ring: string;
};

const STATUS_VIEW: Record<LeaveVerificationStatus, StatusView> = {
  valid: {
    title: "Verified and Approved",
    detail: "This leave request is genuine and currently approved in HRMS.",
    icon: BadgeCheck,
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    ring: "bg-emerald-600",
  },
  expired: {
    title: "Approved — leave period ended",
    detail: "This leave was genuinely approved, but its leave period is now over.",
    icon: CalendarClock,
    tone: "bg-slate-50 text-slate-800 border-slate-200",
    ring: "bg-slate-600",
  },
  pending: {
    title: "Pending approval",
    detail: "This leave request is genuine but has not been fully approved yet.",
    icon: Clock3,
    tone: "bg-amber-50 text-amber-900 border-amber-200",
    ring: "bg-amber-500",
  },
  returned: {
    title: "Returned for correction",
    detail: "This leave request was sent back to the employee and is not approved.",
    icon: RotateCcw,
    tone: "bg-violet-50 text-violet-900 border-violet-200",
    ring: "bg-violet-600",
  },
  rejected: {
    title: "Rejected",
    detail: "This leave request was rejected and is not valid.",
    icon: XCircle,
    tone: "bg-rose-50 text-rose-800 border-rose-200",
    ring: "bg-rose-600",
  },
  cancelled: {
    title: "Cancelled",
    detail: "This leave request was cancelled before approval and is not valid.",
    icon: XCircle,
    tone: "bg-slate-50 text-slate-800 border-slate-200",
    ring: "bg-slate-500",
  },
  revoked: {
    title: "Approval revoked",
    detail:
      "This leave was approved but later cancelled. The approval is no longer valid.",
    icon: ShieldX,
    tone: "bg-rose-50 text-rose-800 border-rose-200",
    ring: "bg-rose-600",
  },
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  pending_department_manager: "Pending manager approval",
  pending_hr: "Pending HR approval",
  returned_for_correction: "Returned for correction",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDays(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${text} ${n === 1 ? "day" : "days"}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_rgba(48,49,148,0.12),_transparent_45%),linear-gradient(180deg,_#ffffff,_#f4f6fb)] px-4 py-8 sm:py-14">
      <div className="w-full max-w-xl">{children}</div>
    </main>
  );
}

function MessageCard({
  icon: Icon,
  title,
  detail,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  tone: string;
}) {
  return (
    <Shell>
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className={`mx-auto flex size-14 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        HRMS leave verification
      </p>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default function LeaveVerificationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const [result, setResult] = React.useState<LeaveVerificationResult | null>(null);

  React.useEffect(() => {
    let active = true;
    void lookupLeaveVerification(token).then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (!result) {
    return (
      <Shell>
        <div
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
          aria-busy="true"
        >
          <div className="mx-auto size-14 animate-pulse rounded-full bg-slate-100" />
          <div className="mx-auto mt-4 h-5 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mx-auto mt-3 h-4 w-64 animate-pulse rounded bg-slate-100" />
          <p className="sr-only">Checking leave request…</p>
        </div>
      </Shell>
    );
  }

  if (result.kind === "not_found") {
    return (
      <MessageCard
        icon={ShieldAlert}
        tone="bg-rose-50 text-rose-700"
        title="Verification code not recognised"
        detail="This QR code does not match any leave request in HRMS. The document may be altered or not genuine. Contact the issuing company's HR office to confirm."
      />
    );
  }
  if (result.kind === "rate_limited") {
    return (
      <MessageCard
        icon={AlertTriangle}
        tone="bg-amber-50 text-amber-700"
        title="Too many checks"
        detail="Please wait a minute and scan the QR code again."
      />
    );
  }
  if (result.kind === "error") {
    return (
      <MessageCard
        icon={AlertTriangle}
        tone="bg-amber-50 text-amber-700"
        title="Could not check right now"
        detail="The verification service could not be reached. Check your connection and try again."
      />
    );
  }

  const data = result.data;
  const baseView = STATUS_VIEW[data.verification_status] ?? STATUS_VIEW.pending;
  const view: StatusView = data.code_revoked_at
    ? {
        ...baseView,
        title: "Verification code revoked",
        detail: `HR withdrew this document's verification code on ${formatDate(
          data.code_revoked_at,
        )}. This copy is no longer valid; ask the employee or HR for a current one.`,
      }
    : baseView;
  const StatusIcon = view.icon;

  return (
    <Shell>
      <header className="mb-5 flex items-center gap-3">
        {data.company.logo_data_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data URL
          <img
            src={data.company.logo_data_url}
            alt={`${data.company.name} logo`}
            className="h-11 w-auto max-w-[9rem] object-contain"
          />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#303194] text-base font-semibold text-white">
            {data.company.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-950">
            {data.company.name}
          </p>
          <p className="text-xs text-slate-500">Leave request verification</p>
        </div>
      </header>

      <section
        className={`flex items-start gap-4 rounded-3xl border p-5 sm:p-6 ${view.tone}`}
        aria-live="polite"
      >
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${view.ring}`}
        >
          <StatusIcon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">{view.title}</h1>
          <p className="mt-1 text-sm leading-6 opacity-90">{view.detail}</p>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-6">
        <h2 className="text-sm font-semibold text-slate-950">Leave details</h2>
        <dl className="mt-2 divide-y divide-slate-100">
          <Row label="Employee" value={data.employee_name} />
          <Row label="Employee number" value={data.employee_no} />
          <Row label="Department" value={data.department_name || "—"} />
          <Row
            label="Reference"
            value={<span className="font-mono">{data.leave_no}</span>}
          />
          <Row label="Leave type" value={data.leave_type_name} />
          <Row label="Start date" value={formatDate(data.start_date)} />
          <Row label="End date" value={formatDate(data.end_date)} />
          <Row label="Total days" value={formatDays(data.total_days)} />
          <Row
            label="Approval status"
            value={STATUS_LABEL[data.approval_status] ?? data.approval_status}
          />
          <Row label="Approval date" value={formatDate(data.approved_at)} />
        </dl>
      </section>

      <p className="mt-5 text-center text-xs leading-5 text-slate-500">
        Checked live against HRMS on {formatDateTime(data.checked_at)}. If a
        printed copy shows a different status, this page is correct.
      </p>
    </Shell>
  );
}
