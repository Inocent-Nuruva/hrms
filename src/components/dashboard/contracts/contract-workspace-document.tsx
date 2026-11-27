"use client";
import * as React from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { FluentSelect } from "@/components/ui/fluent-select";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContractPdfViewer, formatDate } from "./contract-ui";
import { ContractSigningPanel } from "./contract-signing-panel";
import { SignatoriesPanel } from "./contract-page-panels";
import { useContractDialogs } from "./contract-dialogs";
import { readStatusFieldErrors } from "@/lib/admin-api";
import {
  attachContractPdf,
  cancelContract,
  deleteContractDraft,
  fetchContractFile,
  fileToBase64,
  getContract,
  renewContract,
  duplicateContract,
  errorMessage,
  listSignatories,
  reassignContractSignatory,
  saveBlob,
  verifyContractUpload,
  type ContractDetail,
  type ContractRow,
  type Signatory,
} from "@/lib/contracts-api";
import { loadContractVersions } from "./contract-workspace-version-data";
import { missingInheritedReasons } from "./contract-workspace-inheritance";
import {
  canProvideInheritedReasons,
  ContractInheritedReasons,
} from "./contract-inherited-reasons";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";

export function ContractWorkspaceFileAction({
  token,
  contract,
  beforeAction,
  variant = "buttons",
}: {
  token: string;
  contract: ContractDetail;
  beforeAction?: () => Promise<boolean>;
  variant?: "buttons" | "menu";
}) {
  const menu = variant === "menu";
  const itemClass = menu
    ? "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
    : "rounded border border-border px-3 py-2";
  const input = React.useRef<HTMLInputElement | null>(null);
  const { confirm, askReason, dialog } = useContractDialogs();
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const canReplace = [
    "PENDING_HR_SIGNATURE",
    "PENDING_EMPLOYEE_SIGNATURE",
    "ISSUED",
  ].includes(contract.status);
  const upload = async (file?: File) => {
    if (!file) return;
    if (beforeAction && !(await beforeAction())) return;
    if (
      !(await confirm({
        title: contract.status === "DRAFT" ? m.useExternal : m.replacePdf,
        message:
          contract.status === "DRAFT" ? m.externalConfirm : m.replaceConfirm,
      }))
    )
      return;
    try {
      const result = await attachContractPdf(
        token,
        contract.id,
        await fileToBase64(file),
      );
      window.location.assign(
        `/dashboard/employees/contracts/${String(result.contract_id ?? contract.id)}`,
      );
    } catch {
      setError(m.uploadFailed);
    }
  };
  const cancel = async () => {
    const reason = await askReason({
      title: m.cancelContract,
      message: m.cancelReason,
      confirmLabel: m.cancelContract,
      tone: "danger",
    });
    if (!reason) return;
    try {
      await cancelContract(token, contract.id, reason);
      window.location.reload();
    } catch {
      setError(m.cancelFailed);
    }
  };
  const deleteDraft = async () => {
    if (!(await confirm({ title: "Delete draft contract?", message: "This permanently deletes this draft and its associated files and history. This cannot be undone.", confirmLabel: "Delete draft", tone: "danger" }))) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteContractDraft(token, contract.id);
      window.location.assign("/dashboard/employees/contracts");
    } catch (cause) {
      setError(errorMessage(cause, "Could not delete the draft. Please try again."));
      setDeleting(false);
    }
  };
  if (!contract.canManage) return null;
  return (
    <div className={menu ? "grid gap-0.5" : "flex flex-wrap gap-2"}>
      {dialog}
      {contract.status === "DRAFT" || canReplace ? (
        <>
          <button
            type="button"
            role={menu ? "menuitem" : undefined}
            className={itemClass}
            onClick={() => input.current?.click()}
          >
            {contract.status === "DRAFT" ? m.useExternal : m.replacePdf}
          </button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void upload(file);
            }}
          />
        </>
      ) : null}
      {[
        "DRAFT",
        "PENDING_HR_SIGNATURE",
        "PENDING_EMPLOYEE_SIGNATURE",
        "PENDING_VERIFICATION",
        "ISSUED",
      ].includes(contract.status) ? (
        <button
          type="button"
          role={menu ? "menuitem" : undefined}
          className={menu ? `${itemClass} text-destructive` : itemClass}
          onClick={() => void cancel()}
        >
          {m.cancelContract}
        </button>
      ) : null}
      {contract.status === "DRAFT" ? (
        <button type="button" role={menu ? "menuitem" : undefined} className={menu ? `${itemClass} text-destructive` : `${itemClass} text-destructive`} disabled={deleting} onClick={() => void deleteDraft()}>
          {deleting ? "Deleting…" : "Delete draft"}
        </button>
      ) : null}
      {error ? (
        <span role="alert" className={menu ? "px-3 py-1 text-xs text-destructive" : undefined}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ContractWorkspaceDocument({
  token,
  contract,
}: {
  token: string;
  contract: ContractDetail;
}) {
  const { confirm, dialog } = useContractDialogs();
  const [opened, setOpened] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [renewKind, setRenewKind] = React.useState<"RENEWAL" | "AMENDMENT">(
    "RENEWAL",
  );
  const [renewReason, setRenewReason] = React.useState("");
  const [renewEnd, setRenewEnd] = React.useState("");
  const [renewStart, setRenewStart] = React.useState("");
  const [inheritedReasons, setInheritedReasons] = React.useState<
    Record<string, string>
  >({});
  const [renewBusy, setRenewBusy] = React.useState(false);
  const [duplicateBusy, setDuplicateBusy] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [movementId, setMovementId] = React.useState<number | null>(null);
  const [signatories, setSignatories] = React.useState<Signatory[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [previous, setPrevious] = React.useState<
    ContractDetail | null | undefined
  >(undefined);
  const [compared, setCompared] = React.useState<ContractDetail>(contract);
  const [versions, setVersions] = React.useState<ContractRow[]>([]);
  const [leftId, setLeftId] = React.useState("");
  const [rightId, setRightId] = React.useState(String(contract.id));
  const party = contract.signing.my_party;
  const missingReasons = missingInheritedReasons(contract);
  const canSupplyReasons = canProvideInheritedReasons(
    contract,
    inheritedReasons,
  );
  React.useEffect(() => {
    if (!contract.canManage || contract.status !== "PENDING_HR_SIGNATURE")
      return;
    let cancelled = false;
    void listSignatories(token)
      .then((rows) => {
        if (!cancelled) setSignatories(rows);
      })
      .catch(() => {
        if (!cancelled) setError(m.reassignFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [token, contract.canManage, contract.status]);
  React.useEffect(() => {
    let cancelled = false;
    void loadContractVersions(token, contract.employeeId)
      .then((rows) => {
        if (cancelled) return;
        const ordered = [...rows].sort((a, b) => b.version - a.version);
        setVersions(ordered);
        setLeftId(
          String(
            ordered.find((row) => row.version < contract.version)?.id ?? "",
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setError(m.compareUnavailable);
      });
    return () => {
      cancelled = true;
    };
  }, [token, contract.employeeId, contract.version]);
  React.useEffect(() => {
    const id =
      Number(
        new URLSearchParams(window.location.search).get("amend_movement"),
      ) || null;
    if (id) {
      setMovementId(id);
      setRenewKind("AMENDMENT");
      setRenewStart(contract.startDate ?? "");
      setRenewEnd(contract.endDate ?? "");
      setRenewReason(m.movementApplied);
    }
  }, [contract.startDate, contract.endDate]);
  const renew = async () => {
    setRenewBusy(true);
    setFieldErrors({});
    try {
      const next = await renewContract(token, contract.id, {
        kind: renewKind,
        reason: renewReason.trim(),
        ...(renewStart ? { start_date: renewStart } : {}),
        ...(renewEnd ? { end_date: renewEnd } : renewKind === "AMENDMENT" ? { end_date: null } : {}),
        ...(movementId ? { source_movement_id: movementId } : {}),
        ...(missingReasons.length
          ? {
              override_reasons: Object.fromEntries(
                missingReasons.map((key) => [
                  key,
                  inheritedReasons[key].trim(),
                ]),
              ),
            }
          : {}),
      });
      window.location.assign(`/dashboard/employees/contracts/${next.id}`);
    } catch (cause) {
      setError(errorMessage(cause, m.renewalError));
      setFieldErrors(readStatusFieldErrors(cause));
    } finally {
      setRenewBusy(false);
    }
  };
  const duplicate = async () => {
    if (
      !(await confirm({
        title: m.duplicateDraft,
        message: m.duplicateConfirm,
        confirmLabel: m.createDraft,
      }))
    )
      return;
    setDuplicateBusy(true);
    setFieldErrors({});
    try {
      const next = await duplicateContract(
        token,
        contract,
        Object.fromEntries(
          missingReasons.map((key) => [key, inheritedReasons[key].trim()]),
        ),
      );
      window.location.assign(`/dashboard/employees/contracts/${next.id}`);
    } catch (cause) {
      setError(errorMessage(cause, m.duplicateFailed));
      setFieldErrors(readStatusFieldErrors(cause));
    } finally {
      setDuplicateBusy(false);
    }
  };
  const download = async (id?: number | null) => {
    try {
      const file = await fetchContractFile(token, contract.id, id);
      saveBlob(file.blob, file.fileName);
    } catch (cause) {
      setError(
        (cause as { payload?: { code?: string } }).payload?.code ===
          "CONTRACT_DOCUMENT_SALARY_ACCESS_REQUIRED"
          ? m.documentRestricted
          : m.loadDocumentFailed,
      );
    }
  };
  const print = async () => {
    try {
      const file = await fetchContractFile(token, contract.id);
      const url = URL.createObjectURL(file.blob);
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = url;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        window.setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      };
      document.body.append(frame);
    } catch (cause) {
      setError(
        (cause as { payload?: { code?: string } }).payload?.code ===
          "CONTRACT_DOCUMENT_SALARY_ACCESS_REQUIRED"
          ? m.documentRestricted
          : m.loadDocumentFailed,
      );
    }
  };
  const decide = async (outcome: "ACCEPT" | "REJECT") => {
    try {
      await verifyContractUpload(
        token,
        contract.id,
        outcome,
        outcome === "REJECT" ? reason : undefined,
      );
      window.location.reload();
    } catch {
      setError(m.decisionFailed);
    }
  };
  const compare = async () => {
    try {
      if (!leftId || !rightId) {
        setPrevious(null);
        return;
      }
      const [earlier, later] = await Promise.all([
        getContract(token, Number(leftId)),
        getContract(token, Number(rightId)),
      ]);
      if (!earlier.particulars?.snapshot || !later.particulars?.snapshot) {
        setError(m.compareUnavailable);
        return;
      }
      setPrevious(earlier);
      setCompared(later);
      setError(null);
    } catch {
      setError(m.compareUnavailable);
    }
  };
  const snapshot = (row: ContractDetail) =>
    (
      row.particulars?.snapshot as
        | { values?: Record<string, unknown> }
        | undefined
    )?.values ?? {};
  const before = previous ? snapshot(previous) : {};
  const after = snapshot(compared);
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter(
    (key) =>
      !(
        key === "salary" &&
        (compared.salaryHidden || previous?.salaryHidden)
      ) &&
      JSON.stringify(before[key] ?? null) !==
        JSON.stringify(after[key] ?? null),
  );
  const clauseMap = (row: ContractDetail) =>
    new Map(row.sections.map((section) => [section.id, section]));
  const oldClauses = previous ? clauseMap(previous) : new Map();
  const newClauses = clauseMap(compared);
  const clauses = [
    ...new Set([...oldClauses.keys(), ...newClauses.keys()]),
  ].filter(
    (key) =>
      JSON.stringify(oldClauses.get(key) ?? null) !==
      JSON.stringify(newClauses.get(key) ?? null),
  );
  return (
    <div className="grid gap-3">
      {dialog}
      {contract.status === "CANCELLED" && contract.cancelReason ? (
        <p>
          {m.cancelledReason}: {contract.cancelReason}
        </p>
      ) : null}
      {contract.endedAt ? (
        <p>
          {m.endedOn}: {formatDate(contract.endedAt)}
          {contract.endReason ? ` · ${contract.endReason}` : ""}
        </p>
      ) : null}
      <SignatoriesPanel contract={contract} />
      {contract.canManage ? (
        <ContractInheritedReasons
          contract={contract}
          reasons={inheritedReasons}
          onChange={(key, value) =>
            setInheritedReasons((current) => ({ ...current, [key]: value }))
          }
        />
      ) : null}
      {contract.canManage ? (
        <button
          type="button"
          disabled={duplicateBusy || !canSupplyReasons}
          className="w-fit rounded border border-border px-3 py-2"
          onClick={() => void duplicate()}
        >
          {m.duplicateDraft}
        </button>
      ) : null}
      {contract.canManage && contract.status === "PENDING_HR_SIGNATURE" ? (
        <FormField label={m.reassignSignatory} className="rounded border border-border p-3">
          <FluentSelect
            ariaLabel={m.reassignSignatory}
            value={String(contract.assignedSignatoryId ?? "")}
            placeholder={m.choose}
            options={signatories
              .filter(
                (item) =>
                  item.isActive && item.employeeId !== contract.employeeId,
              )
              .map((item) => ({
                value: String(item.id),
                label: `${item.displayName} — ${item.jobTitle}`,
              }))}
            onChange={(value) => {
              const id = Number(value);
              if (id)
                void reassignContractSignatory(token, contract.id, id)
                  .then(() => window.location.reload())
                  .catch(() => setError(m.reassignFailed));
            }}
          />
        </FormField>
      ) : null}
      <ContractWorkspaceFileAction token={token} contract={contract} />
      {contract.status === "SIGNED" && contract.canManage ? (
        <section className="grid gap-2 rounded border border-border p-3">
          <h3>{m.renewOrAmend}</h3>
          <p className="text-sm text-muted-foreground">Create a new draft to change contract terms. The current signed contract remains in place until the new version is signed by both parties.</p>
          {versions.some((row) => row.status === "DRAFT" && row.id !== contract.id) ? (
            <p className="text-sm">An existing draft is available. {versions.filter((row) => row.status === "DRAFT" && row.id !== contract.id).map((row) => <a key={row.id} className="text-primary underline" href={`/dashboard/employees/contracts/${row.id}`}>Open draft v{row.version} </a>)}</p>
          ) : null}
          <FormField label="What would you like to do?">
          <FluentSelect
            ariaLabel={m.renewOrAmend}
            value={renewKind}
            options={[
              { value: "RENEWAL", label: m.renewal },
              { value: "AMENDMENT", label: m.amendment },
            ]}
            onChange={(value) => {
              const kind = value as "RENEWAL" | "AMENDMENT";
              setRenewKind(kind);
              setRenewStart(kind === "AMENDMENT" ? contract.startDate ?? "" : "");
              setRenewEnd(kind === "AMENDMENT" ? contract.endDate ?? "" : "");
            }}
          />
          </FormField>
          <FormField label="Reason for the change">
          <Input
            aria-label={m.renewalReason}
            placeholder={m.renewalReason}
            value={renewReason}
            onChange={(event) => setRenewReason(event.target.value)}
          />
          </FormField>
          <FormField label={renewKind === "AMENDMENT" ? "Corrected start date" : "New start date (optional)"}>
          <DateInput aria-label={renewKind === "AMENDMENT" ? "Corrected start date" : "New start date (optional)"} value={renewStart} onValueChange={(value) => setRenewStart(value)} />
          </FormField>
          <FormField label={m.newEndDate}>
          <DateInput
            aria-label={m.newEndDate}
            value={renewEnd}
            onValueChange={(value) => setRenewEnd(value)}
          />
          </FormField>
          {renewStart && renewEnd && renewEnd < renewStart ? <p role="alert" className="text-sm text-destructive">The end date must be on or after the start date.</p> : null}
          <button
            type="button"
            className="w-fit rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
            disabled={
              renewBusy ||
              renewReason.trim().length < 3 ||
              (renewKind === "AMENDMENT" && !renewStart) ||
              (!!renewStart && !!renewEnd && renewEnd < renewStart) ||
              !canSupplyReasons ||
              (contract.contractType === "FIXED_TERM" && !renewEnd)
            }
            onClick={() => void renew()}
          >
            {m.prepareVersion}
          </button>
        </section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {Object.keys(fieldErrors).length ? (
        <ul role="alert" className="text-destructive">
          {Object.entries(fieldErrors).map(([key, message]) => (
            <li key={key}>
              {m.label(key)}: {message}
            </li>
          ))}
        </ul>
      ) : null}
      {contract.can_view_document ? (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => void download()}>
              {m.download}
            </button>
            <button type="button" onClick={() => void print()}>
              {m.print}
            </button>
          </div>
          <details>
            <summary>{m.fileHistory}</summary>
            {contract.files.length ? (
              <ul>
                {contract.files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => void download(file.id)}
                    >
                      {file.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{m.noFiles}</p>
            )}
          </details>
          <ContractPdfViewer
            token={token}
            contractId={contract.id}
            documentId={contract.signing.current_document_id}
            onLoaded={() => setOpened(true)}
          />
        </>
      ) : (
        <p>{m.documentRestricted}</p>
      )}
      {contract.status === "PENDING_VERIFICATION" && contract.canManage ? (
        contract.can_view_document ? (
          <section className="grid gap-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold">{m.verifyUpload}</h3>
                <p className="text-sm text-muted-foreground">{m.compareScans}</p>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-1.5">
                <p className="text-sm font-medium">{m.employeeUpload}</p>
                <ContractPdfViewer
                  token={token}
                  contractId={contract.id}
                  documentId={contract.pendingUploadDocumentId}
                />
              </div>
              <div className="grid gap-1.5">
                <p className="text-sm font-medium">{m.companySigned}</p>
                <ContractPdfViewer
                  token={token}
                  contractId={contract.id}
                  documentId={contract.companySignedDocumentId}
                />
              </div>
            </div>
            <FormField label="Reason for rejection" hint="Only needed to reject.">
              <Textarea
                formatting={false}
                aria-label={m.rejectReason}
                placeholder="e.g. Page 3 is not signed, or the scan is unreadable"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap items-center gap-3 border-t border-sky-200 pt-3">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                onClick={() => void decide("ACCEPT")}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                {m.accept}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-300 bg-white px-5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={reason.trim().length < 3}
                title={reason.trim().length < 3 ? "Enter a reason to reject" : undefined}
                onClick={() => void decide("REJECT")}
              >
                <XCircle className="size-4" aria-hidden />
                {m.reject}
              </button>
              {reason.trim().length < 3 ? (
                <span className="text-xs text-muted-foreground">
                  Enter a reason above to enable Reject.
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <p>{m.waitingReviewer}</p>
        )
      ) : null}
      {contract.can_view_document &&
      (party ||
        (contract.canManage && contract.status === "PENDING_HR_SIGNATURE")) ? (
        <ContractSigningPanel
          token={token}
          contract={contract}
          signerName={
            party === "COMPANY"
              ? (contract.signatory?.displayName ?? "")
              : (contract.employeeName ?? "")
          }
          attestOnBehalf={
            contract.canManage &&
            contract.status === "PENDING_HR_SIGNATURE" &&
            !party
          }
          opened={opened}
          onChanged={() => window.location.reload()}
        />
      ) : null}
      <section
        id="contract-version-compare"
        className="scroll-mt-40 rounded border border-border p-3"
      >
        <FormField label={m.earlierVersion}>
          <FluentSelect
            ariaLabel={m.earlierVersion}
            value={String(leftId)}
            onChange={(value) => setLeftId(value)}
            placeholder={m.choose}
            options={versions.map((row) => ({
              value: String(row.id),
              label: `${m.version} ${row.version}`,
            }))}
          />
        </FormField>
        <FormField label={m.laterVersion}>
          <FluentSelect
            ariaLabel={m.laterVersion}
            value={String(rightId)}
            onChange={(value) => setRightId(value)}
            options={versions.map((row) => ({
              value: String(row.id),
              label: `${m.version} ${row.version}`,
            }))}
          />
        </FormField>
        <button type="button" onClick={() => void compare()}>
          {m.compareVersions}
        </button>
        {previous === null ? (
          <p>{m.noPrevious}</p>
        ) : previous ? (
          <>
            <h3>{m.changedFields}</h3>
            {changed.length ? (
              <ul>
                {changed.map((key) => (
                  <li key={key}>
                    {m.label(key)}: {String(before[key] ?? m.empty)} →{" "}
                    {String(after[key] ?? m.empty)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{m.noDifferences}</p>
            )}
            <h3>{m.changedClauses}</h3>
            {compared.salaryHidden || previous.salaryHidden ? (
              <p>{m.clausesHidden}</p>
            ) : clauses.length ? (
              <ul>
                {clauses.map((key) => (
                  <li key={key}>
                    <strong>
                      {newClauses.get(key)?.heading ??
                        oldClauses.get(key)?.heading}
                    </strong>
                    <p>
                      {m.oldValue}: {oldClauses.get(key)?.body ?? m.empty}
                    </p>
                    <p>
                      {m.newValue}: {newClauses.get(key)?.body ?? m.empty}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{m.noDifferences}</p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
