"use client";
import * as React from "react";
import type { ContractDetail } from "@/lib/contracts-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";
import { missingInheritedReasons } from "./contract-workspace-inheritance";

export function canProvideInheritedReasons(
  contract: ContractDetail,
  reasons: Record<string, string>,
) {
  return missingInheritedReasons(contract).every(
    (key) =>
      !(key === "salary" && !contract.can_edit_salary) &&
      (reasons[key] ?? "").trim().length >= 3,
  );
}

export function ContractInheritedReasons({
  contract,
  reasons,
  onChange,
}: {
  contract: ContractDetail;
  reasons: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const missing = missingInheritedReasons(contract);
  if (
    contract.particulars?.mode === "live" &&
    !contract.sentAt &&
    !missing.length
  )
    return null;
  return (
    <section className="grid gap-2 rounded border border-border p-3">
      <p>{m.legacyRenewalNotice}</p>
      {missing.map((key) => {
        const restricted = key === "salary" && !contract.can_edit_salary;
        const invalid = !restricted && (reasons[key] ?? "").trim().length < 3;
        const errorId = `inherited-error-${key}`;
        return (
          <label key={key} className="grid gap-1">
            {m.inheritedReason}: {m.label(key)}
            <input
              className="rounded border border-border bg-background p-2"
              disabled={restricted}
              aria-invalid={invalid}
              aria-describedby={invalid || restricted ? errorId : undefined}
              value={reasons[key] ?? ""}
              onChange={(event) => onChange(key, event.target.value)}
            />
            {invalid || restricted ? (
              <span id={errorId} role="alert">
                {restricted ? m.salaryReasonRestricted : m.reasonRequired}
              </span>
            ) : null}
          </label>
        );
      })}
    </section>
  );
}
