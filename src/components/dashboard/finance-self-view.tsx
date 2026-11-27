"use client";

import { SharedDashboardHeroBackground } from "@/components/dashboard/welcome-card-background"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import * as React from "react";
import { ApiError } from "@/lib/request-json";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth-session-store";
import {
  FinanceCheckpointSchema,
  FinanceInputSchema,
  resumeFinanceDraft,
  type FinanceCheckpoint,
} from "@/lib/finance-draft-workflow";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2Icon,
  FileTextIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store";
import {
  Avatar,
  Card as FluentCard,
  Text as FluentText,
  Badge as FluentBadge,
  Button,
  Checkbox,
  Field,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Tab,
  TabList,
} from "@fluentui/react-components";
import {
  Add20Regular,
  AppsList24Regular,
  ArrowLeft20Regular,
  ArrowClockwise20Regular,
  ArrowRight20Regular,
  CheckmarkCircle20Regular,
  DocumentBulletList24Regular,
  Person20Regular,
  TextBold20Regular,
  TextBulletListLtr20Regular,
  TextItalic20Regular,
  TextNumberListLtr20Regular,
  Wallet24Regular,
} from "@fluentui/react-icons";

import {
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  optionLabel,
  pageBleedClass,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  acceptMyFinanceApplication,
  addMyFinanceApplicationGuarantor,
  createMyFinanceApplication,
  decideMyFinanceGuarantorRequest,
  evaluateMyFinanceEligibility,
  fileToBase64UploadDto,
  listMyFinanceProducts,
  listMyFinanceAccounts,
  getMyFinanceAccountStatement,
  requestMyFinanceDeferment,
  updateMyFinanceApplication,
  downloadMyFinanceSanctionLetter,
  downloadMyFinanceStatement,
  listMyFinanceApplications,
  listMyFinanceApplicationDocuments,
  listMyFinanceApplicationGuarantors,
  listMyFinanceGuarantorRequests,
  searchMyFinanceGuarantorCandidates,
  submitMyFinanceApplication,
  uploadMyFinanceApplicationDocument,
  withdrawMyFinanceApplication,
  type AdminRecord,
} from "@/lib/admin-api";
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

const wizardSteps = ["Product", "Terms", "Support", "Review"];
const financeAmountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const guarantorFormType = "GUARANTOR_FORM";

function guarantorFormKey(employeeId: number) {
  return `${guarantorFormType}::${employeeId}`;
}

function friendlyFinanceError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (
    /requested_amount.*must match|requested amount.*regular expression/i.test(
      message,
    )
  ) {
    return "Enter a valid amount with up to two decimal places.";
  }
  if (
    /requested_term_months.*integer|requested term.*whole number/i.test(message)
  ) {
    return "Enter the repayment period as a whole number of months.";
  }
  if (/product_id.*(required|number|integer)/i.test(message)) {
    return "Select a finance product before continuing.";
  }
  if (/must match .*regular expression/i.test(message)) {
    return "Check the highlighted value and enter it in the expected format.";
  }

  return message;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function selectedProduct(products: AdminRecord[], productId?: string) {
  if (!productId) return null;
  return products.find((product) => rowId(product) === productId) ?? null;
}

function productRequiredDocuments(product: AdminRecord | null) {
  if (!product) return [];
  return readStringArray(
    product.requiredDocumentTypes ?? product.required_document_types,
  ).map((value) => value.toUpperCase());
}

function productRequiredGuarantors(
  product: AdminRecord | null,
  eligibility: AdminRecord | null,
) {
  const fromEligibility = readNumber(eligibility, [
    "requiredGuarantorCount",
    "required_guarantor_count",
  ]);
  if (fromEligibility !== null) return fromEligibility;
  const approval = asRecord(
    product?.approvalConfiguration ?? product?.approval_configuration,
  );
  return (
    readNumber(approval, [
      "required_guarantor_count",
      "requiredGuarantorCount",
      "guarantor_count",
    ]) ?? 0
  );
}

function recordIdFromPayload(payload: unknown) {
  const direct = asRecord(payload);
  const nested = asRecord(direct?.data);
  return rowId(nested) || rowId(direct);
}

function parseGuarantorIds(value?: string) {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(Number)
    .filter((entry) => Number.isSafeInteger(entry) && entry > 0);
}

function moneyValue(row: AdminRecord | null | undefined, keys: string[]) {
  const value = readString(row, keys, "0.00");
  return value === "0.00" ? "0.00" : value;
}

function eligibilityChecks(eligibility: AdminRecord | null) {
  return asRecordArray(eligibility?.checks);
}

function guarantorCandidateLabel(candidate: AdminRecord) {
  const firstName = readString(candidate, ["firstName", "first_name"]);
  const middleName = readString(candidate, ["middleName", "middle_name"]);
  const lastName = readString(candidate, ["lastName", "last_name"]);
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const employeeNumber = readString(candidate, ["employeeNo", "employee_no"]);

  if (fullName && employeeNumber) return `${fullName} · ${employeeNumber}`;
  return fullName || employeeNumber || "Employee";
}

function escapePurposeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function purposeMarkdownToHtml(value: string) {
  const inline = (text: string) =>
    escapePurposeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
  const lines = value.split("\n");
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const unordered = /^-\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = /^-\s+(.*)$/.exec(lines[index]);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        index += 1;
      }
      output.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = /^\d+\.\s+(.*)$/.exec(lines[index]);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        index += 1;
      }
      output.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    output.push(line ? `<div>${inline(line)}</div>` : "<div><br></div>");
    index += 1;
  }
  return output.join("");
}

function purposeEditorToMarkdown(root: HTMLElement) {
  const renderInline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const content = Array.from(node.childNodes).map(renderInline).join("");
    if (node.tagName === "BR") return "\n";
    if (node.tagName === "B" || node.tagName === "STRONG") {
      return `**${content}**`;
    }
    if (node.tagName === "I" || node.tagName === "EM") {
      return `_${content}_`;
    }
    return content;
  };

  return Array.from(root.childNodes)
    .map((node) => {
      if (!(node instanceof HTMLElement)) return renderInline(node);
      if (node.tagName === "UL" || node.tagName === "OL") {
        return Array.from(node.children)
          .map((item, index) => {
            const marker = node.tagName === "OL" ? `${index + 1}.` : "-";
            return `${marker} ${Array.from(item.childNodes).map(renderInline).join("")}`;
          })
          .join("\n");
      }
      return renderInline(node);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function PurposeRichTextEditor({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const html = purposeMarkdownToHtml(value);
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [value]);

  const runCommand = (command: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) onChange(purposeEditorToMarkdown(editorRef.current));
  };

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30">
      <div
        role="toolbar"
        aria-label="Purpose formatting"
        className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1"
      >
        {[
          ["Bold", "bold", <TextBold20Regular key="bold" />],
          ["Italic", "italic", <TextItalic20Regular key="italic" />],
          [
            "Bulleted list",
            "insertUnorderedList",
            <TextBulletListLtr20Regular key="bullets" />,
          ],
          [
            "Numbered list",
            "insertOrderedList",
            <TextNumberListLtr20Regular key="numbers" />,
          ],
        ].map(([label, command, icon]) => (
          <Button
            key={String(command)}
            type="button"
            appearance="subtle"
            size="small"
            icon={icon as React.ReactElement}
            aria-label={String(label)}
            title={String(label)}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(String(command))}
          />
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          Rich text
        </span>
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-label="Purpose"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder="Describe what the funds will be used for"
        className="min-h-28 px-3 py-2 text-sm leading-6 text-foreground outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc"
        onInput={(event) =>
          onChange(purposeEditorToMarkdown(event.currentTarget))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const selection = window.getSelection();
            const anchor = selection?.anchorNode;
            const anchorElement =
              anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
            const listItem = anchorElement?.closest("li");
            if (listItem?.textContent?.trim()) {
              event.preventDefault();
              document.execCommand("insertParagraph");
              window.requestAnimationFrame(() => {
                if (editorRef.current) {
                  onChange(purposeEditorToMarkdown(editorRef.current));
                }
              });
              return;
            }
          }
          if (!(event.ctrlKey || event.metaKey)) return;
          const key = event.key.toLowerCase();
          if (key === "b" || key === "i") {
            event.preventDefault();
            runCommand(key === "b" ? "bold" : "italic");
          }
        }}
      />
    </div>
  );
}

function FinanceSectionHeader({ title, description, count, icon }: {
  title: string;
  description: string;
  count: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
      <span aria-hidden="true" className="shrink-0 text-primary [&_svg]:size-6">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {count !== null ? <FluentBadge appearance="tint" color="brand" aria-label={`${count} ${title.toLowerCase()}`}>{count}</FluentBadge> : null}
    </div>
  );
}

function FinanceEmptyState({ title, description, icon }: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-5 py-7 text-center">
      <span aria-hidden="true" className="mb-1 text-primary/70 [&_svg]:size-10">{icon}</span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function FinanceSelfView() {
  const [financeTab, setFinanceTab] = React.useState("applications");
  const financeTabsId = React.useId();
  const [sortContainer, setSortContainer] = React.useState<HTMLDivElement | null>(null);
  const leaveIfForbidden = useLeaveIfForbidden();
  const session = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const [checkpoint, setCheckpoint] = React.useState<FinanceCheckpoint | null>(
    null,
  );
  const checkpointRef = React.useRef<FinanceCheckpoint | null>(null);
  const mountedRef = React.useRef(false);
  const createInFlight = React.useRef(false);
  const loadSequence = React.useRef(0);
  const recoveryKey =
    session.subject && session.companyId
      ? `hrms.finance.draft:${session.subject}:${session.companyId}`
      : null;
  const [applications, setApplications] = React.useState<AdminRecord[]>([]);
  const [products, setProducts] = React.useState<AdminRecord[]>([]);
  const [guarantorRequests, setGuarantorRequests] = React.useState<
    AdminRecord[]
  >([]);
  const [guarantorCandidates, setGuarantorCandidates] = React.useState<
    AdminRecord[]
  >([]);
  const [guarantorSearch, setGuarantorSearch] = React.useState("");
  const [guarantorSearchLoading, setGuarantorSearchLoading] =
    React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [wizardStep, setWizardStep] = React.useState(0);
  const [eligibility, setEligibility] = React.useState<AdminRecord | null>(
    null,
  );
  const [eligibilityLoading, setEligibilityLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [documentFiles, setDocumentFiles] = React.useState<
    Record<string, File | null>
  >({});
  const [accounts, setAccounts] = React.useState<AdminRecord[]>([]);
  const [correctTarget, setCorrectTarget] = React.useState<AdminRecord | null>(
    null,
  );
  const [correctForm, setCorrectForm] = React.useState<Record<string, string>>(
    {},
  );
  const [deferTarget, setDeferTarget] = React.useState<{
    account: AdminRecord;
    installment: AdminRecord;
  } | null>(null);
  const [deferReason, setDeferReason] = React.useState("");

  const load = React.useCallback(
    async (isActive: () => boolean = () => mountedRef.current) => {
      const current = getSessionSnapshot();
      const token = current.tokens?.accessToken;
      const sequence = ++loadSequence.current;
      const active = () =>
        isActive() &&
        sequence === loadSequence.current &&
        getSessionSnapshot().credentialVersion === current.credentialVersion;
      if (!token) {
        if (active()) {
          setError("Authentication required. Please log in again.");
          setLoading(false);
        }
        return;
      }
      if (!active()) return;
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        listMyFinanceApplications(token),
        listMyFinanceProducts(token),
        listMyFinanceGuarantorRequests(token),
        listMyFinanceAccounts(token),
      ]);
      if (!active()) return;
      if (results[3].status === "fulfilled") setAccounts(results[3].value);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") {
        if (!leaveIfForbidden(failed.reason))
          setError(
            failed.reason instanceof Error
              ? failed.reason.message
              : "Could not load finance data.",
          );
      }
      if (results[0].status === "fulfilled") setApplications(results[0].value);
      if (results[1].status === "fulfilled") setProducts(results[1].value);
      if (results[2].status === "fulfilled")
        setGuarantorRequests(results[2].value);
      setLoading(false);
    },
    [leaveIfForbidden],
  );

  React.useEffect(() => {
    let active = true;
    mountedRef.current = true;
    setMounted(true);
    void load(() => active);
    return () => {
      active = false;
      mountedRef.current = false;
      loadSequence.current += 1;
    };
  }, [load, session.credentialVersion]);

  React.useEffect(() => {
    const search = guarantorSearch.trim();
    if (!createOpen || wizardStep !== 2 || search.length < 2) {
      setGuarantorSearchLoading(false);
      return;
    }

    const token = readStoredToken();
    if (!token) return;
    let active = true;
    setGuarantorSearchLoading(true);
    const timeout = window.setTimeout(() => {
      void searchMyFinanceGuarantorCandidates(token, search)
        .then((candidates) => {
          if (!active) return;
          setGuarantorCandidates((current) => {
            const merged = new Map(
              current.map((candidate) => [rowId(candidate), candidate]),
            );
            candidates.forEach((candidate) =>
              merged.set(rowId(candidate), candidate),
            );
            return [...merged.values()];
          });
        })
        .catch((errorObject) => {
          if (active) {
            toast.error(
              errorObject instanceof Error
                ? errorObject.message
                : "Could not search employees.",
            );
          }
        })
        .finally(() => {
          if (active) setGuarantorSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [createOpen, guarantorSearch, wizardStep]);

  React.useEffect(() => {
    checkpointRef.current = null;
    setCheckpoint(null);
    setForm({});
    setDocumentFiles({});
    setCreateOpen(false);
    setApplications([]);
    setProducts([]);
    setGuarantorRequests([]);
    if (!recoveryKey) return;
    try {
      const raw = window.sessionStorage.getItem(recoveryKey);
      if (!raw) return;
      const restored = FinanceCheckpointSchema.parse(JSON.parse(raw));
      checkpointRef.current = restored;
      setCheckpoint(restored);
      setForm(restored.form);
      setWizardStep(3);
      setCreateOpen(true);
    } catch {
      window.sessionStorage.removeItem(recoveryKey);
    }
  }, [recoveryKey]);

  const currentProduct = React.useMemo(
    () => selectedProduct(products, form.product_id),
    [products, form.product_id],
  );
  const requiredDocuments = React.useMemo(
    () => productRequiredDocuments(currentProduct),
    [currentProduct],
  );
  const requiredGuarantors = productRequiredGuarantors(
    currentProduct,
    eligibility,
  );
  const guarantorIds = [
    ...new Set(parseGuarantorIds(form.guarantor_employee_ids)),
  ];
  const guarantorCandidateById = new Map(
    guarantorCandidates.map((candidate) => [rowId(candidate), candidate]),
  );
  const requiresGuarantorForms = requiredDocuments.some(
    (type) => type.trim().toUpperCase() === guarantorFormType,
  );
  const ordinaryRequiredDocuments = requiredDocuments.filter(
    (type) => type.trim().toUpperCase() !== guarantorFormType,
  );
  const requiredDocumentKeys = [
    ...ordinaryRequiredDocuments,
    ...(requiresGuarantorForms ? guarantorIds.map(guarantorFormKey) : []),
  ];
  const checks = eligibilityChecks(eligibility);
  const eligible = eligibility
    ? readString(eligibility, ["eligible"]) === "true"
    : false;
  const canCreate =
    checkpoint !== null ||
    (Boolean(
      form.product_id &&
      form.requested_amount &&
      form.requested_term_months &&
      form.purpose,
    ) &&
      requiredDocumentKeys.every((type) => Boolean(documentFiles[type])) &&
      guarantorIds.length >= requiredGuarantors);

  function wizardStepError(step: number) {
    if (step === 0) {
      return currentProduct ? null : "Select a finance product to continue.";
    }
    if (step === 1) {
      if (!financeAmountPattern.test(form.requested_amount ?? "")) {
        return "Enter a valid amount with up to two decimal places.";
      }
      const term = Number(form.requested_term_months);
      if (!Number.isSafeInteger(term) || term < 1) {
        return "Enter the repayment period as a whole number of months.";
      }
      if (!form.purpose?.trim()) {
        return "Describe what the loan or advance will be used for.";
      }
      if (eligibilityLoading) {
        return "Please wait while eligibility is being checked.";
      }
      if (!eligibility) {
        return "Eligibility could not be confirmed yet. Check the amount and term.";
      }
      if (!eligible) {
        return "The eligibility requirements must pass before continuing.";
      }
      return null;
    }
    if (step === 2) {
      if (guarantorIds.length < requiredGuarantors) {
        return `Select at least ${requiredGuarantors} guarantor${requiredGuarantors === 1 ? "" : "s"}.`;
      }
      const missingDocuments = requiredDocumentKeys.filter(
        (type) => !documentFiles[type],
      );
      if (missingDocuments.length) {
        return "Upload every required document and guarantor form before reviewing.";
      }
    }
    return null;
  }

  function moveToWizardStep(target: number) {
    if (target <= wizardStep) {
      setFormError(null);
      setWizardStep(target);
      return;
    }
    for (let step = wizardStep; step < target; step += 1) {
      const message = wizardStepError(step);
      if (message) {
        setFormError(message);
        setWizardStep(step);
        return;
      }
    }
    setFormError(null);
    setWizardStep(target);
  }

  const currentWizardStepBlocked = Boolean(wizardStepError(wizardStep));

  React.useEffect(() => {
    let active = true;
    const token = readStoredToken();
    setEligibility(null);
    setEligibilityLoading(false);
    if (
      !createOpen ||
      !token ||
      !form.product_id ||
      !form.requested_amount ||
      !form.requested_term_months
    ) {
      return () => {
        active = false;
      };
    }
    if (!financeAmountPattern.test(form.requested_amount)) {
      setFormError("Enter a valid amount with up to two decimal places.");
      return () => {
        active = false;
      };
    }
    setFormError((current) =>
      current === "Enter a valid amount with up to two decimal places."
        ? null
        : current,
    );
    const timer = window.setTimeout(() => {
      if (!active) return;
      setEligibilityLoading(true);
      evaluateMyFinanceEligibility(token, {
        product_id: Number(form.product_id),
        requested_amount: form.requested_amount,
        requested_term_months: Number(form.requested_term_months),
      })
        .then((value) => {
          if (active) setEligibility(value);
        })
        .catch((error) => {
          if (active) {
            setEligibility(null);
            setFormError(
              friendlyFinanceError(error, "Could not evaluate eligibility."),
            );
          }
        })
        .finally(() => {
          if (active) setEligibilityLoading(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    createOpen,
    form.product_id,
    form.requested_amount,
    form.requested_term_months,
    session.credentialVersion,
  ]);

  async function handleCreateApplication(startedAt: number) {
    if (createInFlight.current || !recoveryKey) return;
    const actor = getSessionSnapshot();
    const token = actor.tokens?.accessToken;
    if (!token) return;
    const isActive = () =>
      mountedRef.current &&
      getSessionSnapshot().credentialVersion === actor.credentialVersion;
    createInFlight.current = true;
    setSaving(true);
    setFormError(null);
    const save = (next: FinanceCheckpoint) => {
      if (!isActive()) return;
      checkpointRef.current = next;
      setCheckpoint(next);
      window.sessionStorage.setItem(recoveryKey, JSON.stringify(next));
    };
    try {
      let initial = checkpointRef.current;
      if (!initial) {
        const missingDocuments = requiredDocumentKeys.filter(
          (type) => !documentFiles[type],
        );
        if (missingDocuments.length)
          throw new Error(
            `Choose required documents: ${missingDocuments.join(", ")}.`,
          );
        const payload = FinanceInputSchema.parse({
          product_id: Number(form.product_id),
          requested_amount: form.requested_amount,
          requested_term_months: Number(form.requested_term_months),
          purpose: form.purpose,
        });
        if (guarantorIds.length < requiredGuarantors)
          throw new Error(`Add at least ${requiredGuarantors} guarantors.`);
        if (eligibility && !eligible)
          throw new Error("Eligibility checks are not passing yet.");
        initial = {
          payload,
          form: { ...form },
          requiredDocuments: requiredDocumentKeys,
          guarantorIds,
          autoSubmit: form.auto_submit === "true",
          draftId: null,
          startedAt,
          creationPending: false,
          completedDocuments: [],
          completedGuarantors: [],
          submitted: false,
        };
        save(initial);
      }
      const completed = await resumeFinanceDraft(
        initial,
        documentFiles,
        {
          create: async (payload) =>
            recordIdFromPayload(
              await createMyFinanceApplication(token, payload),
            ),
          applications: () => listMyFinanceApplications(token),
          documents: (id) => listMyFinanceApplicationDocuments(token, id),
          guarantors: (id) => listMyFinanceApplicationGuarantors(token, id),
          upload: async (id, type, file) => {
            const [documentType, guarantorEmployeeId] = type.split("::");
            return uploadMyFinanceApplicationDocument(token, id, {
              document_type: documentType,
              file: await fileToBase64UploadDto(file),
              ...(guarantorEmployeeId
                ? {
                    metadata: {
                      guarantor_employee_id: Number(guarantorEmployeeId),
                    },
                  }
                : {}),
            });
          },
          addGuarantor: (id, employeeId) =>
            addMyFinanceApplicationGuarantor(token, id, {
              guarantor_employee_id: employeeId,
            }),
          submit: (id) => submitMyFinanceApplication(token, id),
        },
        save,
        isActive,
      );
      if (!isActive()) return;
      window.sessionStorage.removeItem(recoveryKey);
      checkpointRef.current = null;
      setCheckpoint(null);
      toast.success(
        completed.submitted ? "Application submitted." : "Application created.",
      );
      setCreateOpen(false);
      setForm({});
      setDocumentFiles({});
      setWizardStep(0);
      setEligibility(null);
      await load(isActive);
    } catch (error) {
      if (isActive()) {
        if (
          error instanceof ApiError &&
          !checkpointRef.current?.draftId &&
          !checkpointRef.current?.creationPending
        ) {
          checkpointRef.current = null;
          setCheckpoint(null);
          window.sessionStorage.removeItem(recoveryKey);
        }
        setFormError(
          friendlyFinanceError(error, "Could not complete the application."),
        );
      }
    } finally {
      createInFlight.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "app",
        label: "Application",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(row, ["purpose"], `Application #${rowId(row)}`)}
            </p>
            <p className="text-xs text-muted-foreground">
              {prettify(readString(row, ["productType", "product_type"], ""))}
            </p>
          </div>
        ),
      },
      {
        key: "amount",
        label: "Amount",
        render: (row) =>
          readString(row, ["requestedAmount", "requested_amount"], "—"),
      },
      {
        key: "term",
        label: "Term",
        render: (row) =>
          readString(
            row,
            ["requestedTermMonths", "requested_term_months"],
            "—",
          ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "DRAFT")} />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row);
          const status = readString(row, ["status"], "DRAFT").toUpperCase();
          const inProgress = [
            "DRAFT",
            "RETURNED_FOR_CORRECTION",
            "PENDING_MANAGER_RECOMMENDATION",
            "PENDING_HR_APPROVAL",
            "PENDING_FINANCE_APPROVAL",
            "PENDING_MANAGEMENT_APPROVAL",
            "PENDING_EMPLOYEE_ACCEPTANCE",
          ].includes(status);
          return (
            <div className="flex flex-wrap items-center gap-1">
              {status === "RETURNED_FOR_CORRECTION" ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  title={readString(
                    row,
                    ["decisionComments", "decision_comments"],
                    "",
                  )}
                  onClick={() => {
                    setCorrectTarget(row);
                    setCorrectForm({
                      requested_amount: readString(
                        row,
                        ["requestedAmount", "requested_amount"],
                        "",
                      ),
                      requested_term_months: readString(
                        row,
                        ["requestedTermMonths", "requested_term_months"],
                        "",
                      ),
                      purpose: readString(row, ["purpose"], ""),
                    });
                  }}
                >
                  Correct &amp; resubmit
                </button>
              ) : null}
              {status === "PENDING_EMPLOYEE_ACCEPTANCE" ||
              status === "APPROVED" ||
              status === "DISBURSED" ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={() => {
                    const token = readStoredToken();
                    if (!token || !id) return;
                    void downloadMyFinanceSanctionLetter(token, id)
                      .then((file) => {
                        const url = URL.createObjectURL(file.blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = file.filename;
                        link.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch((errorObject) =>
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not download the letter.",
                        ),
                      );
                  }}
                >
                  Sanction letter
                </button>
              ) : null}
              {status !== "DRAFT" ? null : (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `sub-${id}`}
                  onClick={() => {
                    const token = readStoredToken();
                    if (!token || !id) return;
                    setBusyId(`sub-${id}`);
                    void submitMyFinanceApplication(token, id)
                      .then(() => {
                        toast.success("Submitted.");
                        return load();
                      })
                      .catch((errorObject) =>
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not submit.",
                        ),
                      )
                      .finally(() => setBusyId(""));
                  }}
                >
                  Submit
                </button>
              )}
              {status !== "PENDING_EMPLOYEE_ACCEPTANCE" ? null : (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `acc-${id}`}
                  onClick={() => {
                    const token = readStoredToken();
                    if (!token || !id) return;
                    setBusyId(`acc-${id}`);
                    void acceptMyFinanceApplication(token, id)
                      .then(() => {
                        toast.success("Accepted.");
                        return load();
                      })
                      .catch((errorObject) =>
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not accept.",
                        ),
                      )
                      .finally(() => setBusyId(""));
                  }}
                >
                  Accept
                </button>
              )}
              {!inProgress ? null : (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `wd-${id}`}
                  onClick={() => {
                    const token = readStoredToken();
                    if (!token || !id) return;
                    setBusyId(`wd-${id}`);
                    void withdrawMyFinanceApplication(token, id)
                      .then(() => {
                        toast.success("Withdrawn.");
                        return load();
                      })
                      .catch((errorObject) =>
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not withdraw.",
                        ),
                      )
                      .finally(() => setBusyId(""));
                  }}
                >
                  Withdraw
                </button>
              )}
              {status === "RETURNED_FOR_CORRECTION" &&
              readString(row, ["decisionComments", "decision_comments"], "") ? (
                <span className="w-full text-xs text-amber-700">
                  Returned:{" "}
                  {readString(row, ["decisionComments", "decision_comments"])}
                </span>
              ) : null}
              {status === "REJECTED" &&
              readString(row, ["decisionComments", "decision_comments"], "") ? (
                <span className="w-full text-xs text-rose-700">
                  Declined:{" "}
                  {readString(row, ["decisionComments", "decision_comments"])}
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    [busyId, load],
  );

  async function submitCorrection() {
    const token = readStoredToken();
    const id = rowId(correctTarget);
    if (!token || !id) return;
    setBusyId(`fix-${id}`);
    try {
      await updateMyFinanceApplication(token, id, {
        requested_amount: correctForm.requested_amount || undefined,
        requested_term_months: correctForm.requested_term_months
          ? Number(correctForm.requested_term_months)
          : undefined,
        purpose: correctForm.purpose || undefined,
      });
      await submitMyFinanceApplication(token, id);
      toast.success("Corrected and resubmitted.");
      setCorrectTarget(null);
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not resubmit.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function openDeferment(account: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(account);
    if (!token || !id) return;
    try {
      const statement = await getMyFinanceAccountStatement(token, id);
      const installments = Array.isArray(statement?.installments)
        ? (statement.installments as AdminRecord[])
        : [];
      const next = installments
        .filter((item) =>
          ["SCHEDULED", "PARTIALLY_PAID", "OVERDUE"].includes(
            readString(item, ["status"], "").toUpperCase(),
          ),
        )
        .sort((a, b) =>
          readString(a, ["dueDate", "due_date"]).localeCompare(
            readString(b, ["dueDate", "due_date"]),
          ),
        )[0];
      if (!next) {
        toast.error("There is no unpaid instalment to defer.");
        return;
      }
      setDeferReason("");
      setDeferTarget({ account, installment: next });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load the loan.",
      );
    }
  }

  async function submitDeferment() {
    const token = readStoredToken();
    if (!token || !deferTarget) return;
    setBusyId("defer");
    try {
      await requestMyFinanceDeferment(token, rowId(deferTarget.account), {
        installment_id: Number(rowId(deferTarget.installment)),
        reason: deferReason.trim(),
      });
      toast.success("Request sent to Finance for approval.");
      setDeferTarget(null);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not send the request.",
      );
    } finally {
      setBusyId("");
    }
  }

  const guarantorColumns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "request",
        label: "Request",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(
                asRecord(
                  row.application ??
                    row.applicationSnapshot ??
                    row.application_snapshot,
                ),
                ["purpose"],
                `Guarantee #${rowId(row)}`,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Applicant{" "}
              {readString(
                row,
                ["applicantEmployeeId", "applicant_employee_id"],
                "unknown",
              )}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "PENDING")} />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row);
          const status = readString(row, ["status"], "PENDING").toUpperCase();
          if (status !== "PENDING")
            return (
              <span className="text-xs text-muted-foreground">Completed</span>
            );
          return (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `guar-a-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`guar-a-${id}`);
                  void decideMyFinanceGuarantorRequest(token, id, {
                    decision: "APPROVED",
                  })
                    .then(() => {
                      toast.success("Guarantee accepted.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not accept request.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Accept
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `guar-r-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`guar-r-${id}`);
                  void decideMyFinanceGuarantorRequest(token, id, {
                    decision: "REJECTED",
                  })
                    .then(() => {
                      toast.success("Guarantee rejected.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not reject request.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Reject
              </button>
            </div>
          );
        },
      },
    ],
    [busyId, load],
  );

  return (
    <section className="pb-8">
      <TalentDoodleSprites />
      <div className={pageBleedClass}>
      <FluentCard
        className={`relative overflow-hidden !rounded-none !border-x-0 !border-y !border-border !bg-card !p-0 shadow-sm`}
      >
        <SharedDashboardHeroBackground />
        <header className="relative flex flex-wrap items-center justify-between gap-5 px-5 py-5 text-foreground sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Wallet24Regular className="size-9 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Loans &amp; advances</h1>
                <FluentBadge
                  appearance="ghost"
                  color="informative"
                  className="!gap-2 !rounded-none !px-1 !font-medium !text-foreground"
                  icon={<span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current ring-[3px] ring-current/10" />}
                >
                  {applications.length ? `${applications.length} applications` : "Ready for your first application"}
                </FluentBadge>
              </div>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>Welcome back,</span>
                <span className="relative isolate inline-block break-words pb-1 text-xl font-semibold tracking-tight text-foreground after:absolute after:inset-x-0 after:bottom-1 after:-z-10 after:h-2 after:-rotate-2 after:rounded-sm after:bg-primary/15 sm:text-2xl">
                  {session.user?.fullName?.split(" ")[0] || "there"}
                </span>
              </p>
            </div>
          </div>
          <Button
            appearance="subtle"
            size="large"
            className="!ml-auto !size-11 !min-w-11 !shrink-0 !text-foreground hover:!bg-primary/10 disabled:!opacity-50 [&_svg]:!size-6"
            aria-label={mounted && loading ? "Refreshing loans and advances" : "Refresh loans and advances"}
            title="Refresh loans and advances"
            aria-busy={mounted && loading}
            icon={mounted && loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <ArrowClockwise20Regular />}
            disabled={mounted ? loading || !session.tokens?.accessToken : undefined}
            onClick={() => void load()}
          />
        </header>
      </FluentCard>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Applications", value: applications.length, detail: "Your finance requests", icon: DocumentBulletList24Regular, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Available products", value: products.length, detail: "Loans and advances to explore", icon: AppsList24Regular, tone: "text-sky-600 dark:text-sky-400" },
          { label: "Open", value: applications.filter((row) => !["WITHDRAWN", "REJECTED", "CLOSED"].includes(readString(row, ["status"]).toUpperCase())).length, detail: "Applications being tracked", icon: CheckmarkCircle20Regular, tone: "text-amber-600 dark:text-amber-400" },
          { label: "Guarantee requests", value: guarantorRequests.length, detail: "Requests from colleagues", icon: Wallet24Regular, tone: "text-rose-600 dark:text-rose-400" },
        ].map((item) => (
            <FluentCard key={item.label} className="relative isolate min-w-0 overflow-hidden !rounded-none !border-0 !border-b !border-r !border-border !gap-1 !px-5 !py-3 !shadow-none sm:!px-6">
              <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${item.tone}`}>
                <div className="absolute -right-12 -top-16 size-56 rounded-full border-[28px] border-current opacity-[0.06]" />
                <div className="absolute right-6 top-8 size-28 rounded-full border border-current opacity-[0.12]" />
                <div className="absolute -bottom-10 right-20 h-40 w-20 rotate-[25deg] bg-current opacity-[0.035]" />
                <div className="absolute left-[55%] top-8 h-20 w-px rotate-[38deg] bg-current opacity-[0.12]" />
                <div className="absolute left-[58%] top-10 size-1.5 rounded-full bg-current opacity-[0.15]" />
                <div className="absolute left-[62%] top-16 size-1 rounded-full bg-current opacity-[0.12]" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <FluentText size={200} weight="semibold" className="!text-muted-foreground">
                  {item.label}
                </FluentText>
                <item.icon className={`size-5 ${item.tone}`} />
              </div>
              <FluentText size={500} weight="semibold" className="!my-0 !block !tracking-tight !text-foreground tabular-nums">
                {item.value}
              </FluentText>
              <FluentText size={200} className="!mt-0 !block !text-muted-foreground">
                {item.detail}
              </FluentText>
            </FluentCard>
        ))}
      </div>
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <div className={`${pageBleedClass} flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-2 pr-4 sm:pr-5`}>
        <div className="max-w-full overflow-x-auto">
        <TabList
          aria-label="Loans and advances sections"
          selectedValue={financeTab}
          onTabSelect={(_event, data) => setFinanceTab(String(data.value))}
          className="min-w-max"
        >
          {[
            { key: "applications", label: "My applications", count: applications.length, icon: <DocumentBulletList24Regular /> },
            { key: "guarantees", label: "Guarantee requests", count: guarantorRequests.length, icon: <Person20Regular /> },
            { key: "loans", label: "My loans", count: accounts.length, icon: <Wallet24Regular /> },
          ].map((tab) => (
            <Tab key={tab.key} value={tab.key} icon={tab.icon}
              id={`${financeTabsId}-${tab.key}-tab`}
              aria-controls={`${financeTabsId}-${tab.key}-panel`}>
              <span className="flex items-center gap-2">
                {tab.label}
                {!loading ? <FluentBadge size="small" appearance="tint" color={financeTab === tab.key ? "brand" : "subtle"}>{tab.count}</FluentBadge> : null}
              </span>
            </Tab>
          ))}
        </TabList>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div ref={setSortContainer} />
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            className="self-end sm:self-auto"
            onClick={() => {
              if (checkpointRef.current) {
                setCreateOpen(true);
                return;
              }
              setForm({});
              setDocumentFiles({});
              setWizardStep(0);
              setEligibility(null);
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            {checkpoint ? "Resume application" : "New application"}
          </Button>
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${financeTabsId}-applications-panel`}
        aria-labelledby={`${financeTabsId}-applications-tab`}
        hidden={financeTab !== "applications"}
        tabIndex={0}
        className={`${pageBleedClass} overflow-hidden border-y border-border bg-background`}
      >
        <FinanceSectionHeader
          title="My applications"
          description="Drafts and submitted requests appear here."
          count={loading ? null : applications.length}
          icon={<DocumentBulletList24Regular />}
        />
        <ResizableTable
          title="My applications"
          data={applications}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          showToolbar={true}
          toolbarClassName="!mb-0"
          sortIconOnly
          frameClassName="!rounded-none !border-0 !shadow-none"
          emptyContent={<FinanceEmptyState
            title="Your next step starts here"
            description="Select New application to explore products and send a request."
            icon={<DocumentBulletList24Regular />}
          />}
          sortContainer={financeTab === "applications" ? sortContainer : null}
          storageKey="me-finance-applications"
        />
      </div>
      <div
        role="tabpanel"
        id={`${financeTabsId}-guarantees-panel`}
        aria-labelledby={`${financeTabsId}-guarantees-tab`}
        hidden={financeTab !== "guarantees"}
        tabIndex={0}
        className={`${pageBleedClass} overflow-hidden border-y border-border bg-background`}
      >
        <FinanceSectionHeader
          title="Guarantee requests"
          description="Requests from colleagues who selected you as guarantor."
          count={loading ? null : guarantorRequests.length}
          icon={<Person20Regular />}
        />
        <ResizableTable
          title="My guarantor requests"
          data={guarantorRequests}
          columns={guarantorColumns}
          loading={loading}
          itemsPerPage={10}
          showExport={false}
          showToolbar={true}
          toolbarClassName="!mb-0"
          sortIconOnly
          frameClassName="!rounded-none !border-0 !shadow-none"
          emptyContent={<FinanceEmptyState
            title="You’re all caught up"
            description="When a colleague asks you to be their guarantor, their request will appear here."
            icon={<Person20Regular />}
          />}
          sortContainer={financeTab === "guarantees" ? sortContainer : null}
          storageKey="me-finance-guarantor-requests"
        />
      </div>
      <div
        role="tabpanel"
        id={`${financeTabsId}-loans-panel`}
        aria-labelledby={`${financeTabsId}-loans-tab`}
        hidden={financeTab !== "loans"}
        tabIndex={0}
        className={`${pageBleedClass} overflow-hidden border-y border-border bg-background`}
      >
        <FinanceSectionHeader
          title="My loans"
          description="Active accounts, balances, and statements."
          count={loading ? null : accounts.length}
          icon={<Wallet24Regular />}
        />
        <ResizableTable
          title="My loans"
          data={accounts}
          columns={[
            {
              key: "account",
              label: "Loan",
              render: (row) => (
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {readString(
                      row,
                      ["accountNo", "account_no"],
                      `Loan #${rowId(row)}`,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {prettify(
                      readString(row, ["productType", "product_type"], ""),
                    )}
                  </p>
                </div>
              ),
            },
            {
              key: "outstanding",
              label: "Outstanding",
              render: (row) =>
                readString(
                  row,
                  ["outstandingTotal", "outstanding_total"],
                  "0.00",
                ),
            },
            {
              key: "installment",
              label: "Monthly",
              render: (row) =>
                readString(
                  row,
                  [
                    "scheduledMonthlyInstallment",
                    "scheduled_monthly_installment",
                  ],
                  "—",
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <StatusChip value={readString(row, ["status"], "ACTIVE")} />
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => {
                      const token = readStoredToken();
                      if (!token) return;
                      void downloadMyFinanceStatement(token, rowId(row), "pdf")
                        .then((file) => {
                          const url = URL.createObjectURL(file.blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = file.filename;
                          link.click();
                          URL.revokeObjectURL(url);
                        })
                        .catch((errorObject) =>
                          toast.error(
                            errorObject instanceof Error
                              ? errorObject.message
                              : "Could not download the statement.",
                          ),
                        );
                    }}
                  >
                    Statement
                  </button>
                  {["ACTIVE", "IN_ARREARS", "RESTRUCTURED"].includes(
                    readString(row, ["status"], "").toUpperCase(),
                  ) ? (
                    <button
                      type="button"
                      className={actionButtonClass}
                      onClick={() => void openDeferment(row)}
                    >
                      Ask to defer next instalment
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          loading={loading}
          itemsPerPage={10}
          showExport={false}
          showToolbar={true}
          toolbarClassName="!mb-0"
          sortIconOnly
          frameClassName="!rounded-none !border-0 !shadow-none"
          emptyContent={<FinanceEmptyState
            title="Your loans, in one place"
            description="Once you have an active loan, track its balance, monthly repayments, and statements here."
            icon={<Wallet24Regular />}
          />}
          sortContainer={financeTab === "loans" ? sortContainer : null}
          storageKey="me-finance-accounts"
        />
      </div>

      <Dialog
        open={Boolean(correctTarget)}
        onOpenChange={(open) => !open && setCorrectTarget(null)}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Correct and resubmit</DialogTitle>
          </DialogHeader>
          {readString(
            correctTarget,
            ["decisionComments", "decision_comments"],
            "",
          ) ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {readString(correctTarget, [
                "decisionComments",
                "decision_comments",
              ])}
            </p>
          ) : null}
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Amount</span>
              <Input
                value={correctForm.requested_amount ?? ""}
                onChange={(event) =>
                  setCorrectForm((current) => ({
                    ...current,
                    requested_amount: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Repayment period (months)</span>
              <Input
                value={correctForm.requested_term_months ?? ""}
                onChange={(event) =>
                  setCorrectForm((current) => ({
                    ...current,
                    requested_term_months: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Purpose</span>
              <Textarea
                value={correctForm.purpose ?? ""}
                onChange={(event) =>
                  setCorrectForm((current) => ({
                    ...current,
                    purpose: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setCorrectTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={busyId.startsWith("fix-")}
              onClick={() => void submitCorrection()}
            >
              Resubmit
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(deferTarget)}
        onOpenChange={(open) => !open && setDeferTarget(null)}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ask to defer an instalment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The instalment of{" "}
            {readString(
              deferTarget?.installment ?? null,
              ["totalDue", "total_due"],
              "",
            )}{" "}
            due{" "}
            {readString(
              deferTarget?.installment ?? null,
              ["dueDate", "due_date"],
              "",
            )}{" "}
            would move to after your last instalment. Finance must approve it.
          </p>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason</span>
            <Textarea
              value={deferReason}
              onChange={(event) => setDeferReason(event.target.value)}
            />
          </label>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setDeferTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={deferReason.trim().length < 3 || busyId === "defer"}
              onClick={() => void submitDeferment()}
            >
              Send request
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!saving) setCreateOpen(open);
        }}
      >
        <DialogPopup className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {checkpoint ? "Resume application" : "New application"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {checkpoint ? (
              <p role="status" className="text-sm text-muted-foreground">
                Your draft and completed steps are saved. Retry continues the
                unfinished steps. Choose any missing documents again after
                reloading.
              </p>
            ) : null}
            <fieldset disabled={saving} className="contents">
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted/40 p-1 sm:gap-2">
                {wizardSteps.map((step, index) => (
                  <Button
                    key={step}
                    type="button"
                    appearance={wizardStep === index ? "primary" : "subtle"}
                    size="small"
                    className="!min-w-0 !px-1 text-xs sm:!px-3"
                    aria-current={wizardStep === index ? "step" : undefined}
                    disabled={
                      saving || (index > wizardStep && currentWizardStepBlocked)
                    }
                    onClick={() => moveToWizardStep(index)}
                  >
                    {index + 1}. {step}
                  </Button>
                ))}
              </div>
            </fieldset>
            {wizardStep === 0 ? (
              <div className="grid gap-3">
                <FluentSelect
                  label="Product"
                  disabled={saving || Boolean(checkpoint)}
                  ariaLabel="Product"
                  className="w-full"
                  value={form.product_id ?? ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      product_id: value,
                    }))
                  }
                  placeholder="Select product"
                  options={[
                    { value: "", label: "Select product" },
                    ...products.map((product) => ({
                      value: rowId(product),
                      label: optionLabel(product),
                    })),
                  ]}
                />
                {currentProduct ? (
                  <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium">
                        {prettify(
                          readString(
                            currentProduct,
                            ["productType", "product_type"],
                            "",
                          ),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Amount range
                      </p>
                      <p className="font-medium">
                        {readString(
                          currentProduct,
                          ["minimumAmount", "minimum_amount"],
                          "0.00",
                        )}{" "}
                        -{" "}
                        {readString(
                          currentProduct,
                          ["maximumAmount", "maximum_amount"],
                          "Open",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Term</p>
                      <p className="font-medium">
                        {readString(
                          currentProduct,
                          ["minimumTermMonths", "minimum_term_months"],
                          "1",
                        )}{" "}
                        -{" "}
                        {readString(
                          currentProduct,
                          ["maximumTermMonths", "maximum_term_months"],
                          "0",
                        )}{" "}
                        months
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                <div className="grid gap-3">
                  <Field
                    label="Amount"
                    validationState={
                      form.requested_amount &&
                      !financeAmountPattern.test(form.requested_amount)
                        ? "error"
                        : "none"
                    }
                    validationMessage={
                      form.requested_amount &&
                      !financeAmountPattern.test(form.requested_amount)
                        ? "Enter a valid amount with up to two decimal places."
                        : undefined
                    }
                  >
                    <Input
                      appearance="outline"
                      inputMode="decimal"
                      disabled={saving || Boolean(checkpoint)}
                      value={form.requested_amount ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          requested_amount: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Term (months)">
                    <Input
                      appearance="outline"
                      inputMode="numeric"
                      disabled={saving || Boolean(checkpoint)}
                      value={form.requested_term_months ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          requested_term_months: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Purpose">
                    <PurposeRichTextEditor
                      value={form.purpose ?? ""}
                      disabled={saving || Boolean(checkpoint)}
                      onChange={(purpose) =>
                        setForm((current) => ({ ...current, purpose }))
                      }
                    />
                  </Field>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-background text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Wallet24Regular className="text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Eligibility estimate
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Based on your current terms
                        </p>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 text-xs font-semibold ${
                        eligibilityLoading
                          ? "text-primary"
                          : eligibility
                            ? eligible
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {eligibilityLoading ? (
                        <FluentLoadingIndicator className="size-4 animate-spin" />
                      ) : (
                        <span
                          className="size-2 rounded-full bg-current"
                          aria-hidden="true"
                        />
                      )}
                      {eligibilityLoading
                        ? "Checking"
                        : eligibility
                          ? eligible
                            ? "Eligible"
                            : "Needs attention"
                          : "Enter terms"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2">
                    {[
                      [
                        "Installment",
                        ["estimatedInstallment", "estimated_installment"],
                      ],
                      [
                        "Capacity",
                        ["availableInstallment", "available_installment"],
                      ],
                      [
                        "After deduction",
                        [
                          "estimatedNetPayAfterDeduction",
                          "estimated_net_pay_after_deduction",
                        ],
                      ],
                      [
                        "Max eligible",
                        ["maximumEligibleAmount", "maximum_eligible_amount"],
                      ],
                    ].map(([label, keys], index) => (
                      <div
                        key={label as string}
                        className={`px-4 py-3 ${index < 2 ? "border-b border-border" : ""} ${index % 2 === 0 ? "border-r border-border" : ""}`}
                      >
                        <p className="text-xs text-muted-foreground">
                          {label as string}
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                          {eligibility
                            ? moneyValue(eligibility, keys as string[])
                            : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileTextIcon className="size-4" /> Required documents
                  </div>
                  {ordinaryRequiredDocuments.length ? (
                    ordinaryRequiredDocuments.map((type) => (
                      <Field key={type} label={prettify(type)}>
                        <FileDropzone
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx"
                          file={documentFiles[type] ?? null}
                          onFileChange={(selectedFile) =>
                            setDocumentFiles((current) => ({
                              ...current,
                              [type]: selectedFile,
                            }))
                          }
                        />
                      </Field>
                    ))
                  ) : !requiresGuarantorForms ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      No document is required for this product.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheckIcon className="size-4" /> Guarantors
                  </div>
                  <Field
                    label={
                      <>
                        Choose coworkers{" "}
                        {requiredGuarantors
                          ? `(minimum ${requiredGuarantors})`
                          : ""}
                      </>
                    }
                    hint="Search by name or employee number. The selected coworkers will receive a guarantee request."
                  >
                    <TagPicker
                      disabled={saving || Boolean(checkpoint)}
                      selectedOptions={guarantorIds.map(String)}
                      onOptionSelect={(_event, data) => {
                        if (data.value === "__status") return;
                        setForm((current) => ({
                          ...current,
                          guarantor_employee_ids:
                            data.selectedOptions.join(","),
                        }));
                        setGuarantorSearch("");
                      }}
                    >
                      <TagPickerControl className="w-full">
                        <TagPickerGroup aria-label="Selected guarantors">
                          {guarantorIds.map((employeeId) => {
                            const candidate = guarantorCandidateById.get(
                              String(employeeId),
                            );
                            const label = candidate
                              ? guarantorCandidateLabel(candidate)
                              : "Selected coworker";
                            return (
                              <Tag
                                key={employeeId}
                                value={String(employeeId)}
                                media={
                                  <Avatar
                                    name={label}
                                    icon={<Person20Regular />}
                                    size={20}
                                  />
                                }
                              >
                                {label}
                              </Tag>
                            );
                          })}
                        </TagPickerGroup>
                        <TagPickerInput
                          aria-label="Search coworkers"
                          placeholder={
                            guarantorIds.length
                              ? "Add another coworker"
                              : "Type a coworker's name"
                          }
                          value={guarantorSearch}
                          onChange={(event) =>
                            setGuarantorSearch(event.currentTarget.value)
                          }
                        />
                      </TagPickerControl>
                      <TagPickerList>
                        {guarantorSearch.trim().length < 2 ? (
                          <TagPickerOption value="__status">
                            Type at least two characters to search
                          </TagPickerOption>
                        ) : guarantorSearchLoading ? (
                          <TagPickerOption value="__status">
                            Searching coworkers…
                          </TagPickerOption>
                        ) : guarantorCandidates.filter(
                            (candidate) =>
                              !guarantorIds.includes(
                                Number(rowId(candidate)),
                              ) &&
                              guarantorCandidateLabel(candidate)
                                .toLowerCase()
                                .includes(guarantorSearch.trim().toLowerCase()),
                          ).length ? (
                          guarantorCandidates
                            .filter(
                              (candidate) =>
                                !guarantorIds.includes(
                                  Number(rowId(candidate)),
                                ) &&
                                guarantorCandidateLabel(candidate)
                                  .toLowerCase()
                                  .includes(
                                    guarantorSearch.trim().toLowerCase(),
                                  ),
                            )
                            .map((candidate) => {
                              const id = rowId(candidate);
                              const label = guarantorCandidateLabel(candidate);
                              return (
                                <TagPickerOption
                                  key={id}
                                  value={id}
                                  text={label}
                                  media={
                                    <Avatar
                                      name={label}
                                      icon={<Person20Regular />}
                                      size={24}
                                    />
                                  }
                                >
                                  {label}
                                </TagPickerOption>
                              );
                            })
                        ) : (
                          <TagPickerOption value="__status">
                            No matching active coworkers found
                          </TagPickerOption>
                        )}
                      </TagPickerList>
                    </TagPicker>
                  </Field>
                  {requiresGuarantorForms && guarantorIds.length ? (
                    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Signed guarantor forms
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Upload a separate signed form for every selected
                          guarantor.
                        </p>
                      </div>
                      {guarantorIds.map((employeeId) => {
                        const candidate = guarantorCandidateById.get(
                          String(employeeId),
                        );
                        const label = candidate
                          ? guarantorCandidateLabel(candidate)
                          : "Selected coworker";
                        const key = guarantorFormKey(employeeId);
                        return (
                          <Field key={key} label={`Form for ${label}`}>
                            <FileDropzone
                              accept=".pdf,.png,.jpg,.jpeg,.webp"
                              disabled={saving || Boolean(checkpoint)}
                              file={documentFiles[key] ?? null}
                              onFileChange={(selectedFile) =>
                                setDocumentFiles((current) => ({
                                  ...current,
                                  [key]: selectedFile,
                                }))
                              }
                            />
                          </Field>
                        );
                      })}
                    </div>
                  ) : requiresGuarantorForms ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      Select guarantors to add their individual form uploads.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="grid gap-3">
                <div className="grid gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Product</p>
                    <p className="font-medium">
                      {currentProduct
                        ? optionLabel(currentProduct)
                        : "Not selected"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Amount / term
                    </p>
                    <p className="font-medium">
                      {form.requested_amount || "0.00"} over{" "}
                      {form.requested_term_months || "0"} months
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Documents</p>
                    <p className="font-medium">
                      {requiredDocumentKeys.length
                        ? `${requiredDocumentKeys.length} required`
                        : "None required"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Guarantors</p>
                    <p className="font-medium">
                      {guarantorIds.length} added, {requiredGuarantors} required
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {checks.length ? (
                    checks.map((check, index) => {
                      const passed = readString(check, ["passed"]) === "true";
                      const code = readString(
                        check,
                        ["code"],
                        `check-${index}`,
                      );
                      return (
                        <div
                          key={code}
                          className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          {passed ? (
                            <CheckCircle2Icon className="mt-0.5 size-4 text-emerald-600" />
                          ) : (
                            <XCircleIcon className="mt-0.5 size-4 text-rose-600" />
                          )}
                          <div>
                            <p className="font-medium">{prettify(code)}</p>
                            <p className="text-xs text-muted-foreground">
                              {readString(check, ["message"], "")}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      Eligibility checks appear after product, amount, and term
                      are entered.
                    </p>
                  )}
                </div>
                <Checkbox
                  label="Submit immediately after creating the draft"
                  disabled={saving || Boolean(checkpoint)}
                  checked={form.auto_submit === "true"}
                  onChange={(_event, data) =>
                    setForm((current) => ({
                      ...current,
                      auto_submit: data.checked ? "true" : "false",
                    }))
                  }
                />
              </div>
            ) : null}
            {formError ? (
              <p className="text-sm text-rose-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter className="!flex-row !flex-wrap !justify-end">
            <Button
              appearance="secondary"
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              appearance="subtle"
              icon={<ArrowLeft20Regular />}
              onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
              disabled={wizardStep === 0 || saving}
            >
              Back
            </Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button
                appearance="primary"
                iconPosition="after"
                icon={<ArrowRight20Regular />}
                onClick={() => moveToWizardStep(wizardStep + 1)}
                disabled={saving || currentWizardStepBlocked}
              >
                Next
              </Button>
            ) : (
              <Button
                appearance="primary"
                onClick={() => void handleCreateApplication(Date.now())}
                disabled={saving || !canCreate}
              >
                {saving ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : checkpoint ? (
                  "Continue draft"
                ) : (
                  "Create"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
