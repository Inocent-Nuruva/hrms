type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

/** Format the per-item results returned by device resource imports. */
export function formatDeviceSyncFailure(payload: unknown, label: string): string {
  const result = record(payload);
  if (!result) return `${label} failed. No details were returned.`;
  const counts = [
    ["synced", count(result.synced)],
    ["skipped", count(result.skipped)],
    ["failed", count(result.failed)],
  ].filter((entry): entry is [string, number] => typeof entry[1] === "number");
  const summary = counts.map(([name, value]) => `${value} ${name}`).join(", ");
  const items = Array.isArray(result.results) ? result.results : [];
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const entry = record(item);
    if (!entry || String(entry.status).toUpperCase() !== "FAILED") continue;
    const reason = typeof entry.reason === "string" && entry.reason.trim()
      ? entry.reason.trim().replace(/^status=(\d+)$/, "Device returned HTTP $1")
      : "No reason returned";
    const identifier = entry.template_no ?? entry.plan_no ?? entry.door_no;
    const values = groups.get(reason) ?? [];
    values.push(identifier == null ? "unknown" : String(identifier));
    groups.set(reason, values);
  }
  const details = [...groups.entries()].slice(0, 3).map(([reason, ids]) => {
    const shown = ids.slice(0, 5).join(", ");
    return `${reason} (items ${shown}${ids.length > 5 ? ` and ${ids.length - 5} more` : ""})`;
  });
  const message = typeof result.message === "string" ? result.message : "";
  return [`${label} did not fully complete${summary ? `: ${summary}` : ""}.`, ...details, details.length ? "See the device Logs tab for command details." : message].filter(Boolean).join(" ");
}

export function formatDeviceSyncJob(payload: unknown, jobId: string): {
  state: "queued" | "success" | "error";
  message: string;
} {
  const job = record(payload);
  const state = String(job?.state ?? "unknown").toLowerCase();
  const result = record(job?.result);
  const resultStatus = String(result?.status ?? "").toUpperCase();
  if (state === "failed") {
    const reason = typeof job?.failed_reason === "string" && job.failed_reason.trim() ? job.failed_reason.trim() : "No failure reason was returned.";
    return { state: "error", message: `Import job ${jobId} failed: ${reason}` };
  }
  if (state === "completed") {
    const metrics = record(result?.users) ?? record(result?.fingerprints) ?? record(result?.cards);
    const counts = metrics ? ["received", "created", "updated", "skipped", "failed"].flatMap((key) => {
      const value = count(metrics[key]);
      return value === null ? [] : [`${value} ${key}`];
    }).join(", ") : "";
    if (resultStatus === "PARTIAL" || resultStatus === "FAILED" || (count(metrics?.failed) ?? 0) > 0) {
      return { state: "error", message: `Import job ${jobId} finished ${resultStatus === "FAILED" ? "with a failure" : "with partial results"}${counts ? `: ${counts}` : ""}. Check the Logs tab for details.` };
    }
    if (resultStatus !== "SUCCESS") return { state: "error", message: `Import job ${jobId} finished without a confirmed success result. Check the Logs tab.` };
    return { state: "success", message: `Import job ${jobId} completed${counts ? `: ${counts}` : ""}.` };
  }
  const label = state === "active" ? "running" : state === "waiting" || state === "delayed" ? "waiting to run" : `in state ${state}`;
  return { state: "queued", message: `Import job ${jobId} is ${label}. Check its status again shortly.` };
}
