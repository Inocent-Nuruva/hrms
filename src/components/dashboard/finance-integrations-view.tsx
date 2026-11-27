"use client";

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import * as React from "react";
import { RefreshCwIcon, UploadIcon } from "lucide-react";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/fluent-toast-store";
import { FluentSelect } from "@/components/ui/fluent-select";
import {
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import {
  downloadEmployeeFinanceMigrationTemplate,
  downloadEmployeeFinancePaymentFile,
  exportEmployeeFinanceJournal,
  getEmployeeFinanceIntegrationSettings,
  importEmployeeFinanceBankStatement,
  importEmployeeFinanceMigration,
  listEmployeeFinanceIntegrationLogs,
  listEmployeeFinanceMigrationBatches,
  postEmployeeFinanceJournal,
  previewEmployeeFinanceJournal,
  retryEmployeeFinanceIntegration,
  saveEmployeeFinanceIntegrationSettings,
  signOffEmployeeFinanceMigration,
  submitEmployeeFinancePayments,
  testEmployeeFinanceIntegration,
  type AdminRecord,
} from "@/lib/admin-api";

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function saveBlob(file: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function records(value: unknown): AdminRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is AdminRecord =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];
}

const GL_LABELS: Record<string, string> = {
  loans_receivable: "Staff loans receivable",
  bank: "Bank (loan payments)",
  interest_income: "Loan interest income",
  unearned_interest: "Unearned interest (optional)",
  fee_income: "Loan fee income",
  penalty_income: "Penalty income",
  payroll_clearing: "Payroll deductions clearing",
  final_settlement_clearing: "Final settlement clearing",
  write_off_expense: "Loan write-off expense",
  suspense: "Suspense (adjustments)",
};

function Card({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function FinanceIntegrationsView() {
  const actor = useDashboardActor();
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/finance/integrations",
      actor.permissionLabels,
      actor.accessMode,
    );
  const leaveIfForbidden = useLeaveIfForbidden();
  useForbiddenRouteGuard(canAccess);

  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const [settings, setSettings] = React.useState<AdminRecord | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [gl, setGl] = React.useState<Record<string, string>>({});
  const [templateJson, setTemplateJson] = React.useState("");
  const [mappingJson, setMappingJson] = React.useState("");
  const [erpSecret, setErpSecret] = React.useState("");
  const [bankSecret, setBankSecret] = React.useState("");
  const [logs, setLogs] = React.useState<AdminRecord[]>([]);
  const [journalRange, setJournalRange] = React.useState<Record<string, string>>({});
  const [journalPreview, setJournalPreview] = React.useState<AdminRecord | null>(null);
  const [statementResult, setStatementResult] = React.useState<AdminRecord | null>(null);
  const [batches, setBatches] = React.useState<AdminRecord[]>([]);
  const [migrationFile, setMigrationFile] = React.useState<File | null>(null);
  const [cutover, setCutover] = React.useState("");
  const [migrationResult, setMigrationResult] = React.useState<AdminRecord | null>(null);

  const load = React.useCallback(async () => {
    const accessToken = token();
    if (!accessToken) return;
    setLoading(true);
    const [settingsResult, logsResult, batchesResult] = await Promise.allSettled([
      getEmployeeFinanceIntegrationSettings(accessToken),
      listEmployeeFinanceIntegrationLogs(accessToken),
      listEmployeeFinanceMigrationBatches(accessToken),
    ]);
    if (settingsResult.status === "fulfilled") {
      const current = asRecord(settingsResult.value) ?? {};
      setSettings(current);
      setForm({
        erp_mode: readString(current, ["erp_mode"], "OFF"),
        erp_provider: readString(current, ["erp_provider"], "GENERIC_WEBHOOK"),
        erp_environment: readString(current, ["erp_environment"], "SANDBOX"),
        erp_endpoint_url: readString(current, ["erp_endpoint_url"], ""),
        erp_auth_type: readString(current, ["erp_auth_type"], "none"),
        bank_mode: readString(current, ["bank_mode"], "OFF"),
        bank_provider: readString(current, ["bank_provider"], "GENERIC_REST"),
        bank_environment: readString(current, ["bank_environment"], "SANDBOX"),
        bank_endpoint_url: readString(current, ["bank_endpoint_url"], ""),
        bank_auth_type: readString(current, ["bank_auth_type"], "none"),
        debit_account_number: readString(current, ["debit_account_number"], ""),
      });
      const mapping = asRecord(current.gl_mapping) ?? {};
      setGl(Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, String(value ?? "")])));
      setTemplateJson(JSON.stringify(current.bank_file_template ?? {}, null, 2));
      setMappingJson(JSON.stringify(current.bank_import_mapping ?? {}, null, 2));
    } else if (leaveIfForbidden(settingsResult.reason)) {
      setLoading(false);
      return;
    }
    setLogs(logsResult.status === "fulfilled" ? logsResult.value : []);
    setBatches(batchesResult.status === "fulfilled" ? batchesResult.value : []);
    setLoading(false);
  }, [leaveIfForbidden]);

  React.useEffect(() => {
    if (canAccess) void load();
  }, [canAccess, load]);

  async function run<T>(key: string, task: () => Promise<T>, success: string) {
    setBusy(key);
    try {
      const result = await task();
      if (success) toast.success(success);
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
      return null;
    } finally {
      setBusy("");
    }
  }

  function parseJson(label: string, text: string) {
    try {
      return JSON.parse(text || "{}") as AdminRecord;
    } catch {
      throw new Error(`${label} is not valid JSON.`);
    }
  }

  async function saveSettings() {
    await run(
      "save",
      async () => {
        const credentials = (raw: string) => {
          if (!raw.trim()) return undefined;
          if (raw.trim() === "CLEAR") return {};
          return parseJson("Credentials", raw) as Record<string, string>;
        };
        await saveEmployeeFinanceIntegrationSettings(token(), {
          ...form,
          erp_endpoint_url: form.erp_endpoint_url || null,
          bank_endpoint_url: form.bank_endpoint_url || null,
          erp_credentials: credentials(erpSecret),
          bank_credentials: credentials(bankSecret),
          gl_mapping: gl,
          bank_file_template: parseJson("Bank file template", templateJson),
          bank_import_mapping: parseJson("Statement mapping", mappingJson),
        });
        setErpSecret("");
        setBankSecret("");
        await load();
      },
      "Integration settings saved.",
    );
  }

  if (!canAccess) return null;

  const available = asRecord(settings?.available) ?? {};
  const unmapped = Array.isArray(settings?.unmapped_gl_roles) ? settings.unmapped_gl_roles.map(String) : [];
  const select = (key: string, options: string[]) => (
    <FluentSelect
      ariaLabel={key}
      className="w-full"
      value={form[key] ?? options[0]}
      onChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
      options={options.map((value) => ({ value, label: prettify(value) }))}
    />
  );

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bank, ERP, and loan migration</h1>
          <p className="text-sm text-muted-foreground">
            File exchange works today. Direct connections are ready but stay off until credentials are entered and tested in sandbox.
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} disabled={loading} onClick={() => void load()}>
          {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricTile label="ERP mode" value={prettify(readString(settings, ["erp_mode"], "OFF"))} />
        <MetricTile label="Bank mode" value={prettify(readString(settings, ["bank_mode"], "OFF"))} />
        <MetricTile label="Unmapped GL roles" value={unmapped.length} />
        <MetricTile
          label="Failed transmissions"
          value={logs.filter((log) => ["FAILED", "ABANDONED"].includes(readString(log, ["status"]))).length}
        />
      </div>

      <Card
        title="Connection settings"
        description="Credentials are stored encrypted and never shown again. Enter them as JSON, e.g. {&quot;token&quot;: &quot;...&quot;}; type CLEAR to remove them."
        actions={
          <>
            <button type="button" className={actionButtonClass} disabled={busy === "test-erp"} onClick={() => void run("test-erp", () => testEmployeeFinanceIntegration(token(), "erp"), "ERP connection test finished.").then(load)}>
              Test ERP
            </button>
            <button type="button" className={actionButtonClass} disabled={busy === "test-bank"} onClick={() => void run("test-bank", () => testEmployeeFinanceIntegration(token(), "bank"), "Bank connection test finished.").then(load)}>
              Test bank
            </button>
            <button type="button" className={primaryButtonClass} disabled={busy === "save"} onClick={() => void saveSettings()}>
              Save settings
            </button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3 rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">ERP / accounting</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mode">{select("erp_mode", ["OFF", "FILE", "DIRECT"])}</Field>
              <Field label="Environment">{select("erp_environment", ["SANDBOX", "LIVE"])}</Field>
              <Field label="Connector">{select("erp_provider", Array.isArray(available.erp_providers) ? available.erp_providers.map(String) : ["GENERIC_WEBHOOK"])}</Field>
              <Field label="Authentication">{select("erp_auth_type", ["none", "bearer", "api-key", "basic"])}</Field>
            </div>
            <Field label="Endpoint URL">
              <Input value={form.erp_endpoint_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, erp_endpoint_url: event.target.value }))} />
            </Field>
            <Field label={`Credentials ${settings?.erp_credentials_set ? "(set)" : "(not set)"}`}>
              <Input type="password" autoComplete="off" placeholder='{"token": "..."}' value={erpSecret} onChange={(event) => setErpSecret(event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Bank</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mode">{select("bank_mode", ["OFF", "FILE", "DIRECT"])}</Field>
              <Field label="Environment">{select("bank_environment", ["SANDBOX", "LIVE"])}</Field>
              <Field label="Connector">{select("bank_provider", Array.isArray(available.bank_providers) ? available.bank_providers.map(String) : ["GENERIC_REST"])}</Field>
              <Field label="Authentication">{select("bank_auth_type", ["none", "bearer", "api-key", "basic"])}</Field>
            </div>
            <Field label="Endpoint URL">
              <Input value={form.bank_endpoint_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, bank_endpoint_url: event.target.value }))} />
            </Field>
            <Field label="Company debit account">
              <Input value={form.debit_account_number ?? ""} onChange={(event) => setForm((current) => ({ ...current, debit_account_number: event.target.value }))} />
            </Field>
            <Field label={`Credentials ${settings?.bank_credentials_set ? "(set)" : "(not set)"}`}>
              <Input type="password" autoComplete="off" placeholder='{"token": "..."}' value={bankSecret} onChange={(event) => setBankSecret(event.target.value)} />
            </Field>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2 rounded-lg border border-border p-3 lg:col-span-1">
            <h3 className="text-sm font-semibold">General-ledger accounts</h3>
            {Object.entries(GL_LABELS).map(([role, label]) => (
              <Field key={role} label={label}>
                <Input value={gl[role] ?? ""} onChange={(event) => setGl((current) => ({ ...current, [role]: event.target.value }))} />
              </Field>
            ))}
          </div>
          <Field label="Bank transfer file layout (JSON: format CSV/XLSX, delimiter, include_header, columns[{header, field}])">
            <Textarea className="min-h-80 font-mono text-xs" value={templateJson} onChange={(event) => setTemplateJson(event.target.value)} />
            <span className="text-xs text-muted-foreground">
              Fields: {Array.isArray(available.bank_file_fields) ? available.bank_file_fields.map(String).join(", ") : ""}, literal
            </span>
          </Field>
          <Field label="Bank statement columns (JSON: reference, amount, status lists)">
            <Textarea className="min-h-80 font-mono text-xs" value={mappingJson} onChange={(event) => setMappingJson(event.target.value)} />
          </Field>
        </div>
      </Card>

      <Card
        title="Accounting journal"
        description="Balanced journal lines for loan postings. Each export marks the postings as sent, so the next export only has new ones."
        actions={
          <>
            <DateInput className="w-40" value={journalRange.date_from ?? ""} onChange={(event) => setJournalRange((current) => ({ ...current, date_from: event.target.value }))} />
            <DateInput className="w-40" value={journalRange.date_to ?? ""} onChange={(event) => setJournalRange((current) => ({ ...current, date_to: event.target.value }))} />
            <button type="button" className={actionButtonClass} onClick={async () => setJournalPreview(asRecord(await run("journal-preview", () => previewEmployeeFinanceJournal(token(), journalRange), "")))}>
              Preview
            </button>
            <button type="button" className={secondaryButtonClass} onClick={async () => {
              const file = await run("journal-export", () => exportEmployeeFinanceJournal(token(), { ...journalRange, format: "xlsx" }), "Journal exported.");
              if (file) saveBlob(file);
              await load();
            }}>
              Export journal (Excel)
            </button>
            {readString(settings, ["erp_mode"]) === "DIRECT" ? (
              <button type="button" className={primaryButtonClass} onClick={() => void run("journal-post", () => postEmployeeFinanceJournal(token(), journalRange), "Journal sent to the ERP.").then(load)}>
                Post to ERP
              </button>
            ) : null}
          </>
        }
      >
        {journalPreview ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricTile label="Journals" value={readString(journalPreview, ["journal_count"], "0")} />
            <MetricTile label="Debits" value={readString(journalPreview, ["debit_total"], "0.00")} />
            <MetricTile label="Credits" value={readString(journalPreview, ["credit_total"], "0.00")} />
            <MetricTile label="Unmapped" value={(Array.isArray(journalPreview.unmapped_roles) ? journalPreview.unmapped_roles : []).length || "none"} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {unmapped.length ? `Map these GL roles first: ${unmapped.map((role) => GL_LABELS[role] ?? role).join(", ")}.` : "Preview to see the totals before exporting."}
          </p>
        )}
      </Card>

      <Card
        title="Bank payments and statements"
        description="Download a transfer file for approved disbursements and upload it to the bank portal, then import the bank statement to confirm payments and match repayments."
        actions={
          <>
            <button type="button" className={secondaryButtonClass} onClick={async () => {
              const file = await run("payment-file", () => downloadEmployeeFinancePaymentFile(token()), "Payment file ready.");
              if (file) saveBlob(file);
              await load();
            }}>
              Download payment file
            </button>
            {readString(settings, ["bank_mode"]) === "DIRECT" ? (
              <button type="button" className={primaryButtonClass} onClick={() => void run("submit", () => submitEmployeeFinancePayments(token()), "Payments sent to the bank.").then(load)}>
                Send payments to bank
              </button>
            ) : null}
            {[true, false].map((dryRun) => (
              <label key={String(dryRun)} className={`${dryRun ? secondaryButtonClass : primaryButtonClass} cursor-pointer`}>
                <UploadIcon className="size-4" />
                {dryRun ? "Check statement" : "Import statement"}
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setStatementResult(asRecord(await run("statement", () => importEmployeeFinanceBankStatement(token(), file, dryRun), dryRun ? "Statement checked." : "Statement imported.")));
                  }}
                />
              </label>
            ))}
          </>
        }
      >
        {statementResult ? (
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(statementResult.summary ?? statementResult, null, 2)}</pre>
        ) : (
          <p className="text-sm text-muted-foreground">Check a statement first to see which rows match before importing it.</p>
        )}
      </Card>

      <Card title="Transmission log" description="Every file produced and message sent. Failed direct sends retry automatically; you can also retry now.">
        {logs.length ? (
          <div className="overflow-x-auto">
            <StandardTable className="w-full text-left text-sm">
              <StandardTableHeader className="bg-muted text-xs text-muted-foreground">
                <StandardTableRow>
                  {["When", "Channel", "Operation", "Mode", "Records", "Amount", "Status", ""].map((label) => (
                    <StandardTableHead key={label} className="px-3 py-2">{label}</StandardTableHead>
                  ))}
                </StandardTableRow>
              </StandardTableHeader>
              <StandardTableBody className="divide-y divide-border">
                {logs.map((log) => (
                  <StandardTableRow key={rowId(log)}>
                    <StandardTableCell className="px-3 py-2">{readString(log, ["createdAt", "created_at"]).slice(0, 16).replace("T", " ")}</StandardTableCell>
                    <StandardTableCell className="px-3 py-2">{readString(log, ["channel"])}</StandardTableCell>
                    <StandardTableCell className="px-3 py-2">{prettify(readString(log, ["operation"]))}</StandardTableCell>
                    <StandardTableCell className="px-3 py-2">{readString(log, ["mode"])} · {readString(log, ["environment"])}</StandardTableCell>
                    <StandardTableCell className="px-3 py-2">{readString(log, ["recordCount", "record_count"], "0")}</StandardTableCell>
                    <StandardTableCell className="px-3 py-2">{readString(log, ["totalAmount", "total_amount"], "0.00")}</StandardTableCell>
                    <StandardTableCell className="px-3 py-2">
                      <StatusChip value={readString(log, ["status"])} />
                      {readString(log, ["error"], "") ? <p className="text-xs text-rose-600">{readString(log, ["error"])}</p> : null}
                    </StandardTableCell>
                    <StandardTableCell className="px-3 py-2">
                      {["FAILED", "ABANDONED"].includes(readString(log, ["status"])) && readString(log, ["mode"]) === "DIRECT" ? (
                        <button type="button" className={actionButtonClass} onClick={() => void run(`retry-${rowId(log)}`, () => retryEmployeeFinanceIntegration(token(), rowId(log)), "Retry sent.").then(load)}>
                          Retry
                        </button>
                      ) : null}
                    </StandardTableCell>
                  </StandardTableRow>
                ))}
              </StandardTableBody>
            </StandardTable>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        )}
      </Card>

      <Card
        title="Migrate existing loans"
        description="Load loans still being repaid in the old system. Check the file first; nothing is saved until every row passes. A second person signs off the balances."
        actions={
          <button type="button" className={secondaryButtonClass} onClick={async () => {
            const file = await run("template", () => downloadEmployeeFinanceMigrationTemplate(token()), "");
            if (file) saveBlob(file);
          }}>
            Download template
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end">
          <Field label="Completed template (.xlsx or .csv)">
            <FileDropzone accept=".xlsx,.csv" file={migrationFile} onFileChange={setMigrationFile} />
          </Field>
          <Field label="Cut-over date">
            <DateInput value={cutover} onChange={(event) => setCutover(event.target.value)} />
          </Field>
          <button type="button" className={secondaryButtonClass} disabled={!migrationFile || Boolean(busy)} onClick={async () => {
            if (!migrationFile) return;
            setMigrationResult(asRecord(await run("migrate-check", () => importEmployeeFinanceMigration(token(), migrationFile, { dryRun: true, cutoverDate: cutover }), "File checked.")));
          }}>
            Check file
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={!migrationFile || Boolean(busy) || !migrationResult || Number(asRecord(migrationResult.totals)?.error_count ?? 1) > 0}
            onClick={async () => {
              if (!migrationFile) return;
              const result = asRecord(await run("migrate", () => importEmployeeFinanceMigration(token(), migrationFile, { dryRun: false, cutoverDate: cutover }), "Loans migrated."));
              setMigrationResult(result);
              await load();
            }}
          >
            Import loans
          </button>
        </div>
        {migrationResult ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              {Object.entries(asRecord(migrationResult.totals) ?? {}).slice(0, 8).map(([key, value]) => (
                <MetricTile key={key} label={prettify(key)} value={String(value ?? "")} />
              ))}
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-border">
              <StandardTable className="w-full text-left text-xs">
                <StandardTableHeader className="sticky top-0 bg-muted text-muted-foreground">
                  <StandardTableRow>
                    {["Row", "Reference", "Employee", "Outstanding", "First due", "Problems"].map((label) => (
                      <StandardTableHead key={label} className="px-2 py-1.5">{label}</StandardTableHead>
                    ))}
                  </StandardTableRow>
                </StandardTableHeader>
                <StandardTableBody className="divide-y divide-border">
                  {records(migrationResult.rows).map((row) => {
                    const errors = Array.isArray(row.errors) ? row.errors.map(String) : [];
                    const warnings = Array.isArray(row.warnings) ? row.warnings.map(String) : [];
                    return (
                      <StandardTableRow key={readString(row, ["row_number"])}>
                        <StandardTableCell className="px-2 py-1.5">{readString(row, ["row_number"])}</StandardTableCell>
                        <StandardTableCell className="px-2 py-1.5">{readString(row, ["loan_reference"])}</StandardTableCell>
                        <StandardTableCell className="px-2 py-1.5">{readString(row, ["employee_no"])}</StandardTableCell>
                        <StandardTableCell className="px-2 py-1.5">{readString(row, ["outstanding_total"], "—")}</StandardTableCell>
                        <StandardTableCell className="px-2 py-1.5">{readString(row, ["first_due_date"], "—")}</StandardTableCell>
                        <StandardTableCell className="px-2 py-1.5">
                          {errors.map((item) => <p key={item} className="text-rose-600">{item}</p>)}
                          {warnings.map((item) => <p key={item} className="text-amber-700">{item}</p>)}
                          {!errors.length && !warnings.length ? <span className="text-emerald-700">OK</span> : null}
                        </StandardTableCell>
                      </StandardTableRow>
                    );
                  })}
                </StandardTableBody>
              </StandardTable>
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Migration batches</h3>
          {batches.length ? (
            <ul className="divide-y divide-border text-sm">
              {batches.map((batch) => {
                const summary = asRecord(batch.summary) ?? {};
                const id = readString(batch, ["batch_id"]);
                return (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {id} · {readString(summary, ["loan_count"], "0")} loans · {readString(summary, ["outstanding_total"], "0.00")} outstanding · cut-over {readString(summary, ["cutover_date"], "")}
                    </span>
                    {readString(batch, ["signed_off_at"], "") ? (
                      <StatusChip value="SIGNED_OFF" />
                    ) : (
                      <button type="button" className={actionButtonClass} onClick={() => void run(`signoff-${id}`, () => signOffEmployeeFinanceMigration(token(), id, "Balances agree with the old system"), "Batch signed off.").then(load)}>
                        Sign off balances
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No loans migrated yet.</p>
          )}
        </div>
      </Card>
    </section>
  );
}
