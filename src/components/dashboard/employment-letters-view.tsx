"use client";

import * as React from "react";
import { PageShell, PageShellBody, PageShellHeader } from "@/components/dashboard/page-shell";
import { toast } from "@/components/ui/fluent-toast-store";
import {
  downloadEmploymentLetter,
  generateEmploymentLetter,
  listEmploymentLetterTemplates,
  saveEmploymentLetterTemplate,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { FluentSelect } from "@/components/ui/fluent-select";

type LetterKind = "OFFER" | "APPOINTMENT";
type TemplateForm = {
  title: string;
  body: string;
  signatory_name: string;
  signatory_title: string;
};
const EMPTY: TemplateForm = {
  title: "",
  body: "",
  signatory_name: "",
  signatory_title: "",
};
const FIELDS =
  "{{company_name}}, {{employee_name}}, {{employee_number}}, {{position}}, {{department}}, {{hire_date}}, {{salary}}, {{currency}}, {{pay_frequency}}, {{issue_date}}";

export function EmploymentLettersView() {
  const [templates, setTemplates] = React.useState<AdminRecord[]>([]);
  const [kind, setKind] = React.useState<LetterKind>("OFFER");
  const [form, setForm] = React.useState<TemplateForm>(EMPTY);
  const [recordId, setRecordId] = React.useState("");
  const [generatedId, setGeneratedId] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  const token = () => readStoredSessionTokens().accessToken.trim();
  const load = React.useCallback(async () => {
    const access = token();
    if (!access) return;
    const rows = await listEmploymentLetterTemplates(access);
    setTemplates(rows);
  }, []);

  React.useEffect(() => {
    void load().catch((error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load letter templates.",
      ),
    );
  }, [load]);
  React.useEffect(() => {
    const row = templates.find(
      (item) =>
        String(item.letter_type ?? item.letterType).toUpperCase() === kind,
    );
    setForm(
      row
        ? {
            title: String(row.title ?? ""),
            body: String(row.body ?? ""),
            signatory_name: String(
              row.signatory_name ?? row.signatoryName ?? "",
            ),
            signatory_title: String(
              row.signatory_title ?? row.signatoryTitle ?? "",
            ),
          }
        : EMPTY,
    );
  }, [kind, templates]);

  async function save() {
    const access = token();
    if (!access) return;
    setBusy(true);
    try {
      await saveEmploymentLetterTemplate(access, {
        letter_type: kind,
        ...form,
      });
      await load();
      toast.success("Letter template saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the template.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const access = token();
    const id = Number(recordId);
    if (!access || !Number.isInteger(id) || id < 1) return;
    setBusy(true);
    try {
      const result = await generateEmploymentLetter(
        access,
        kind === "OFFER" ? "offer" : "appointment",
        id,
      );
      if (!result)
        throw new Error(
          "The letter was generated but no document record was returned.",
        );
      setGeneratedId(Number(result.id));
      toast.success("Letter generated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not generate the letter.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const access = token();
    if (!access || !generatedId) return;
    try {
      const blob = await downloadEmploymentLetter(access, generatedId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${kind.toLowerCase()}-letter.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download the letter.",
      );
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">
            Employment letter templates
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Available fields: {FIELDS}
          </p>
        </div>
        <FormField label="Letter type" htmlFor="letter-kind">
          <FluentSelect
            id="letter-kind"
            ariaLabel="Letter type"
            value={kind}
            onChange={(value) => setKind(value as LetterKind)}
            options={[
              { value: "OFFER", label: "Offer" },
              { value: "APPOINTMENT", label: "Appointment" },
            ]}
          />
        </FormField>
        <FormField label="Title" htmlFor="letter-title">
          <Input
            id="letter-title"
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </FormField>
        <FormField label="Letter body" htmlFor="letter-body">
          <Textarea
            id="letter-body"
            className="min-h-44"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Signatory name" htmlFor="letter-signatory-name">
            <Input
              id="letter-signatory-name"
              value={form.signatory_name}
              onChange={(event) =>
                setForm({ ...form, signatory_name: event.target.value })
              }
            />
          </FormField>
          <FormField label="Signatory title" htmlFor="letter-signatory-title">
            <Input
              id="letter-signatory-title"
              value={form.signatory_title}
              onChange={(event) =>
                setForm({ ...form, signatory_title: event.target.value })
              }
            />
          </FormField>
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save template"}
        </button>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">Generate a letter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Offer letters use a recruitment candidate ID. Appointment letters
            use an employee ID.
          </p>
        </div>
        <FormField
          label={kind === "OFFER" ? "Recruitment candidate ID" : "Employee ID"}
          htmlFor="letter-record-id"
        >
          <Input
            id="letter-record-id"
            inputMode="numeric"
            value={recordId}
            onChange={(event) => setRecordId(event.target.value)}
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !recordId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            onClick={() => void generate()}
          >
            {busy ? "Working…" : `Generate ${kind.toLowerCase()} letter`}
          </button>
          {generatedId ? (
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              onClick={() => void download()}
            >
              Download PDF
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Employees → Letters: the single home of the employment letter templates. */
export function EmploymentLettersPage() {
  return (
    <PageShell>
      <PageShellHeader
        title="Employment letters"
        description="Edit the offer and appointment letter templates used for new hires."
      />
      <PageShellBody>
        <EmploymentLettersView />
      </PageShellBody>
    </PageShell>
  );
}
