"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reportBoundaryError } from "@/lib/error-monitoring";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const [isPending, startTransition] = useTransition();
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const resetting = useRef(false);

  useEffect(() => {
    reportBoundaryError(error, "render");
  }, [error]);

  useEffect(() => {
    if (!isPending) resetting.current = false;
  }, [isPending]);

  function retry() {
    // The ref closes the gap before React commits the disabled button state.
    if (resetting.current) return;
    resetting.current = true;
    setRecoveryFailed(false);
    startTransition(() => {
      try {
        reset();
      } catch (cause) {
        setRecoveryFailed(true);
        reportBoundaryError(
          cause instanceof Error ? cause : new Error("Dashboard recovery failed"),
          "reset",
        );
      }
    });
  }

  const reference = error.digest?.match(/^[a-zA-Z0-9_-]{1,128}$/)?.[0];

  return (
    <section
      role="alert"
      aria-labelledby="dashboard-error-title"
      className="mx-auto flex min-h-72 max-w-xl flex-col items-start justify-center gap-4 p-6"
    >
      <h2 id="dashboard-error-title" className="text-xl font-semibold">
        We couldn’t display this dashboard view
      </h2>
      <p className="text-sm text-muted-foreground">
        An unexpected error interrupted this view. Try loading it again. If the
        problem continues, contact your system administrator.
      </p>
      {reference && (
        <p className="break-all text-sm text-muted-foreground">
          Error reference: <code>{reference}</code>
        </p>
      )}
      {recoveryFailed && (
        <p className="text-sm">
          Recovery could not complete. You can try again or reload this page.
        </p>
      )}
      <button
        type="button"
        onClick={retry}
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Recovering…" : "Try again"}
      </button>
    </section>
  );
}
