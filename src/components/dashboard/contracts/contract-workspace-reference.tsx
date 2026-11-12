"use client";
import * as React from "react";
import {
  listBranches,
  listDepartments,
  listEmployeeGrades,
  listEmployees,
  listPositions,
  type AdminRecord,
} from "@/lib/admin-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";

export function ContractReferencePicker({
  token,
  referenceKey,
  label,
  value,
  automaticId,
  automaticLabel,
  reason,
  onChange,
  onReason,
  disabled = false,
}: {
  token: string;
  referenceKey: string;
  label: string;
  value: number | null;
  automaticId: number | null;
  automaticLabel: string | null;
  reason: string;
  onChange: (id: number | null) => void;
  onReason: (reason: string) => void;
  disabled?: boolean;
}) {
  const reasonErrorId = React.useId();
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = { search: query, limit: 100 } as never;
      const request =
        referenceKey === "department_id"
          ? listDepartments(token, params).then((r) => r.rows)
          : referenceKey === "position_id"
            ? listPositions(token, params).then((r) => r.rows)
            : referenceKey === "branch_id"
              ? listBranches(token, params).then((r) => r.rows)
              : referenceKey === "grade_id"
                ? listEmployeeGrades(token)
                : listEmployees(token, params).then((r) => r.rows);
      request
        .then((items) => {
          if (!cancelled) {
            setRows(items);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, referenceKey, token]);
  const name = (row: AdminRecord) =>
    String(
      row.name ||
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        row.id,
    );
  const selected = rows.find((row) => Number(row.id) === value);
  return (
    <div className="grid gap-2">
      {disabled ? <span>{m.resetLegacyFirst}</span> : null}
      <label className="grid gap-1">
        {m.search} {label}
        <input
          disabled={disabled}
          className="rounded border border-border bg-background p-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error ? <span role="alert">{m.referenceLoadError}</span> : null}
      <select
        disabled={disabled}
        aria-label={label}
        className="rounded border border-border bg-background p-2"
        value={value === null ? "" : String(value)}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">{m.useAutomatic}</option>
        {value !== null && !selected ? (
          <option value={value}>
            {m.selectedReference} #{value}
          </option>
        ) : null}
        {rows
          .filter((row) =>
            name(row).toLowerCase().includes(query.toLowerCase()),
          )
          .map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {name(row)}
              {Number(row.id) === automaticId ? ` (${m.automatic})` : ""}
            </option>
          ))}
      </select>
      {value !== null ? (
        <>
          <span>
            {m.automatic}: {automaticLabel || m.empty} → {m.selectedReference}:{" "}
            {selected ? name(selected) : `#${value}`}
          </span>
          <label className="grid gap-1">
            {m.reason}
            <input
              disabled={disabled}
              className="rounded border border-border bg-background p-2"
              value={reason}
              aria-invalid={reason.trim().length < 3}
              aria-describedby={
                reason.trim().length < 3 ? reasonErrorId : undefined
              }
              onChange={(event) => onReason(event.target.value)}
            />
          </label>
          {reason.trim().length < 3 ? (
            <span id={reasonErrorId} role="alert">
              {m.reasonRequired}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
