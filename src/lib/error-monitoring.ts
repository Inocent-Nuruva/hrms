"use client";

export type BoundaryErrorContext = {
  tags: { boundary: "dashboard"; phase: "render" | "reset" };
  extra: { digest?: string };
};

/** Compatible with adapters around Sentry.captureException or another SDK. */
export type ErrorReporter = (
  error: Error,
  context: BoundaryErrorContext,
) => unknown;

let reporter: ErrorReporter | undefined;
const pending: Array<{ error: Error; context: BoundaryErrorContext }> = [];
const reported = new WeakMap<Error, Set<string>>();
const MAX_PENDING = 20;

function deliver(
  target: ErrorReporter,
  error: Error,
  context: BoundaryErrorContext,
): void {
  try {
    // A failed monitoring SDK must never throw into the recovery boundary.
    void Promise.resolve(target(error, context)).catch(() => undefined);
  } catch {
    // Monitoring is best effort; recovery must remain available.
  }
}

/** Register once during the application's monitoring bootstrap; flush early errors. */
export function registerErrorReporter(target: ErrorReporter): () => void {
  reporter = target;
  for (const entry of pending.splice(0)) {
    deliver(target, entry.error, entry.context);
  }
  return () => {
    if (reporter === target) reporter = undefined;
  };
}

export function reportBoundaryError(
  error: Error & { digest?: string },
  phase: "render" | "reset",
): void {
  const phases = reported.get(error) ?? new Set<string>();
  if (phases.has(phase)) return;
  phases.add(phase);
  reported.set(error, phases);

  const context: BoundaryErrorContext = {
    tags: { boundary: "dashboard", phase },
    extra: { digest: error.digest },
  };
  if (reporter) {
    deliver(reporter, error, context);
    return;
  }
  if (pending.length === MAX_PENDING) pending.shift();
  pending.push({ error, context });
  if (process.env.NODE_ENV !== "production") {
    console.error("Dashboard boundary failure", error, context);
  }
}
