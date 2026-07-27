"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(48,49,148,0.14),_transparent_42%),linear-gradient(180deg,_#ffffff,_#f6f7fb)] px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Offline
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          You&apos;re currently offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          HRMS is still installed, but this page needs a network connection to load fresh
          data. Reconnect and try again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#303194] px-5 text-sm font-semibold text-white no-underline transition hover:brightness-95"
          >
            Go to sign in
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      </div>
    </main>
  );
}
