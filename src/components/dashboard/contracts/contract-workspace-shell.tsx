"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CloudOff,
  Download,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  RotateCw,
  Save,
  Send,
  UserRound,
} from "lucide-react";
import { ActivityPanel } from "./contract-page-panels";
import { ContractWorkspaceVersions } from "./contract-workspace-versions";
import { ContractStatusBadge, formatDateTime } from "./contract-ui";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";
import {
  DIRECT_FIELDS,
  LEGACY_FIELDS,
  type DirectField,
  useContractDirectFields,
} from "./contract-workspace-direct";
import { ContractReferencePicker } from "./contract-workspace-reference";
import { ContractOverrideInput } from "./contract-workspace-override";
import {
  ContractWorkspaceClauses,
  clauseTokenErrors,
} from "./contract-workspace-clauses";
import { ContractWorkspacePreview } from "./contract-workspace-preview";
import {
  ContractWorkspaceDocument,
  ContractWorkspaceFileAction,
} from "./contract-workspace-document";
import { useContractDialogs } from "./contract-dialogs";
import { sendReadyContract } from "./contract-workspace-send";
import { Dialog, DialogSurface, DialogTitle } from "@fluentui/react-components";
import { readStatusFieldErrors } from "@/lib/admin-api";
import {
  getContractFields,
  getContract,
  getContractReadiness,
  sendContract,
  listSignatories,
  listContractTemplates,
  previewContractDraft,
  base64ToBlob,
  saveBlob,
  type Signatory,
  type ContractDetail,
  type ContractField,
  type ContractFieldMetadata,
  type ContractReadiness,
  type ContractActivityItem,
  type ContractSection,
} from "@/lib/contracts-api";

const MemoContractField = React.memo(
  ({ children }: { signature: string; children: React.ReactNode }) => (
    <>{children}</>
  ),
  (previous, next) => previous.signature === next.signature,
);
const MemoContractClauses = React.memo(ContractWorkspaceClauses);
MemoContractField.displayName = "MemoContractField";

const headerBtn =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted";

function contractStep(status: string): number {
  if (status === "DRAFT") return 0;
  if (status === "PENDING_HR_SIGNATURE") return 1;
  if (["PENDING_EMPLOYEE_SIGNATURE", "PENDING_VERIFICATION", "ISSUED"].includes(status)) return 2;
  if (status === "SIGNED") return 4; // all steps complete
  return -1;
}

function loadFailure(kind: "fields" | "readiness", cause: unknown): Error {
  const status = (cause as { status?: number } | null)?.status;
  const description = kind === "fields" ? "contract fields" : "contract readiness";
  const advice = status === 401 ? "Your session may have expired. Sign in again." : status === 403 ? "You do not have permission to view this information." : "Try again. If the problem continues, contact support.";
  const detail = status && status >= 400 && status < 500 && status !== 401 && status !== 403 && cause instanceof Error ? ` ${cause.message}` : "";
  return new Error(`Could not load ${description}${status ? ` (HTTP ${status})` : ""}.${detail} ${advice}`);
}

function SaveStatus({
  status,
  savedAt,
}: {
  status: "saved" | "dirty" | "saving" | "error";
  savedAt: number;
}) {
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    if (status !== "saved") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [status, savedAt]);
  return (
    <span role="status">
      {status === "saving"
        ? m.saveSaving
        : status === "saved"
          ? m.savedSecondsAgo(Math.max(0, Math.floor((now - savedAt) / 1000)))
          : status === "error"
            ? m.saveError
            : m.saveDirty}
    </span>
  );
}

export function ContractWorkspaceShell({
  token,
  contract,
  metadata,
}: {
  token: string;
  contract: ContractDetail;
  metadata: ContractFieldMetadata[];
}) {
  const [fields, setFields] = React.useState<ContractField[] | null>(null);
  const [readiness, setReadiness] = React.useState<ContractReadiness | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPayload, setPreviewPayload] = React.useState<
    Record<string, unknown>
  >({});
  const [activeOverrides, setActiveOverrides] = React.useState<
    Record<string, boolean>
  >({});
  const [sending, setSending] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [showUnused, setShowUnused] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<(typeof m.sections)[number]>(m.sections[0]);
  const [signatories, setSignatories] = React.useState<Signatory[]>([]);
  const [signatoriesError, setSignatoriesError] = React.useState(false);
  const [templateSections, setTemplateSections] = React.useState<
    ContractSection[] | undefined
  >();
  const [activity, setActivity] = React.useState<ContractActivityItem[]>([]);
  const [activityRefresh, setActivityRefresh] = React.useState(0);
  const lastSaveStatus = React.useRef("saved");
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const { confirm, dialog } = useContractDialogs();
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [conflictLatest, setConflictLatest] = React.useState<{
    contract: ContractDetail;
    fields: ContractField[];
  } | null>(null);
  const [conflictError, setConflictError] = React.useState(false);
  const [baselineFields, setBaselineFields] = React.useState<ContractField[]>([]);
  const moreRef = React.useRef<HTMLDetailsElement | null>(null);
  const currentStep = contractStep(contract.status);
  React.useEffect(() => {
    // Close the "More actions" menu on outside click or Escape.
    const close = (event: MouseEvent | KeyboardEvent) => {
      const menu = moreRef.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.contains(event.target as Node))
        menu.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const direct = useContractDirectFields(
    token,
    contract,
    fields,
    setFields,
    setReadiness,
  );
  React.useEffect(() => {
    setOffline(!navigator.onLine);
    const online = () => {
      setOffline(false);
      if (direct.status === "error" && direct.issue !== "conflict")
        void direct.flush();
    };
    const offlineEvent = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineEvent);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineEvent);
    };
  }, [direct.status, direct.issue, direct.flush]);
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) {
          const group = m.sections.find(
            (item) =>
              `section-${item.replace(/[^a-z]+/gi, "-").toLowerCase()}` ===
              visible.target.id,
          );
          if (group) setActiveSection(group);
        }
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 },
    );
    for (const group of m.sections) {
      const node = document.getElementById(
        `section-${group.replace(/[^a-z]+/gi, "-").toLowerCase()}`,
      );
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);
  const live =
    contract.status === "DRAFT" && contract.particulars?.mode === "live";
  const draft = contract.status === "DRAFT";
  const legacy = draft && !live;
  const pending =
    !!direct.state && Object.keys(direct.state.revisions).length > 0;
  React.useEffect(() => {
    if (direct.status === "saved" && lastSaveStatus.current !== "saved")
      setActivityRefresh((value) => value + 1);
    lastSaveStatus.current = direct.status;
  }, [direct.status]);
  const clauseErrors =
    draft && !contract.salaryHidden
      ? clauseTokenErrors(
          direct.state?.sections ??
            (contract.sections.length
              ? contract.sections
              : (contract.effective_draft_sections ?? [])),
          metadata,
        )
      : [];
  React.useEffect(() => {
    if (!pending && direct.status === "saved" && fields)
      setBaselineFields(fields);
  }, [direct.status, fields, pending]);
  React.useEffect(() => {
    if (direct.issue !== "conflict") return;
    let cancelled = false;
    setConflictOpen(true);
    setConflictError(false);
    void Promise.all([
      getContract(token, contract.id),
      getContractFields(token, contract.id),
    ])
      .then(([latest, latestFields]) => {
        if (!cancelled)
          setConflictLatest({ contract: latest, fields: latestFields });
      })
      .catch(() => {
        if (!cancelled) setConflictError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [direct.issue, token, contract.id]);
  React.useEffect(() => {
    if (!pending) return;
    let approvedUrl: string | null = null;
    let approvalTimer: number | undefined;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !link ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank" ||
        link.origin !== window.location.origin ||
        (link.hash &&
          link.pathname === window.location.pathname &&
          link.search === window.location.search)
      )
        return;
      if (!window.confirm(m.unsaved)) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        approvedUrl = link.href;
        window.clearTimeout(approvalTimer);
        approvalTimer = window.setTimeout(() => {
          approvedUrl = null;
        }, 10_000);
      }
    };
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    const navigate = (raw: Event) => {
      const event = raw as Event & {
        destination?: { url?: string };
        hashChange?: boolean;
      };
      const destination = event.destination?.url;
      if (!event.cancelable || event.hashChange || !destination) return;
      const target = new URL(destination, window.location.href);
      if (
        target.origin !== window.location.origin ||
        (target.pathname === window.location.pathname &&
          target.search === window.location.search)
      )
        return;
      if (approvedUrl === target.href) {
        approvedUrl = null;
        return;
      }
      if (!window.confirm(m.unsaved)) event.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      window.clearTimeout(approvalTimer);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [pending]);
  React.useEffect(() => {
    let cancelled = false;
    const snapshot = contract.particulars?.snapshot as
      | {
          values?: Record<string, string | null>;
          automatic?: Record<string, string | null>;
          overrides?: Record<string, string | null>;
        }
      | undefined;
    const frozen = metadata.map((item) => ({
      key: item.key,
      value: String(snapshot?.values?.[item.key] ?? ""),
      automatic: String(snapshot?.automatic?.[item.key] ?? ""),
      override: snapshot?.overrides?.[item.key] ?? null,
      used: false,
      frozen: true,
      hidden: item.key === "salary" && !!contract.salaryHidden,
    }));
    const loading: Promise<[ContractField[], ContractReadiness | null]> =
      contract.status === "DRAFT"
        ? Promise.all([
            getContractFields(token, contract.id).catch((cause: unknown) => { throw loadFailure("fields", cause); }),
            getContractReadiness(token, contract.id, {}).catch((cause: unknown) => { throw loadFailure("readiness", cause); }),
          ])
        : Promise.resolve([frozen, null]);
    loading
      .then(([nextFields, nextReadiness]) => {
        if (!cancelled) {
          setFields(nextFields);
          setReadiness(nextReadiness);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : m.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [token, contract, metadata, loadAttempt]);
  React.useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    listSignatories(token)
      .then((rows) => {
        if (!cancelled) setSignatories(rows);
      })
      .catch(() => {
        if (!cancelled) setSignatoriesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, draft]);
  React.useEffect(() => {
    if (
      !draft ||
      contract.salaryHidden ||
      !contract.templateId ||
      !contract.templateVersion
    )
      return;
    let cancelled = false;
    void listContractTemplates(token)
      .then((items) => {
        const source = items.find(
          (item) =>
            item.id === contract.templateId &&
            item.version === contract.templateVersion,
        );
        if (!cancelled) setTemplateSections(source?.sections);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    draft,
    token,
    contract.salaryHidden,
    contract.templateId,
    contract.templateVersion,
  ]);
  React.useEffect(() => {
    if (!live || pending) return;
    const refresh = () => {
      void getContractFields(token, contract.id)
        .then(setFields)
        .catch(() => setError(m.loadError));
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [live, pending, token, contract.id]);
  const preview = () => {
    setPreviewPayload(draft ? direct.previewBody() : {});
    setPreviewOpen(true);
  };
  React.useEffect(() => {
    if (!draft) return;
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s" && !event.shiftKey) {
        event.preventDefault();
        void direct.flush();
      } else if (event.key.toLowerCase() === "p" && event.shiftKey) {
        event.preventDefault();
        setPreviewPayload(direct.previewBody());
        setPreviewOpen(true);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [draft, direct.flush, direct.previewBody]);
  const send = async () => {
    if (clauseErrors.length) {
      setError(m.invalidTokens);
      return;
    }
    setSending(true);
    try {
      const result = await sendReadyContract({
        flush: direct.flush,
        readiness: () => getContractReadiness(token, contract.id, {}),
        confirm: async (checked) => {
          const printed = await getContractFields(token, contract.id);
          const find = (key: string) =>
            printed.find((field) => field.key === key);
          const salary = find("salary");
          const currency = find("currency");
          const person = signatories.find(
            (item) => item.id === checked.signatory_id,
          );
          return confirm({
            title: m.send,
            message: (
              <div className="grid gap-2">
                <p>{m.sendConfirm}</p>
                <strong>{m.sendSummary}</strong>
                <p>
                  {m.employee}:{" "}
                  {contract.employeeName || contract.employeeNo || m.empty}
                </p>
                <p>
                  {m.contractType}: {find("contract_type")?.value || m.empty}
                </p>
                <p>
                  {m.startDate}: {find("start_date")?.value || m.empty}
                </p>
                <p>
                  {m.label("salary")}:{" "}
                  {contract.salaryHidden || salary?.hidden
                    ? m.hidden
                    : `${currency?.value || ""} ${salary?.value || m.empty}`}
                </p>
                <p>
                  {m.signatory}:{" "}
                  {person?.displayName ||
                    (contract.signatory?.id === checked.signatory_id
                      ? (contract.signatory?.displayName ?? m.empty)
                      : m.empty)}
                </p>
                <p>
                  {m.overrideCount}:{" "}
                  {
                    printed.filter(
                      (field) =>
                        !field.hidden &&
                        !(contract.salaryHidden && field.key === "salary") &&
                        (field.override || hasReferenceOverride(field.key)),
                    ).length
                  }
                </p>
              </div>
            ),
            confirmLabel: m.send,
          });
        },
        send: () => sendContract(token, contract.id),
      });
      if (result.readiness) setReadiness(result.readiness);
      if (result.outcome === "not_ready") setError(m.sendNotReady);
      if (result.outcome === "sent") window.location.reload();
    } catch (cause) {
      const fieldErrors = readStatusFieldErrors(cause);
      if (Object.keys(fieldErrors).length)
        setReadiness((current) =>
          current
            ? { ...current, ready: false, field_errors: fieldErrors }
            : current,
        );
      setError(m.sendFailed);
    } finally {
      setSending(false);
    }
  };
  const downloadDraft = async () => {
    try {
      const pdf = await previewContractDraft(
        token,
        contract.id,
        direct.previewBody(),
      );
      saveBlob(base64ToBlob(pdf.content_base64), pdf.file_name);
    } catch (cause) {
      setError(
        (cause as { payload?: { code?: string } }).payload?.code ===
          "CONTRACT_PREVIEW_SALARY_ACCESS_REQUIRED"
          ? m.previewDenied
          : m.previewError,
      );
    }
  };
  const problems = Object.entries(readiness?.field_errors ?? {});
  const focusField = (key: string) => {
    setMobileOpen(false);
    setShowUnused(true);
    requestAnimationFrame(() => {
      const target = document.getElementById(
        key === "sections" || key.startsWith("sections.")
          ? "section-clauses"
          : `field-${key}`,
      );
      const focusable =
        target?.querySelector<HTMLElement>("input,select,textarea,button") ??
        target;
      focusable?.focus();
      target?.scrollIntoView({ block: "center" });
    });
  };
  const savedRefs = (contract.particulars?.refs ?? {}) as Record<
    string,
    unknown
  >;
  const hasReferenceOverride = (key: string) => {
    if (contract.status !== "DRAFT") return false;
    const ref = metadata.find((item) => item.key === key)?.referenceKey;
    return (
      !!ref &&
      typeof (direct.state && ref in direct.state.refs
        ? direct.state.refs[ref]
        : savedRefs[ref]) === "number"
    );
  };
  const printedClause = (text: string) =>
    draft
      ? text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: string) => {
          const field = fields?.find((item) => item.key === key);
          return field?.hidden
            ? m.hidden
            : field?.value?.trim() || `[${key.replace(/_/g, " ")}]`;
        })
      : text;
  const summaryOverrides = (fields ?? []).filter((field) => {
    if (field.hidden || (contract.salaryHidden && field.key === "salary"))
      return false;
    const revision = direct.state?.revisions[`override:${field.key}`];
    const local = direct.state?.overrides[field.key];
    const pendingClear = revision !== undefined && !local;
    const probationEdit =
      field.key === "probation_months" &&
      direct.state?.revisions.probation_months !== undefined &&
      !!direct.state.values.probation_months;
    return !!(
      hasReferenceOverride(field.key) ||
      probationEdit ||
      (activeOverrides[field.key] ?? false) ||
      (!pendingClear && (local || field.override))
    );
  });
  const panel = (
    <div className="grid gap-3">
      {contract.status === "DRAFT" ? (
        <section
          id="contract-readiness"
          className="rounded-lg border border-border p-4"
        >
          <h2 className="font-semibold">{m.readiness}</h2>
          {!readiness ? (
            <p>{m.loading}</p>
          ) : readiness.ready && !clauseErrors.length ? (
            <p>{m.ready}</p>
          ) : (
            <ul>
              {problems.map(([key, message]) => (
                <li key={key}>
                  <a
                    className="text-primary underline"
                    href={
                      key === "sections" ? "#section-clauses" : `#field-${key}`
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      focusField(key);
                    }}
                  >
                    {message}
                  </a>
                </li>
              ))}
              {readiness.missing_fields.map((key) => (
                <li key={`missing-${key}`}>
                  <a
                    className="text-primary underline"
                    href={`#field-${key}`}
                    onClick={(event) => {
                      event.preventDefault();
                      focusField(key);
                    }}
                  >
                    {m.missing}: {m.label(key)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {clauseErrors.length ? (
            <button
              type="button"
              className="text-primary underline"
              onClick={() => focusField("sections")}
            >
              {m.invalidTokens} {clauseErrors.join(", ")}
            </button>
          ) : null}
          {readiness &&
            Object.entries(readiness.warnings).map(([key, message]) => (
              <p key={key}>
                <a
                  href={`#field-${key}`}
                  className="text-primary underline"
                  onClick={(event) => {
                    event.preventDefault();
                    focusField(key);
                  }}
                >
                  {message}
                </a>
              </p>
            ))}
        </section>
      ) : null}
      <section className="rounded-lg border border-border p-4">
        <h2 className="font-semibold">
          {m.overrides} ({summaryOverrides.length})
        </h2>
        {summaryOverrides.length ? (
          <ul>
            {summaryOverrides.map((field) => (
              <li key={field.key}>
                <a
                  className="text-primary underline"
                  href={`#field-${field.key}`}
                  onClick={(event) => {
                    event.preventDefault();
                    focusField(field.key);
                  }}
                >
                  {m.label(field.key)}
                </a>
                :{" "}
                {(field.key === "probation_months"
                  ? direct.state?.probationReason
                  : direct.state?.reasons[field.key]) ||
                  field.override_reason ||
                  m.noReason}
              </li>
            ))}
          </ul>
        ) : (
          <p>{m.none}</p>
        )}
        {draft &&
        summaryOverrides.some(
          (field) =>
            !field.hidden &&
            !(contract.salaryHidden && field.key === "salary") &&
            !(contract.can_edit_salary === false && field.key === "salary") &&
            metadata.find((item) => item.key === field.key)?.overridePolicy ===
              "with-reason",
        ) ? (
          <button
            type="button"
            className="mt-2 text-primary underline"
            onClick={() => {
              void confirm({
                title: m.resetAll,
                message: m.resetAllConfirm,
                confirmLabel: m.resetAll,
              }).then((accepted) => {
                if (!accepted) return;
                for (const field of summaryOverrides) {
                  if (
                    !field.hidden &&
                    !(contract.salaryHidden && field.key === "salary") &&
                    !(
                      contract.can_edit_salary === false &&
                      field.key === "salary"
                    ) &&
                    metadata.find((item) => item.key === field.key)
                      ?.overridePolicy === "with-reason"
                  ) {
                    if (live && field.key === "probation_months")
                      direct.resetProbation(field.automatic ?? "");
                    else direct.updateOverride(field.key, "");
                  }
                }
              });
            }}
          >
            {m.resetAll}
          </button>
        ) : null}
      </section>
      <ContractWorkspaceVersions
        token={token}
        contract={contract}
        onCompare={() => setMobileOpen(false)}
      />
      <ActivityPanel
        token={token}
        contract={contract}
        onItems={setActivity}
        refreshKey={activityRefresh}
      />
    </div>
  );
  return (
    <div data-contract-workspace className="grid gap-4 pb-16">
      {dialog}
      <Dialog
        open={conflictOpen}
        onOpenChange={(_event, data) => setConflictOpen(data.open)}
      >
        <DialogSurface>
          <DialogTitle>{m.conflictTitle}</DialogTitle>
          <p>{m.conflictMessage}</p>
          {conflictError ? (
            <p role="alert">{m.conflictLoadError}</p>
          ) : !conflictLatest ? (
            <p>{m.loading}</p>
          ) : (
            <div>
              <h3>{m.conflictChanges}</h3>
              <ul>
                {conflictLatest.fields
                  .filter(
                    (field) =>
                      !field.hidden &&
                      !(contract.salaryHidden && field.key === "salary") &&
                      baselineFields.find(
                        (item) => item.key === field.key,
                      )?.value !== field.value,
                  )
                  .map((field) => (
                    <li key={field.key}>
                      {m.label(field.key)}:{" "}
                      {baselineFields.find(
                        (item) => item.key === field.key,
                      )?.value || m.empty}{" "}
                      → {field.value || m.empty}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-border px-3 py-2"
              onClick={() => window.location.reload()}
            >
              {m.reload}
            </button>
            <button
              type="button"
              className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              disabled={!conflictLatest}
              onClick={() => {
                if (conflictLatest)
                  void direct
                    .reapply(conflictLatest.contract, conflictLatest.fields)
                    .then((saved) => {
                      if (saved) setConflictOpen(false);
                    });
              }}
            >
              {m.reapplyChanges}
            </button>
            <button
              type="button"
              className="rounded border border-border px-3 py-2"
              onClick={() => setConflictOpen(false)}
            >
              {m.stay}
            </button>
          </div>
        </DialogSurface>
      </Dialog>
      <ContractWorkspacePreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        token={token}
        id={contract.id}
        body={previewPayload}
        readiness={readiness}
        onFocusField={focusField}
      />
      <style>
        {
          "body:has([data-contract-workspace]) [data-support-widget] { position: static !important; margin: 1rem; }"
        }
      </style>
      <header className="sticky top-0 z-20 -mx-1 rounded-xl border border-border bg-background/95 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85">
        {/* Row 1: breadcrumb + identity on the left, actions on the right */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3">
          <div className="grid min-w-0 gap-1">
            <Link
              href="/dashboard/employees/contracts"
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="size-3.5" /> {m.contracts}
            </Link>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <FileText className="size-5 shrink-0 text-primary" aria-hidden />
              <h1 className="truncate text-lg font-semibold leading-tight">
                {draft
                  ? ((legacy
                      ? direct.state?.legacyValues.title
                      : direct.state?.values.title) ?? contract.title)
                  : contract.title}
              </h1>
              <ContractStatusBadge status={contract.status} />
              {legacy ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {m.legacyDraft}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              <span className="font-mono text-xs">
                {contract.referenceNo} · v{contract.version}
              </span>
              <span aria-hidden>•</span>
              <Link
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
                href={`/dashboard/employees/profile/${encodeURIComponent(contract.employeeNo ?? "")}`}
              >
                <UserRound className="size-3.5" aria-hidden />
                {contract.employeeName}
              </Link>
              <span>({contract.employeeNo})</span>
              <span aria-hidden>•</span>
              <span>{contract.jobTitle || m.empty}</span>
              <span aria-hidden>•</span>
              <span>{contract.departmentName || m.empty}</span>
            </div>
          </div>

          {draft ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {direct.status === "saving" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : direct.status === "error" || offline ? (
                  <CloudOff className="size-3.5 text-destructive" aria-hidden />
                ) : direct.status === "saved" ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                ) : (
                  <Save className="size-3.5" aria-hidden />
                )}
                {offline && (pending || direct.status === "error") ? (
                  <span role="status">{m.offline}</span>
                ) : (
                  <SaveStatus status={direct.status} savedAt={direct.savedAt} />
                )}
                {direct.status === "error" && direct.issue !== "conflict" ? (
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => void direct.flush()}
                  >
                    {m.retry}
                  </button>
                ) : null}
              </span>
              <button
                type="button"
                className={headerBtn}
                title="Ctrl/⌘+S"
                onClick={() => void direct.flush()}
              >
                <Save className="size-4" aria-hidden /> {m.saveDraft}
              </button>
              <button
                type="button"
                className={headerBtn}
                onClick={preview}
                title="Ctrl/⌘+Shift+P"
              >
                <Eye className="size-4" aria-hidden /> {m.preview}
              </button>
              <button
                type="button"
                disabled={
                  sending ||
                  !readiness?.ready ||
                  !!direct.issue ||
                  clauseErrors.length > 0
                }
                title={
                  !readiness?.ready || clauseErrors.length
                    ? m.itemsNeedAttention
                    : undefined
                }
                onClick={() => void send()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                {sending ? m.sending : m.send}
              </button>
              <details ref={moreRef} className="relative">
                <summary
                  className={`${headerBtn} list-none [&::-webkit-details-marker]:hidden`}
                  aria-label={m.moreActions}
                  title={m.moreActions}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{m.moreActions}</span>
                </summary>
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1 grid w-64 gap-0.5 rounded-lg border border-border bg-background p-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      if (moreRef.current) moreRef.current.open = false;
                      void downloadDraft();
                    }}
                  >
                    <Download className="size-4" aria-hidden /> {m.downloadDraft}
                  </button>
                  <div className="my-1 border-t border-border" />
                  <ContractWorkspaceFileAction
                    token={token}
                    contract={contract}
                    beforeAction={direct.flush}
                    variant="menu"
                  />
                </div>
              </details>
            </div>
          ) : null}
        </div>

        {/* Row 2: progress stepper + readiness */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <ol
            className="flex min-w-0 flex-1 flex-wrap items-center gap-y-2 text-xs sm:text-sm"
            aria-label={m.progress}
          >
            {m.steps.map((label, i) => {
              const done = currentStep > i;
              const current = currentStep === i;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className="flex items-center"
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                      current
                        ? "bg-primary/10 font-semibold text-primary"
                        : done
                          ? "text-emerald-700"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                        current
                          ? "bg-primary text-primary-foreground"
                          : done
                            ? "bg-emerald-600 text-white"
                            : "border border-border"
                      }`}
                    >
                      {done ? <Check className="size-3" aria-hidden /> : i + 1}
                    </span>
                    {label}
                  </span>
                  {i < m.steps.length - 1 ? (
                    <span
                      aria-hidden
                      className={`mx-1 h-px w-4 sm:w-8 ${done ? "bg-emerald-600" : "bg-border"}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          {draft && readiness ? (
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                readiness.ready && !clauseErrors.length
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-300 bg-amber-50 text-amber-900"
              }`}
              onClick={() => {
                if (window.matchMedia("(max-width: 1023px)").matches)
                  setMobileOpen(true);
                else
                  document
                    .getElementById("contract-readiness")
                    ?.scrollIntoView({ block: "center" });
              }}
            >
              {readiness.ready && !clauseErrors.length ? (
                <CheckCircle2 className="size-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="size-3.5" aria-hidden />
              )}
              {readiness.ready && !clauseErrors.length
                ? m.ready
                : `${problems.length + readiness.missing_fields.length + clauseErrors.length} ${m.itemsNeedAttention}`}
            </button>
          ) : null}
        </div>

        {/* Row 3: section tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2">
          <nav
            aria-label={m.navigation}
            className="-mb-px flex min-w-0 gap-1 overflow-x-auto"
          >
            {m.sections.map((group) => (
              <a
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  activeSection === group
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                aria-current={activeSection === group ? "location" : undefined}
                key={group}
                href={`#section-${group.replace(/[^a-z]+/gi, "-").toLowerCase()}`}
              >
                {group}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 px-2 py-1.5">
            {draft ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showUnused}
                  onChange={(event) => setShowUnused(event.target.checked)}
                />
                {m.showUnusedFields}
              </label>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-border px-2.5 py-1 text-xs lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              {m.mobilePanel}
            </button>
          </div>
        </div>
      </header>
      {direct.issue ? (
        <p role="alert">
          {direct.issue === "reason_required"
            ? m.reasonRequired
            : direct.issue === "probation_range"
              ? m.probationRange
              : direct.issue === "end_date_required"
                ? m.endRequired
                : direct.issue === "end_before_start"
                  ? m.endBeforeStart
                  : direct.issue === "salary_format"
                    ? m.salaryFormat
                    : direct.issue === "currency_format"
                      ? m.currencyFormat
                      : direct.issue === "conflict"
                        ? m.conflictMessage
                        : m.saveError}
          {direct.issue === "conflict" ? (
            <button
              type="button"
              className="ml-2 text-primary underline"
              onClick={() => setConflictOpen(true)}
            >
              {m.conflictTitle}
            </button>
          ) : null}
        </p>
      ) : null}
      {direct.resolutionFailed || direct.readinessFailed ? (
        <div role="alert">
          <p>{m.resolveError}</p>
          <button
            type="button"
            className="text-primary underline"
            onClick={direct.retryResolution}
          >
            {m.retry}
          </button>
        </div>
      ) : null}
      {clauseErrors.length ? (
        <p role="alert">
          {m.invalidTokens} {clauseErrors.join(", ")}
        </p>
      ) : null}
      {contract.status === "DRAFT" && contract.particulars?.mode !== "live" ? (
        <section className="rounded-lg border border-border p-4">
          <strong>{m.legacyDraft}</strong>
          <p>{m.legacyNotice}</p>
        </section>
      ) : null}
      {contract.status !== "DRAFT" && !contract.particulars?.snapshot ? (
        <p>{m.snapshotUnavailable}</p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{error}</p>
          {error === m.loadError || error.startsWith("Could not load contract fields") || error.startsWith("Could not load contract readiness") ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-3 py-1 text-xs font-medium hover:bg-rose-100"
              onClick={() => {
                setError(null);
                setLoadAttempt((value) => value + 1);
              }}
            >
              <RotateCw className="size-3.5" aria-hidden /> {m.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      <Dialog
        open={mobileOpen}
        onOpenChange={(_event, data) => setMobileOpen(data.open)}
      >
        <DialogSurface>
          <DialogTitle>{m.mobilePanel}</DialogTitle>
          {panel}
          <button type="button" onClick={() => setMobileOpen(false)}>
            {m.close}
          </button>
        </DialogSurface>
      </Dialog>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main
          className="grid gap-4"
          onBlur={() => {
            if (draft && pending) void direct.flush();
          }}
        >
          {contract.status !== "DRAFT" ? (
            <ContractWorkspaceDocument token={token} contract={contract} />
          ) : null}
          {m.sections.map((group) => (
            <section
              key={group}
              id={`section-${group.replace(/[^a-z]+/gi, "-").toLowerCase()}`}
              className="scroll-mt-56 rounded-lg border border-border p-4"
            >
              <h2 className="mb-3 text-lg font-semibold">{group}</h2>
              {group === "Parties" && draft && direct.state ? (
                <label
                  id="field-assigned_signatory_id"
                  className="mb-3 grid gap-1 rounded border border-border p-3"
                >
                  {m.companySignatory}
                  <select
                    className="rounded border border-border bg-background p-2"
                    value={direct.state.signatoryId ?? ""}
                    onChange={(event) =>
                      direct.updateSignatory(
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  >
                    <option value="">{m.automaticSignatory}</option>
                    {signatories
                      .filter(
                        (item) =>
                          item.isActive &&
                          item.employeeId !== contract.employeeId,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName} — {item.jobTitle}
                        </option>
                      ))}
                  </select>
                  {signatoriesError ? (
                    <span role="alert">{m.signatoriesUnavailable}</span>
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {m.resolvedSignatory}:{" "}
                    {(() => {
                      const person = signatories.find(
                        (item) => item.id === readiness?.signatory_id,
                      );
                      return person
                        ? `${person.displayName} — ${person.jobTitle}`
                        : readiness?.signatory_id &&
                            contract.signatory?.id === readiness.signatory_id
                          ? `${contract.signatory.displayName} — ${contract.signatory.jobTitle}`
                          : m.signatoryMissing;
                    })()}
                  </span>
                </label>
              ) : null}
              {group === "Terms" && draft && direct.state ? (
                <label className="mb-3 grid gap-1 rounded border border-border p-3">
                  {m.contractTitle}
                  <input
                    className="rounded border border-border bg-background p-2"
                    value={
                      legacy
                        ? direct.state.legacyValues.title
                        : direct.state.values.title
                    }
                    onChange={(event) =>
                      legacy
                        ? direct.updateLegacy("title", event.target.value)
                        : direct.update("title", event.target.value)
                    }
                    onBlur={() => void direct.flush()}
                  />
                </label>
              ) : null}
              {group === "Review" ? (
                <div className="grid gap-3">
                  <h3 className="font-medium">{m.reviewValues}</h3>
                  <dl>
                    {(fields ?? []).map((field) => (
                      <div key={field.key}>
                        <dt className="inline font-medium">
                          {m.label(field.key)}:{" "}
                        </dt>
                        <dd className="inline">
                          {field.hidden ||
                          (contract.salaryHidden && field.key === "salary")
                            ? m.hidden
                            : field.value || m.empty}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <h3 className="font-medium">{m.reviewClauses}</h3>
                  {contract.salaryHidden ? (
                    <p>{m.clausesHidden}</p>
                  ) : (
                    <ol>
                      {(direct.state?.sections ?? contract.sections)
                        .filter((section) => section.enabled !== false)
                        .map((section) => (
                          <li key={section.id}>
                            <strong>{printedClause(section.heading)}</strong>
                            <p className="whitespace-pre-wrap">
                              {printedClause(section.body)}
                            </p>
                          </li>
                        ))}
                    </ol>
                  )}
                  {draft && readiness ? (
                    <div>
                      <h3 className="font-medium">{m.readiness}</h3>
                      <p>
                        {readiness.ready && !clauseErrors.length
                          ? m.ready
                          : m.itemsNeedAttention}
                      </p>
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => {
                          if (window.matchMedia("(max-width: 1023px)").matches)
                            setMobileOpen(true);
                          else
                            document
                              .getElementById("contract-readiness")
                              ?.scrollIntoView({ block: "center" });
                        }}
                      >
                        {m.readiness}
                      </button>
                    </div>
                  ) : null}
                  {draft ? (
                    <button
                      type="button"
                      onClick={preview}
                      className="w-fit rounded border border-border px-3 py-2"
                    >
                      {m.preview}
                    </button>
                  ) : null}
                </div>
              ) : group === "Clauses" &&
                draft &&
                direct.state &&
                !contract.salaryHidden &&
                contract.can_edit_salary !== false ? (
                <MemoContractClauses
                  sections={direct.state.sections}
                  metadata={metadata}
                  fields={fields ?? []}
                  templateSections={templateSections}
                  onChange={direct.updateSections}
                />
              ) : group === "Clauses" && contract.salaryHidden ? (
                <p>{m.clausesHidden}</p>
              ) : group === "Clauses" ? (
                <ol className="grid gap-3">
                  {(direct.state?.sections ?? contract.sections)
                    .filter((section) => section.enabled !== false)
                    .map((section, index) => (
                      <li key={section.id}>
                        <h3 className="font-medium">
                          {index + 1}. {section.heading}
                        </h3>
                        <p className="whitespace-pre-wrap">{section.body}</p>
                      </li>
                    ))}
                </ol>
              ) : (
                <dl className="grid gap-3">
                  {metadata
                    .filter(
                      (item) =>
                        item.group === group &&
                        (!draft ||
                          showUnused ||
                          fields?.find((field) => field.key === item.key)
                            ?.used !== false) &&
                        (!draft ||
                          item.key !== "end_date" ||
                          (legacy
                            ? direct.state?.legacyValues.contract_type
                            : direct.state?.values.contract_type) ===
                            "FIXED_TERM") &&
                        (!draft ||
                          item.key !== "task_description" ||
                          (legacy
                            ? direct.state?.legacyValues.contract_type
                            : direct.state?.values.contract_type) ===
                            "SPECIFIC_TASK"),
                    )
                    .map((item) => {
                      const field = fields?.find(
                        (entry) => entry.key === item.key,
                      );
                      const reference = item.referenceKey;
                      const legacyEditable =
                        legacy &&
                        (item.key in LEGACY_FIELDS ||
                          item.overridePolicy === "with-reason" ||
                          !!reference);
                      const fieldError =
                        (item.key === "probation_months" &&
                        direct.issue === "probation_range"
                          ? m.probationRange
                          : item.key === "salary" &&
                              direct.issue === "salary_format"
                            ? m.salaryFormat
                            : item.key === "currency" &&
                                direct.issue === "currency_format"
                              ? m.currencyFormat
                              : item.key === "end_date" &&
                                  direct.issue === "end_date_required"
                                ? m.endRequired
                                : item.key === "end_date" &&
                                    direct.issue === "end_before_start"
                                  ? m.endBeforeStart
                                  : readiness?.field_errors[item.key]) ||
                        undefined;
                      const change = activity.find((entry) =>
                        entry.changed_fields.some(
                          (key) =>
                            key === item.key ||
                            key === `field_overrides.${item.key}` ||
                            (item.referenceKey &&
                              key === `refs.${item.referenceKey}`),
                        ),
                      );
                      const overrideActive =
                        activeOverrides[item.key] ??
                        !!direct.state?.overrides[item.key];
                      const sourceHref = legacyEditable
                        ? null
                        : item.owner === "company"
                          ? "/dashboard/employees/contracts?tab=company"
                          : item.owner === "position"
                            ? "/dashboard/positions"
                            : item.owner === "employee"
                              ? `/dashboard/employees/profile/${encodeURIComponent(contract.employeeNo ?? "")}`
                              : null;
                      const signature = JSON.stringify([
                        item,
                        field,
                        !!fields,
                        !!direct.state,
                        live,
                        legacy,
                        contract.salaryHidden,
                        contract.can_edit_salary,
                        direct.state?.values[item.key as DirectField],
                        direct.state?.legacyValues[item.key],
                        direct.state?.overrides[item.key],
                        direct.state?.reasons[item.key],
                        reference ? direct.state?.refs[reference] : null,
                        overrideActive,
                        item.key === "probation_months"
                          ? [
                              direct.state?.probationReason,
                              direct.state?.revisions.probation_months,
                              direct.issue,
                            ]
                          : null,
                        change,
                        readiness?.warnings[item.key],
                        fieldError,
                        item.key === "employee_address"
                          ? fields?.find(
                              (entry) => entry.key === "company_address",
                            )?.value
                          : null,
                      ]);
                      return (
                        <MemoContractField key={item.key} signature={signature}>
                          <div
                            id={`field-${item.key}`}
                            tabIndex={-1}
                            role="group"
                            aria-labelledby={`label-${item.key}`}
                            aria-describedby={
                              fieldError ? `error-${item.key}` : undefined
                            }
                            className="scroll-mt-40 rounded border border-border p-3"
                          >
                            <dt
                              id={`label-${item.key}`}
                              className="font-medium"
                            >
                              {m.label(item.key)}
                            </dt>
                            <dd>
                              {legacy &&
                              direct.state &&
                              !field?.hidden &&
                              !(
                                contract.salaryHidden && item.key === "salary"
                              ) &&
                              !(
                                contract.can_edit_salary === false &&
                                item.key === "salary"
                              ) &&
                              legacyEditable ? (
                                item.key === "contract_type" ? (
                                  <select
                                    aria-label={m.label(item.key)}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    value={
                                      direct.state.legacyValues[item.key] ?? ""
                                    }
                                    onChange={(event) =>
                                      direct.updateLegacy(
                                        item.key,
                                        event.target.value,
                                      )
                                    }
                                    onBlur={() => void direct.flush()}
                                  >
                                    {Object.entries(m.contractTypes).map(
                                      ([key, label]) => (
                                        <option key={key} value={key}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                ) : item.inputKind === "enum" ? (
                                  <select
                                    aria-label={m.label(item.key)}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    value={
                                      direct.state.legacyValues[item.key] ?? ""
                                    }
                                    onChange={(event) =>
                                      direct.updateLegacy(
                                        item.key,
                                        event.target.value,
                                      )
                                    }
                                    onBlur={() => void direct.flush()}
                                  >
                                    <option value="">{m.choose}</option>
                                    {(() => {
                                      let options: Array<[string, string]> = [];
                                      if (item.key === "pay_frequency")
                                        options = Object.entries(
                                          m.payFrequencies,
                                        );
                                      else if (
                                        item.key === "remuneration_method"
                                      )
                                        options = m.paymentMethods.map(
                                          (value) => [value, value],
                                        );
                                      else if (item.key === "currency") {
                                        try {
                                          options = (
                                            (
                                              Intl as typeof Intl & {
                                                supportedValuesOf?: (
                                                  key: string,
                                                ) => string[];
                                              }
                                            ).supportedValuesOf?.(
                                              "currency",
                                            ) ?? ["TZS"]
                                          ).map((value) => [value, value]);
                                        } catch {
                                          options = [["TZS", "TZS"]];
                                        }
                                      }
                                      const current =
                                        direct.state!.legacyValues[item.key] ??
                                        "";
                                      if (
                                        current &&
                                        !options.some(
                                          ([value]) => value === current,
                                        )
                                      )
                                        options.unshift([current, current]);
                                      return options.map(([value, label]) => (
                                        <option key={value} value={value}>
                                          {label}
                                        </option>
                                      ));
                                    })()}
                                  </select>
                                ) : item.inputKind === "longtext" ? (
                                  <textarea
                                    aria-label={m.label(item.key)}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    value={
                                      direct.state.legacyValues[item.key] ?? ""
                                    }
                                    onChange={(event) =>
                                      direct.updateLegacy(
                                        item.key,
                                        event.target.value,
                                      )
                                    }
                                    onBlur={() => void direct.flush()}
                                  />
                                ) : (
                                  <input
                                    aria-label={m.label(item.key)}
                                    readOnly={item.key === "start_date" && !contract.amendmentReason}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    type={
                                      item.inputKind === "date"
                                        ? "date"
                                        : item.inputKind === "number"
                                          ? "number"
                                          : "text"
                                    }
                                    min={
                                      item.key === "probation_months"
                                        ? 0
                                        : undefined
                                    }
                                    max={
                                      item.key === "probation_months"
                                        ? 24
                                        : undefined
                                    }
                                    value={
                                      direct.state.legacyValues[item.key] ?? ""
                                    }
                                    onChange={(event) =>
                                      direct.updateLegacy(
                                        item.key,
                                        event.target.value,
                                      )
                                    }
                                    onBlur={() => void direct.flush()}
                                  />
                                )
                              ) : live &&
                                direct.state &&
                                DIRECT_FIELDS.includes(
                                  item.key as DirectField,
                                ) ? (
                                item.key === "contract_type" ? (
                                  <select
                                    aria-label={m.label(item.key)}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    disabled={
                                      !!direct.state.overrides[item.key]
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    value={direct.state.values.contract_type}
                                    onChange={(event) =>
                                      direct.update(
                                        "contract_type",
                                        event.target.value,
                                      )
                                    }
                                  >
                                    {Object.entries(m.contractTypes).map(
                                      ([key, label]) => (
                                        <option key={key} value={key}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                ) : item.inputKind === "longtext" ? (
                                  <textarea
                                    aria-label={m.label(item.key)}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    disabled={
                                      !!direct.state.overrides[item.key]
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    value={
                                      direct.state.values[
                                        item.key as DirectField
                                      ]
                                    }
                                    onChange={(event) =>
                                      direct.update(
                                        item.key as DirectField,
                                        event.target.value,
                                      )
                                    }
                                  />
                                ) : (
                                  <input
                                    aria-label={m.label(item.key)}
                                    readOnly={item.key === "start_date" && !contract.amendmentReason}
                                    aria-invalid={!!fieldError}
                                    aria-describedby={
                                      fieldError
                                        ? "error-" + item.key
                                        : undefined
                                    }
                                    disabled={
                                      item.key !== "probation_months" &&
                                      !!direct.state.overrides[item.key]
                                    }
                                    className="w-full rounded border border-border bg-background p-2"
                                    type={
                                      item.inputKind === "date"
                                        ? "date"
                                        : item.key === "probation_months"
                                          ? "number"
                                          : "text"
                                    }
                                    min={
                                      item.key === "probation_months"
                                        ? 0
                                        : undefined
                                    }
                                    max={
                                      item.key === "probation_months"
                                        ? 24
                                        : undefined
                                    }
                                    step={
                                      item.key === "probation_months"
                                        ? 1
                                        : undefined
                                    }
                                    value={
                                      direct.state.values[
                                        item.key as DirectField
                                      ]
                                    }
                                    onChange={(event) =>
                                      direct.update(
                                        item.key as DirectField,
                                        event.target.value,
                                      )
                                    }
                                  />
                                )
                              ) : live && direct.state && reference ? (
                                <ContractReferencePicker
                                  token={token}
                                  referenceKey={reference}
                                  disabled={!!direct.state.overrides[item.key]}
                                  label={m.label(item.key)}
                                  value={direct.state.refs[reference] ?? null}
                                  automaticId={
                                    field?.automatic_reference_id ?? null
                                  }
                                  automaticLabel={
                                    field?.automatic_reference_label ?? null
                                  }
                                  reason={direct.state.reasons[item.key] ?? ""}
                                  onChange={(value) =>
                                    direct.updateReference(reference, value)
                                  }
                                  onReason={(reason) =>
                                    direct.updateReference(
                                      reference,
                                      direct.state!.refs[reference] ?? null,
                                      reason,
                                    )
                                  }
                                />
                              ) : live &&
                                direct.state &&
                                item.overridePolicy === "with-reason" &&
                                !field?.hidden &&
                                !(
                                  contract.salaryHidden && item.key === "salary"
                                ) &&
                                !(
                                  contract.can_edit_salary === false &&
                                  item.key === "salary"
                                ) ? (
                                <ContractOverrideInput
                                  item={item}
                                  errorId={
                                    fieldError ? `error-${item.key}` : undefined
                                  }
                                  field={field}
                                  active={overrideActive}
                                  value={direct.state.overrides[item.key] ?? ""}
                                  reason={direct.state.reasons[item.key] ?? ""}
                                  onActivate={() => {
                                    setActiveOverrides((old) => ({
                                      ...old,
                                      [item.key]: true,
                                    }));
                                    direct.updateOverride(
                                      item.key,
                                      field?.automatic ?? "",
                                    );
                                  }}
                                  onReset={() => {
                                    setActiveOverrides((old) => ({
                                      ...old,
                                      [item.key]: false,
                                    }));
                                    direct.updateOverride(item.key, "");
                                  }}
                                  onValue={(value) =>
                                    direct.updateOverride(item.key, value)
                                  }
                                  onReason={(reason) =>
                                    direct.updateOverride(
                                      item.key,
                                      direct.state!.overrides[item.key] ?? "",
                                      reason,
                                    )
                                  }
                                />
                              ) : !fields ? (
                                m.loading
                              ) : field?.hidden ||
                                (contract.salaryHidden &&
                                  item.key === "salary") ? (
                                m.hidden
                              ) : (
                                field?.value || m.empty
                              )}
                            </dd>
                            {live &&
                            item.key === "probation_months" &&
                            direct.state?.revisions.probation_months !==
                              undefined ? (
                              <label className="grid gap-1 text-sm">
                                {m.reasonLabel}
                                <input
                                  className="rounded border border-border bg-background p-2"
                                  value={direct.state.probationReason}
                                  onChange={(event) =>
                                    direct.updateReason(event.target.value)
                                  }
                                />
                                {direct.issue === "reason_required" ? (
                                  <span>{m.reasonRequired}</span>
                                ) : null}
                              </label>
                            ) : null}
                            {live &&
                            item.key === "probation_months" &&
                            (field?.override ||
                              direct.state?.revisions.probation_months !==
                                undefined) ? (
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() =>
                                  direct.resetProbation(field?.automatic ?? "")
                                }
                              >
                                {m.reset}
                              </button>
                            ) : null}
                            {field ? (
                              <small className="inline-flex rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                                {legacyEditable
                                  ? m.storedOnContract
                                  : (field.source ?? `${m.from} ${item.owner}`)}
                              </small>
                            ) : null}
                            {fieldError ? (
                              <p
                                id={`error-${item.key}`}
                                role="alert"
                                className="text-sm text-destructive"
                              >
                                {fieldError}
                              </p>
                            ) : null}
                            {item.key === "salary" &&
                            contract.can_edit_salary === false &&
                            !contract.salaryHidden ? (
                              <p className="text-sm text-muted-foreground">
                                {m.salaryEditRestricted}
                              </p>
                            ) : null}
                            {field?.warning ? (
                              <p className="text-sm text-muted-foreground">
                                {field.warning}
                              </p>
                            ) : null}
                            {item.key === "employee_address" &&
                            live &&
                            direct.state?.overrides.employee_address &&
                            !field?.warning &&
                            !readiness?.warnings.employee_address &&
                            (() => {
                              const normalize = (value: string) =>
                                value
                                  .trim()
                                  .replace(/\s+/g, " ")
                                  .toLocaleLowerCase();
                              const company =
                                fields?.find(
                                  (entry) => entry.key === "company_address",
                                )?.value ?? "";
                              return (
                                !!normalize(company) &&
                                normalize(
                                  direct.state!.overrides.employee_address,
                                ) === normalize(company)
                              );
                            })() ? (
                              <p className="text-sm text-muted-foreground">
                                {m.addressMatchesCompany}
                              </p>
                            ) : null}
                            {readiness?.warnings[item.key] &&
                            readiness.warnings[item.key] !== field?.warning ? (
                              <p className="text-sm text-muted-foreground">
                                {readiness.warnings[item.key]}
                              </p>
                            ) : null}
                            {item.key === "salary" &&
                            field &&
                            !field.hidden &&
                            field.override &&
                            field.value !== field.automatic ? (
                              <p className="text-sm text-muted-foreground">
                                {m.salaryDiffers}
                              </p>
                            ) : null}
                            {item.key === "start_date" &&
                            draft &&
                            (live
                              ? direct.state?.values.start_date
                              : direct.state?.legacyValues.start_date) &&
                            (live
                              ? direct.state?.values.start_date
                              : direct.state?.legacyValues.start_date)! <
                              new Date().toLocaleDateString("en-CA") ? (
                              <p className="text-sm text-muted-foreground">
                                {m.startInPast}
                              </p>
                            ) : null}
                            {change ? (
                              <p className="text-xs text-muted-foreground">
                                {m.changedBy} {change.actor_name || m.empty},{" "}
                                {formatDateTime(change.at)}
                              </p>
                            ) : null}
                            {field?.override &&
                            !field.hidden &&
                            !(
                              contract.salaryHidden && item.key === "salary"
                            ) ? (
                              <p className="text-sm">
                                {m.edited} · {m.automatic}:{" "}
                                {field.automatic || m.empty} ·{" "}
                                {field.override_reason || m.noReason}
                              </p>
                            ) : hasReferenceOverride(item.key) ? (
                              <p className="text-sm">
                                {m.automatic}:{" "}
                                {field?.automatic_reference_label ?? m.empty}{" "}
                                &rarr; {m.overridden}: {field?.value || m.empty}{" "}
                                &middot; {field?.override_reason || m.noReason}
                              </p>
                            ) : null}
                            {live &&
                            field?.override &&
                            !field.hidden &&
                            !(contract.salaryHidden && item.key === "salary") &&
                            (item.overridePolicy === "none" ||
                              item.overridePolicy === "reference-only") &&
                            item.key !== "probation_months" ? (
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() =>
                                  direct.updateOverride(item.key, "")
                                }
                              >
                                {m.reset}
                              </button>
                            ) : null}
                            {legacy &&
                            field?.override &&
                            !field.hidden &&
                            !(contract.salaryHidden && item.key === "salary") &&
                            !(
                              contract.can_edit_salary === false &&
                              item.key === "salary"
                            ) ? (
                              <button
                                type="button"
                                className="text-primary underline"
                                onClick={() =>
                                  direct.updateOverride(item.key, "")
                                }
                              >
                                {m.reset}
                              </button>
                            ) : null}
                            {sourceHref ? (
                              <p>
                                <Link
                                  className="text-sm text-primary underline"
                                  href={sourceHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {item.owner === "company"
                                    ? m.fixCompany
                                    : item.owner === "employee"
                                      ? m.fixEmployee
                                      : m.sourceRecord}
                                </Link>
                              </p>
                            ) : null}
                          </div>
                        </MemoContractField>
                      );
                    })}
                </dl>
              )}
            </section>
          ))}
        </main>
        <aside className="hidden self-start lg:sticky lg:top-56 lg:block">
          {panel}
        </aside>
      </div>
    </div>
  );
}
