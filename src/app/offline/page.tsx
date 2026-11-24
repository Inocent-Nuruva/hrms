"use client";

import { Button } from "@fluentui/react-components";
import { ArrowClockwise24Regular, CloudOff24Regular, SignOut24Regular } from "@fluentui/react-icons";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-lg border-t-4 border-primary pt-8" aria-labelledby="offline-title">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CloudOff24Regular aria-hidden="true" className="size-8" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Connection unavailable</p>
        <h1 id="offline-title" className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>
          You&apos;re offline
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          This page needs a connection to load current HRMS data. Reconnect, then try again.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button appearance="primary" icon={<ArrowClockwise24Regular />} onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button as="a" href="/login" appearance="secondary" icon={<SignOut24Regular />}>
            Go to sign in
          </Button>
        </div>
      </section>
    </main>
  );
}
