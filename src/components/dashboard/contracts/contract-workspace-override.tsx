"use client";
import * as React from "react";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";
import type { ContractField, ContractFieldMetadata } from "@/lib/contracts-api";

export function ContractOverrideInput({
  item,
  field,
  active,
  value,
  reason,
  onActivate,
  onReset,
  onValue,
  onReason,
  errorId,
}: {
  item: ContractFieldMetadata;
  field: ContractField | undefined;
  active: boolean;
  value: string;
  reason: string;
  onActivate: () => void;
  onReset: () => void;
  onValue: (value: string) => void;
  onReason: (reason: string) => void;
  errorId?: string;
}) {
  const reasonErrorId = React.useId();
  const currencies = (() => {
    try {
      return (
        (
          Intl as typeof Intl & {
            supportedValuesOf?: (key: string) => string[];
          }
        ).supportedValuesOf?.("currency") ?? ["TZS"]
      );
    } catch {
      return ["TZS"];
    }
  })();
  const options =
    item.key === "currency"
      ? currencies.map((code) => [code, code])
      : item.key === "pay_frequency"
        ? Object.entries(m.payFrequencies)
        : item.key === "remuneration_method"
          ? m.paymentMethods.map((label) => [label, label])
          : [];
  const className = "w-full rounded border border-border bg-background p-2";
  if (!active)
    return (
      <div className="grid gap-2">
        <span>{field?.value || m.empty}</span>
        <button
          type="button"
          className="w-fit text-primary underline"
          onClick={onActivate}
        >
          {m.overrideAction}
        </button>
      </div>
    );
  return (
    <div className="grid gap-2">
      {item.inputKind === "enum" ? (
        <select
          aria-label={m.label(item.key)}
          aria-invalid={!!errorId}
          aria-describedby={errorId}
          className={className}
          value={value}
          onChange={(event) => onValue(event.target.value)}
        >
          <option value="">{m.choose}</option>
          {value && !options.some(([option]) => option === value) ? (
            <option value={value}>{value}</option>
          ) : null}
          {options.map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </select>
      ) : item.inputKind === "longtext" ? (
        <textarea
          aria-label={m.label(item.key)}
          aria-invalid={!!errorId}
          aria-describedby={errorId}
          className={className}
          value={value}
          onChange={(event) => onValue(event.target.value)}
        />
      ) : (
        <input
          aria-label={m.label(item.key)}
          aria-invalid={!!errorId}
          aria-describedby={errorId}
          className={className}
          type={item.inputKind === "number" ? "number" : "text"}
          value={value}
          onChange={(event) => onValue(event.target.value)}
        />
      )}
      <span>
        {m.automatic}: {field?.automatic || m.empty}
      </span>
      <label className="grid gap-1">
        {m.reason}
        <input
          className={className}
          value={reason}
          aria-invalid={!!value.trim() && reason.trim().length < 3}
          aria-describedby={
            value.trim() && reason.trim().length < 3 ? reasonErrorId : undefined
          }
          onChange={(event) => onReason(event.target.value)}
        />
      </label>
      {value.trim() && reason.trim().length < 3 ? (
        <span id={reasonErrorId} role="alert">
          {m.reasonRequired}
        </span>
      ) : null}
      <button
        type="button"
        className="w-fit text-primary underline"
        onClick={onReset}
      >
        {m.reset}
      </button>
    </div>
  );
}
