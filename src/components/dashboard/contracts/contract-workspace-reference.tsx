"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  listBranches,
  listDepartments,
  listEmployeeGrades,
  listEmployees,
  listPositions,
  type AdminRecord,
} from "@/lib/admin-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";

/** References chosen from a plain dropdown, without a search box. */
const DROPDOWN_ONLY = new Set(["branch_id", "department_id", "position_id", "grade_id"]);

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
  departmentId = null,
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
  /** For job titles: only list positions of this department. */
  departmentId?: number | null;
}) {
  const reasonErrorId = React.useId();
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = (DROPDOWN_ONLY.has(referenceKey)
        ? {
            limit: 500,
            ...(referenceKey === "position_id" && departmentId
              ? { department_id: departmentId }
              : {}),
          }
        : { search: query, limit: 100 }) as never;
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
  }, [query, referenceKey, token, departmentId]);
  const name = (row: AdminRecord) =>
    String(
      row.name ||
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        row.id,
    );
  const selected = rows.find((row) => Number(row.id) === value);
  // Branch, department, position and grade are picked straight from the
  // dropdown; employee lists keep a search box to narrow them down.
  const searchable = !DROPDOWN_ONLY.has(referenceKey);
  return (
    <div className="grid gap-2">
      {disabled ? <span>{m.resetLegacyFirst}</span> : null}
      {searchable ? (
        <label className="grid gap-1">
          {m.search} {label}
          <Input
            disabled={disabled}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}
      {error ? <span role="alert">{m.referenceLoadError}</span> : null}
      {referenceKey === "position_id" && departmentId ? (
        <span className="text-xs text-muted-foreground">
          {rows.length
            ? "Showing job titles in the selected department."
            : "No job titles are set up for the selected department."}
        </span>
      ) : null}
      <select
        disabled={disabled}
        aria-label={label}
        className="rounded border border-border bg-background p-2"
        value={value === null ? "" : String(value)}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">
          {m.useAutomatic}
          {automaticLabel ? ` (${automaticLabel})` : ""}
        </option>
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
            <Input
              disabled={disabled}
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
