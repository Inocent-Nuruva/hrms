"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import {
  getEmployeePayrollSalary,
  getPayrollSalaryStructure,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 dark:border-border dark:bg-background";

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

type DraftMode = "default" | "amount" | "rate" | "exclude";
type Draft = { mode: DraftMode; value: string };

type StructureLine = {
  code: string;
  name: string;
  defaultAmount: string;
  defaultRate: string;
};

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
  if (!stored) return { mode: "default", value: "" };
  if (stored.excluded) return { mode: "exclude", value: "" };
  if (stored.amount) return { mode: "amount", value: stored.amount };
  if (stored.rate) return { mode: "rate", value: stored.rate };
  return { mode: "default", value: "" };
}

function formatAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value;
}

/**
 * Picks the active version of a structure code in effect on a date, falling
 * back to the newest active version.
 */
function pickStructureVersion(
  structures: AdminRecord[],
  code: string,
  onDate: string,
) {
  const versions = structures
    .filter(
      (row) =>
        str(row, "code") === code &&
        str(row, "status").toUpperCase() === "ACTIVE",
    )
    .sort(
      (left, right) =>
        Number(str(right, "versionNumber", "version_number")) -
        Number(str(left, "versionNumber", "version_number")),
    );
  return (
    versions.find((row) => {
      const from = str(row, "effectiveFrom", "effective_from");
      const to = str(row, "effectiveTo", "effective_to");
      return (!onDate || from <= onDate) && (!to || !onDate || to >= onDate);
    }) ?? versions[0]
  );
}

/**
 * Edits an employee's per-component overrides for a salary revision. Starts
 * from the overrides saved on the movement (when editing) or the employee's
 * current ones, and carries them across a structure switch for components
 * both structures share. Reports `null` when overrides cannot be edited, in
 * which case the backend carries the current overrides over by itself.
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
  initialOverrides?: StoredSalaryOverrides | null;
  /** Must be stable (useCallback); it is called whenever the drafts change. */
  onChange: (overrides: SalaryOverridePayload[] | null, valid: boolean) => void;
}) {
  const [currentCode, setCurrentCode] = React.useState("");
  const [currentOverrides, setCurrentOverrides] =
    React.useState<StoredSalaryOverrides | null>(null);
  const [salaryState, setSalaryState] = React.useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [lines, setLines] = React.useState<StructureLine[] | null>(null);
  const [linesLoading, setLinesLoading] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [dropped, setDropped] = React.useState<string[]>([]);
  // Once the user edits, their drafts become the source carried across
  // structure switches instead of the saved overrides.
  const touchedRef = React.useRef(false);
  const draftsRef = React.useRef(drafts);
  React.useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  React.useEffect(() => {
    touchedRef.current = false;
    setDrafts({});
    setLines(null);
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

  const resolvedCode = targetStructureCode.trim().toUpperCase() || currentCode;
  const structureRow = React.useMemo(
    () =>
      resolvedCode
        ? pickStructureVersion(structures, resolvedCode, effectiveDate)
        : undefined,
    [structures, resolvedCode, effectiveDate],
  );
  const structureId = str(structureRow, "id");

  React.useEffect(() => {
    const token = readStoredSessionTokens().accessToken.trim();
    if (salaryState !== "ready" || !structureId || !token) {
      setLines(null);
      return;
    }
    let cancelled = false;
    setLinesLoading(true);
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
      })
      .catch(() => {
        if (!cancelled) setLines(null);
      })
      .finally(() => {
        if (!cancelled) setLinesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salaryState, structureId]);

  // Rebuild drafts for the target structure's lines.
  React.useEffect(() => {
    if (!lines) return;
    const source: StoredSalaryOverrides = touchedRef.current
      ? Object.fromEntries(
          Object.entries(draftsRef.current)
            .filter(([, draft]) => draft.mode !== "default")
            .map(([code, draft]) => [
              code,
              {
                excluded: draft.mode === "exclude",
                amount: draft.mode === "amount" ? draft.value : null,
                rate: draft.mode === "rate" ? draft.value : null,
              },
            ]),
        )
      : (initialOverrides ?? currentOverrides ?? {});
    const codes = new Set(lines.map((line) => line.code));
    setDrafts(
      Object.fromEntries(
        lines.map((line) => [line.code, draftFromStored(source[line.code])]),
      ),
    );
    setDropped(Object.keys(source).filter((code) => !codes.has(code)));
  }, [lines, initialOverrides, currentOverrides]);

  const editable = salaryState === "ready" && lines !== null;
  React.useEffect(() => {
    if (!editable) {
      onChange(null, true);
      return;
    }
    const payload: SalaryOverridePayload[] = [];
    let valid = true;
    for (const [code, draft] of Object.entries(drafts)) {
      if (draft.mode === "default") continue;
      if (draft.mode === "exclude") {
        payload.push({ component_code: code, excluded: true });
        continue;
      }
      const value = draft.value.trim();
      if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) {
        valid = false;
      }
      payload.push({
        component_code: code,
        ...(draft.mode === "amount" ? { amount: value } : { rate: value }),
      });
    }
    onChange(payload, valid);
  }, [editable, drafts, onChange]);

  function updateDraft(code: string, next: Draft) {
    touchedRef.current = true;
    setDrafts((current) => ({ ...current, [code]: next }));
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

      {salaryState === "loading" || linesLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          Loading structure lines…
        </p>
      ) : null}

      {salaryState === "unavailable" ? (
        <p className="text-xs text-muted-foreground">
          You don&apos;t have access to payroll salary details, so overrides
          can&apos;t be edited here. The employee&apos;s current overrides carry
          over for components the new structure shares.
        </p>
      ) : null}

      {salaryState === "ready" && !resolvedCode ? (
        <p className="text-xs text-muted-foreground">
          This employee has no salary structure. Choose one above to set
          overrides.
        </p>
      ) : null}

      {salaryState === "ready" && resolvedCode && !structureRow ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {resolvedCode} has no active version to take overrides from.
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
            const draft = drafts[line.code] ?? { mode: "default", value: "" };
            const needsValue = draft.mode === "amount" || draft.mode === "rate";
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
                <select
                  className={inputClass}
                  aria-label={`${line.name} override`}
                  value={draft.mode}
                  onChange={(event) =>
                    updateDraft(line.code, {
                      mode: event.target.value as DraftMode,
                      value: "",
                    })
                  }
                >
                  <option value="default">Use default</option>
                  <option value="amount">Fixed amount</option>
                  <option value="rate">% of base</option>
                  <option value="exclude">Exclude</option>
                </select>
                <input
                  className={cn(
                    inputClass,
                    needsValue && !draft.value.trim() && "border-rose-400",
                  )}
                  aria-label={`${line.name} override value`}
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
