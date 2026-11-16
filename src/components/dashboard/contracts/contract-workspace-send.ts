import type { ContractReadiness } from "@/lib/contracts-api";

/** Re-checks persisted readiness after the save completes; the server validates again on send. */
export async function sendReadyContract(input: {
  flush: () => Promise<boolean>;
  readiness: () => Promise<ContractReadiness>;
  confirm: (readiness: ContractReadiness) => Promise<boolean>;
  send: () => Promise<unknown>;
}) {
  if (!(await input.flush())) return { outcome: "unsaved" as const };
  const readiness = await input.readiness();
  if (!readiness.ready) return { outcome: "not_ready" as const, readiness };
  if (!(await input.confirm(readiness)))
    return { outcome: "cancelled" as const, readiness };
  await input.send();
  return { outcome: "sent" as const, readiness };
}
