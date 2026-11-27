"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, BadgeCheck, Layers, ShieldAlert, ShieldX, XCircle } from "lucide-react";

import {
  lookupLetterVerification,
  type LetterVerificationResult,
  type LetterVerificationStatus,
} from "@/lib/letter-verification";

type StatusView = {
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  ring: string;
};

const STATUS_VIEW: Record<Exclude<LetterVerificationStatus, "not_found">, StatusView> = {
  valid: {
    title: "Genuine letter",
    detail: "This letter was issued by the company through HRMS and is currently valid.",
    icon: BadgeCheck,
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    ring: "bg-emerald-600",
  },
  superseded: {
    title: "Replaced by a newer letter",
    detail: "This letter was genuine but has been replaced by a revised version. Ask the holder for the current letter.",
    icon: Layers,
    tone: "bg-amber-50 text-amber-900 border-amber-200",
    ring: "bg-amber-500",
  },
  cancelled: {
    title: "Letter cancelled",
    detail: "The company cancelled this letter. It is no longer valid.",
    icon: XCircle,
    tone: "bg-rose-50 text-rose-800 border-rose-200",
    ring: "bg-rose-600",
  },
  revoked: {
    title: "Verification revoked",
    detail: "The company withdrew this letter's verification code. This copy is no longer valid.",
    icon: ShieldX,
    tone: "bg-rose-50 text-rose-800 border-rose-200",
    ring: "bg-rose-600",
  },
};

function formatDate(value: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_rgba(48,49,148,0.12),_transparent_45%),linear-gradient(180deg,_#ffffff,_#f4f6fb)] px-4 py-8 sm:py-14">
      <div className="w-full max-w-xl">{children}</div>
    </main>
  );
}

function MessageCard({ icon: Icon, title, detail, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string; tone: string }) {
  return (
    <Shell>
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className={`mx-auto flex size-14 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">HRMS letter verification</p>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default function LetterVerificationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const [result, setResult] = React.useState<LetterVerificationResult | null>(null);

  React.useEffect(() => {
    let active = true;
    void lookupLetterVerification(token).then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (!result) {
    return (
      <Shell>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]" aria-busy="true">
          <div className="mx-auto size-14 animate-pulse rounded-full bg-slate-100" />
          <div className="mx-auto mt-4 h-5 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mx-auto mt-3 h-4 w-64 animate-pulse rounded bg-slate-100" />
          <p className="sr-only">Checking letter…</p>
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
        detail="This QR code does not match any letter in HRMS. The document may be altered or not genuine. Contact the issuing company's HR office to confirm."
      />
    );
  }
  if (result.kind === "rate_limited") {
    return <MessageCard icon={AlertTriangle} tone="bg-amber-50 text-amber-700" title="Too many checks" detail="Please wait a minute and scan the QR code again." />;
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
  const view = STATUS_VIEW[data.status as keyof typeof STATUS_VIEW] ?? STATUS_VIEW.revoked;
  const StatusIcon = view.icon;

  return (
    <Shell>
      <header className="mb-5 flex items-center gap-3">
        {data.company_logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data URL
          <img src={data.company_logo} alt={`${data.company_name} logo`} className="h-11 w-auto max-w-[9rem] object-contain" />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#303194] text-base font-semibold text-white">
            {data.company_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-950">{data.company_name}</p>
          <p className="text-xs text-slate-500">Letter verification</p>
        </div>
      </header>

      <section className={`flex items-start gap-4 rounded-3xl border p-5 sm:p-6 ${view.tone}`} aria-live="polite">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${view.ring}`}>
          <StatusIcon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">{view.title}</h1>
          <p className="mt-1 text-sm leading-6 opacity-90">{view.detail}</p>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-6">
        <h2 className="text-sm font-semibold text-slate-950">Letter details</h2>
        <dl className="mt-2 divide-y divide-slate-100">
          <Row label="Reference" value={<span className="font-mono">{data.reference_no}</span>} />
          <Row label="Letter" value={data.letter_type_label} />
          <Row label="Issued to" value={data.recipient_name} />
          {data.employee_no ? <Row label="Employee number" value={data.employee_no} /> : null}
          <Row label="Issue date" value={formatDate(data.issued_at)} />
        </dl>
      </section>

      <p className="mt-5 text-center text-xs leading-5 text-slate-500">
        Checked live against HRMS on {formatDate(data.checked_at, true)}. The letter&apos;s content is not shown here; compare
        the reference and name with the printed copy.
      </p>
    </Shell>
  );
}
