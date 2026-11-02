"use client";

import * as React from "react";
import {
  applyKpiImport,
  approveKpiImport,
  getKpiImport,
  listKpiImports,
  previewKpiImport,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { Button as FluentButton } from "@fluentui/react-components";
import { toast } from "@/components/ui/fluent-toast-store";
import {
  asRecord,
  asRecordArray,
  readNumber,
  readString,
} from "@/components/dashboard/talent-visuals";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function unwrapRecord(value: unknown): AdminRecord | null {
  const record = asRecord(value);
  return asRecord(record?.data) ?? record;
}

export function KpiImportPanel({
  canManage,
  canApprove,
  canRead,
}: {
  canManage: boolean;
  canApprove: boolean;
  canRead: boolean;
}) {
  const [batches, setBatches] = React.useState<AdminRecord[]>([]);
  const [selectedBatch, setSelectedBatch] = React.useState<AdminRecord | null>(
    null,
  );
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) return;
    try {
      setBatches(await listKpiImports(token));
    } catch {
      // Import permission is distinct from KPI setup permission; an authorized
      // viewer sees the panel when enabled, and the server remains authoritative.
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function inspectBatch(id: string | number) {
    const token = readStoredToken();
    if (!token) return;
    const batch = unwrapRecord(await getKpiImport(token, id));
    setSelectedBatch(batch);
  }

  async function upload() {
    const token = readStoredToken();
    if (!token || !file) return;
    setBusy(true);
    try {
      const result = unwrapRecord(await previewKpiImport(token, file));
      if (!result) throw new Error("Import preview returned an invalid response.");
      const id = readNumber(result, ["id"]);
      setSelectedBatch(
        id === null ? result : unwrapRecord(await getKpiImport(token, id)),
      );
      toast.success(
        `Import preview created: ${readNumber(result, ["valid_row_count"]) ?? 0} valid of ${readNumber(result, ["row_count"]) ?? 0} rows.`,
      );
      setFile(null);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not validate KPI import.",
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const template =
      "employee_no,kpi_code,period_id,source_record_id,measurement_unit,value\n";
    const url = URL.createObjectURL(
      new Blob([template], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "module-10-kpi-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function perform(action: "approve" | "apply", id: string | number) {
    const token = readStoredToken();
    if (!token) return;
    setBusy(true);
    try {
      const result = unwrapRecord(
        await (action === "approve"
          ? approveKpiImport(token, id)
          : applyKpiImport(token, id)),
      );
      setSelectedBatch(result);
      toast.success(
        action === "approve"
          ? "Import batch approved."
          : "Import batch applied.",
      );
      await inspectBatch(id);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not ${action} KPI import.`,
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedId = readNumber(selectedBatch, ["id", "batch_id"]);
  const selectedStatus = readString(selectedBatch, ["status"]);
  const rows = asRecordArray(selectedBatch?.rows);
  const fileTotals = asRecordArray(selectedBatch?.file_totals);

  return (
    <section
      className="rounded-xl border border-border bg-card p-4"
      aria-labelledby="kpi-import-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="kpi-import-title" className="text-base font-semibold">
            KPI CSV imports
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Upload a validated CSV, review row errors, then have another
            authorized user approve it before applying. Applying updates only
            configured FILE_IMPORT KPI assignments in this company.
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            employee_no,kpi_code,period_id,source_record_id,measurement_unit,value
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <FluentButton
              appearance="secondary"
              disabled={busy}
              onClick={downloadTemplate}
            >
              Download template
            </FluentButton>
            <input
              aria-label="KPI import CSV file"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) =>
                setFile(event.currentTarget.files?.[0] ?? null)
              }
              className="max-w-64 text-sm"
            />
            <FluentButton
              appearance="primary"
              disabled={!file || busy}
              onClick={() => void upload()}
            >
              {busy ? "Working…" : "Validate CSV"}
            </FluentButton>
          </div>
        ) : null}
      </div>

      {canRead && batches.length ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium">Recent batches</h3>
          {batches.map((batch) => {
            const id = readNumber(batch, ["id"]);
            return (
              <div
                key={String(id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => id !== null && void inspectBatch(id)}
                >
                  Batch {id}: {readString(batch, ["status"])} ·{" "}
                  {readNumber(batch, ["valid_row_count"]) ?? 0}/
                  {readNumber(batch, ["row_count"]) ?? 0} valid rows
                </button>
                {canApprove &&
                readString(batch, ["status"]) === "VALIDATED" &&
                id !== null ? (
                  <FluentButton
                    appearance="secondary"
                    disabled={busy}
                    onClick={() => void perform("approve", id)}
                  >
                    Approve
                  </FluentButton>
                ) : null}
                {canManage &&
                readString(batch, ["status"]) === "APPROVED" &&
                id !== null ? (
                  <FluentButton
                    appearance="primary"
                    disabled={busy}
                    onClick={() => void perform("apply", id)}
                  >
                    Apply batch
                  </FluentButton>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {canRead && selectedBatch ? (
        <div className="mt-4 rounded-lg bg-muted/40 p-3" aria-live="polite">
          <p className="text-sm font-medium">
            Batch {selectedId} · {selectedStatus}
          </p>
          {fileTotals.length ? (
            <div className="mt-2 overflow-auto">
              <p className="mb-1 text-xs text-muted-foreground">
                File totals by KPI, period, and unit. These summarize uploaded
                rows; compare them with the source system’s control totals.
              </p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="p-1">KPI</th>
                    <th className="p-1">Period</th>
                    <th className="p-1">Unit</th>
                    <th className="p-1">Rows</th>
                    <th className="p-1">File total</th>
                    <th className="p-1">Applicable total</th>
                  </tr>
                </thead>
                <tbody>
                  {fileTotals.map((total, index) => (
                    <tr
                      key={`${String(total.kpi_code)}-${String(total.period_id)}-${index}`}
                      className="border-t border-border"
                    >
                      <td className="p-1">{String(total.kpi_code ?? "")}</td>
                      <td className="p-1">{String(total.period_id ?? "")}</td>
                      <td className="p-1">
                        {String(total.measurement_unit ?? "")}
                      </td>
                      <td className="p-1">
                        {String(total.valid_row_count ?? 0)}/
                        {String(total.row_count ?? 0)}
                      </td>
                      <td className="p-1">
                        {String(total.input_total ?? "0.0000")}
                      </td>
                      <td className="p-1">
                        {String(total.applicable_total ?? "0.0000")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {rows.length ? (
            <div className="mt-2 max-h-56 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="p-1">Row</th>
                    <th className="p-1">Source record</th>
                    <th className="p-1">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const errors = Array.isArray(row.errors)
                      ? row.errors.filter(
                          (value): value is string => typeof value === "string",
                        )
                      : [];
                    return (
                      <tr
                        key={`${String(row.rowNumber)}-${index}`}
                        className="border-t border-border"
                      >
                        <td className="p-1">{String(row.rowNumber ?? "")}</td>
                        <td className="p-1">
                          {String(row.sourceRecordId ?? "")}
                        </td>
                        <td className="p-1">
                          {errors.length ? errors.join(" ") : "Valid"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
