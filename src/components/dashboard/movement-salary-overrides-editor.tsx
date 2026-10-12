"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react";


import {
  getEmployeePayrollSalary,
  getPayrollSalaryStructure,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 dark:border-border dark:bg-background";

/** Non-negative decimal accepted by the server's @IsNumberString. */
const NUMBER_PATTERN = /^\+?(\d+(\.\d+)?|\.\d+)$/;
/** Same upper bound the server applies to structure and override rates. */
const MAX_RATE = 1000;

export type SalaryOverridePayload = {
  component_code: string;
  amount?: string;
  rate?: string;
  excluded?: boolean;
};

/** Override map as stored on compensation versions and movement changes. */
export type StoredSalaryOverrides = Record<
  string,
  { amount?: string | null; rate?: string | null; excluded?: boolean }
>;

export type SalaryOverridesState = {
  /**
   * The overrides to send, or null to leave them to the server: it keeps the
   * overrides saved on the movement (edit) or carries the employee's current
   * ones over on apply (create). Null until the user changes an override.
   */
  overrides: SalaryOverridePayload[] | null;
  /** Override edits exist but the target structure's lines are loading. */
  pending: boolean;
  /** Why the edits can't be saved, when they can't. */
  error: string | null;
};

type DraftMode = "default" | "amount" | "rate" | "exclude";
type Draft = { mode: DraftMode; value: string };

type StructureLine = {
  code: string;
  name: string;
  defaultAmount: string;
  defaultRate: string;
};

const DEFAULT_DRAFT: Draft = { mode: "default", value: "" };

function str(row: AdminRecord | null | undefined, ...keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function draftFromStored(
  stored: StoredSalaryOverrides[string] | undefined,
): Draft {
  if (!stored) return DEFAULT_DRAFT;
  if (stored.excluded) return { mode: "exclude", value: "" };
  if (stored.amount) return { mode: "amount", value: stored.amount };
  if (stored.rate) return { mode: "rate", value: stored.rate };
  return DEFAULT_DRAFT;
}

function draftsFromStored(stored: StoredSalaryOverrides | null | undefined) {
  const drafts: Record<string, Draft> = {};
  for (const [code, value] of Object.entries(stored ?? {})) {
    const draft = draftFromStored(value);
    if (draft.mode !== "default") drafts[code.toUpperCase()] = draft;
  }
  return drafts;
}

function draftError(draft: Draft) {
  if (draft.mode !== "amount" && draft.mode !== "rate") return null;
  const value = draft.value.trim();
  if (!NUMBER_PATTERN.test(value)) return "Enter a non-negative number.";
  if (draft.mode === "rate" && Number(value) > MAX_RATE) {
    return `A rate can be at most ${MAX_RATE}%.`;
  }
  return null;
}

function formatAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value;
}

/**
 * Picks the structure version in effect on a date, as the server resolves it:
 * ACTIVE versions, plus RETIRED ones when the employee keeps their current
 * structure (payroll still pays from a retired version inside its range).
 */
function pickStructureVersion(
  structures: AdminRecord[],
  code: string,
  onDate: string,
  includeRetired: boolean,
) {
  const statuses = includeRetired ? ["ACTIVE", "RETIRED"] : ["ACTIVE"];
  return structures
    .filter(
      (row) =>
        str(row, "code") === code &&
        statuses.includes(str(row, "status").toUpperCase()),
    )
    .sort(
      (left, right) =>
        str(right, "effectiveFrom", "effective_from").localeCompare(
          str(left, "effectiveFrom", "effective_from"),
        ) ||
        Number(str(right, "versionNumber", "version_number")) -
          Number(str(left, "versionNumber", "version_number")),
    )
    .find((row) => {
      const from = str(row, "effectiveFrom", "effective_from");
      const to = str(row, "effectiveTo", "effective_to");
      return !onDate || (from <= onDate && (!to || to >= onDate));
    });
}

/**
 * Edits an employee's per-component overrides for a salary revision. Starts
 * from the overrides saved on the movement (when editing) or the employee's
 * current ones. Edits live in one map keyed by component code, so they
 * survive any number of structure switches; components missing from the
 * shown structure are listed as dropped.
 */
export function MovementSalaryOverridesEditor({
  employeeId,
  targetStructureCode,
  effectiveDate,
  structures,
  initialOverrides,
  onChange,
}: {
  employeeId: string;
  targetStructureCode: string;
  effectiveDate: string;
  structures: AdminRecord[];
  /** Overrides saved on the movement being edited, for this employee. */
  initialOverrides?: StoredSalaryOverrides | null;
  /** Must be stable (useCallback); called whenever the state changes. */
  onChange: (state: SalaryOverridesState) => void;
}) {
  const [currentCode, setCurrentCode] = React.useState("");
  const [currentOverrides, setCurrentOverrides] =
    React.useState<StoredSalaryOverrides | null>(null);
  const [salaryState, setSalaryState] = React.useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [lines, setLines] = React.useState<StructureLine[] | null>(null);
  const [linesState, setLinesState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  // null until the user changes an override; then it holds every edit.
  const [edited, setEdited] = React.useState<Record<string, Draft> | null>(
    null,
  );

  React.useEffect(() => {
    setEdited(null);
    setCurrentCode("");
    setCurrentOverrides(null);
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token || !employeeId) {
      setSalaryState("idle");
      return;
    }
    let cancelled = false;
    setSalaryState("loading");
    getEmployeePayrollSalary(token, employeeId)
      .then((salary) => {
        if (cancelled) return;
        const compensation = asRecord(salary?.compensation);
        setCurrentCode(str(compensation, "salaryStructureCode"));
        setCurrentOverrides(
          (asRecord(
            compensation?.componentOverrides,
          ) as StoredSalaryOverrides | null) ?? null,
        );
        setSalaryState("ready");
      })
      .catch(() => {
        if (!cancelled) setSalaryState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const requestedCode = targetStructureCode.trim().toUpperCase();
  const resolvedCode = requestedCode || currentCode;
  const keepsCurrentCode = !requestedCode || requestedCode === currentCode;
  const structureRow = React.useMemo(
    () =>
      resolvedCode
        ? pickStructureVersion(
            structures,
            resolvedCode,
            effectiveDate,
            keepsCurrentCode,
          )
        : undefined,
    [structures, resolvedCode, effectiveDate, keepsCurrentCode],
  );
  const structureId = str(structureRow, "id");

  React.useEffect(() => {
    const token = readStoredSessionTokens().accessToken.trim();
    setLines(null);
    if (salaryState !== "ready" || !structureId || !token) {
      setLinesState("idle");
      return;
    }
    let cancelled = false;
    setLinesState("loading");
    getPayrollSalaryStructure(token, structureId)
      .then((detail) => {
        if (cancelled) return;
        const components = Array.isArray(detail?.components)
          ? (detail.components as AdminRecord[])
          : [];
        setLines(
          components
            .map((line) => ({
              code: str(line, "component_code"),
              name: str(line, "component_name") || str(line, "component_code"),
              defaultAmount: str(line, "defaultAmount", "default_amount"),
              defaultRate: str(line, "defaultRate", "default_rate"),
            }))
            .filter((line) => line.code && line.code !== "BASIC"),
        );
        setLinesState("ready");
      })
      .catch(() => {
        if (!cancelled) setLinesState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [salaryState, structureId]);

  const baseline = React.useMemo(
    () => draftsFromStored(initialOverrides ?? currentOverrides),
    [initialOverrides, currentOverrides],
  );
  const drafts = edited ?? baseline;
  const touched = edited !== null;
  const editable = salaryState === "ready" && linesState === "ready" && !!lines;
  const lineCodes = React.useMemo(
    () => new Set((lines ?? []).map((line) => line.code)),
    [lines],
  );
  const dropped = editable
    ? Object.keys(drafts).filter((code) => !lineCodes.has(code))
    : [];
  const noVersion = salaryState === "ready" && !!resolvedCode && !structureRow;

  const state = React.useMemo<SalaryOverridesState>(() => {
    if (!touched) return { overrides: null, pending: false, error: null };
    if (salaryState === "loading" || linesState === "loading") {
      return { overrides: null, pending: true, error: null };
    }
    if (!editable) {
      return {
        overrides: null,
        pending: false,
        error: noVersion
          ? `${resolvedCode} has no version effective on ${effectiveDate || "the effective date"}, so the override edits can't be saved.`
          : "The structure lines couldn't be loaded, so the override edits can't be saved.",
      };
    }
    const overrides: SalaryOverridePayload[] = [];
    let error: string | null = null;
    for (const line of lines ?? []) {
      const draft = drafts[line.code];
      if (!draft || draft.mode === "default") continue;
      if (draft.mode === "exclude") {
        overrides.push({ component_code: line.code, excluded: true });
        continue;
      }
      const message = draftError(draft);
      if (message && !error) error = `${line.name}: ${message}`;
      overrides.push({
        component_code: line.code,
        ...(draft.mode === "amount"
          ? { amount: draft.value.trim() }
          : { rate: draft.value.trim() }),
      });
    }
    return { overrides, pending: false, error };
  }, [
    touched,
    salaryState,
    linesState,
    editable,
    noVersion,
    resolvedCode,
    effectiveDate,
    lines,
    drafts,
  ]);

  React.useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  function updateDraft(code: string, next: Draft) {
    const updated = { ...drafts };
    if (next.mode === "default") delete updated[code];
    else updated[code] = next;
    setEdited(updated);
  }

  if (!employeeId) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3 text-sm md:col-span-2">
      <div>
        <p className="font-medium">Structure overrides</p>
        <p className="text-xs text-muted-foreground">
          Employee-specific amounts for {resolvedCode || "the structure"}.
          Components not overridden use the structure defaults.
        </p>
      </div>

      {salaryState === "loading" || linesState === "loading" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FluentLoadingIndicator className="size-3.5 animate-spin" />
          Loading structure lines…
        </p>
      ) : null}

      {salaryState === "unavailable" ? (
        <p className="text-xs text-muted-foreground">
          You don&apos;t have access to payroll salary details, so overrides
          can&apos;t be edited here. Overrides already saved on this movement
          are kept; otherwise the employee&apos;s current overrides carry over
          for components the new structure shares.
        </p>
      ) : null}

      {salaryState === "ready" && !resolvedCode ? (
        <p className="text-xs text-muted-foreground">
          This employee has no salary structure. Choose one above to set
          overrides.
        </p>
      ) : null}

      {noVersion ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {resolvedCode} has no {keepsCurrentCode ? "" : "active "}version
          effective on {effectiveDate || "the effective date"}.
        </p>
      ) : null}

      {linesState === "error" ? (
        <p className="text-xs text-rose-600">
          Couldn&apos;t load the lines of {resolvedCode}.
        </p>
      ) : null}

      {dropped.length > 0 ? (
        <p className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Not in {resolvedCode}, so these overrides will be dropped:{" "}
          {dropped.join(", ")}.
        </p>
      ) : null}

      {editable && lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {resolvedCode} has no lines besides BASIC.
        </p>
      ) : null}

      {editable
        ? lines.map((line) => {
            const draft = drafts[line.code] ?? DEFAULT_DRAFT;
            const needsValue = draft.mode === "amount" || draft.mode === "rate";
            const invalid = needsValue && draftError(draft) !== null;
            return (
              <div
                key={line.code}
                className="grid items-center gap-2 rounded-md bg-background px-3 py-2 md:grid-cols-[minmax(0,1fr)_150px_150px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Default{" "}
                    {line.defaultRate
                      ? `${line.defaultRate}% of base`
                      : formatAmount(line.defaultAmount || "0")}
                  </p>
                </div>
                <FluentSelect
                  ariaLabel={`${line.name} override`}
                  className="w-full"
                  value={draft.mode}
                  onChange={(value) =>
                    updateDraft(line.code, {
                      mode: value as DraftMode,
                      value: "",
                    })
                  }
                  options={[
                    { value: "default", label: "Use default" },
                    { value: "amount", label: "Fixed amount" },
                    { value: "rate", label: "% of base" },
                    { value: "exclude", label: "Exclude" },
                  ]}
                />
                <input
                  className={cn(inputClass, invalid && "border-rose-400")}
                  aria-label={`${line.name} override value`}
                  aria-invalid={invalid || undefined}
                  inputMode="decimal"
                  disabled={!needsValue}
                  placeholder={draft.mode === "rate" ? "Rate %" : "Amount"}
                  value={draft.value}
                  onChange={(event) =>
                    updateDraft(line.code, {
                      ...draft,
                      value: event.target.value,
                    })
                  }
                />
              </div>
            );
          })
        : null}
    </div>
  );
}
