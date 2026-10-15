"use client";

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
import {
  CheckCircle2Icon,
  FileTextIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store";

import {
  CompactStatStrip,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
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

export function FinanceSelfView() {
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
      requiredDocuments.every((type) => Boolean(documentFiles[type])) &&
      guarantorIds.length >= requiredGuarantors);

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
              error instanceof Error
                ? error.message
                : "Could not evaluate eligibility.",
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

  async function onCreate() {
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
        const missingDocuments = requiredDocuments.filter(
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
          requiredDocuments,
          guarantorIds,
          autoSubmit: form.auto_submit === "true",
          draftId: null,
          startedAt: Date.now(),
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
          upload: async (id, type, file) =>
            uploadMyFinanceApplicationDocument(token, id, {
              document_type: type,
              file: await fileToBase64UploadDto(file),
            }),
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
          error instanceof Error
            ? error.message
            : "Could not complete the application.",
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
                  title={readString(row, ["decisionComments", "decision_comments"], "")}
                  onClick={() => {
                    setCorrectTarget(row);
                    setCorrectForm({
                      requested_amount: readString(row, ["requestedAmount", "requested_amount"], ""),
                      requested_term_months: readString(row, ["requestedTermMonths", "requested_term_months"], ""),
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
                  Returned: {readString(row, ["decisionComments", "decision_comments"])}
                </span>
              ) : null}
              {status === "REJECTED" &&
              readString(row, ["decisionComments", "decision_comments"], "") ? (
                <span className="w-full text-xs text-rose-700">
                  Declined: {readString(row, ["decisionComments", "decision_comments"])}
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
        errorObject instanceof Error ? errorObject.message : "Could not resubmit.",
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
        errorObject instanceof Error ? errorObject.message : "Could not load the loan.",
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
        errorObject instanceof Error ? errorObject.message : "Could not send the request.",
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
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My finance"
        title="Loans and advances"
        description="Apply, submit, accept an offer, or withdraw — only your own applications."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? (
              <FluentLoadingIndicator className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </button>
        }
      />
      <CompactStatStrip
        items={[
          { label: "Applications", value: String(applications.length) },
          { label: "Products", value: String(products.length) },
          {
            label: "Open",
            value: String(
              applications.filter(
                (row) =>
                  !["WITHDRAWN", "REJECTED", "CLOSED"].includes(
                    readString(row, ["status"]).toUpperCase(),
                  ),
              ).length,
            ),
          },
          {
            label: "Guarantee requests",
            value: String(guarantorRequests.length),
          },
        ]}
      />
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
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
          <PlusIcon className="size-4" />{" "}
          {checkpoint ? "Resume application" : "New application"}
        </button>
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My applications"
          data={applications}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey="me-finance-applications"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My guarantor requests"
          data={guarantorRequests}
          columns={guarantorColumns}
          loading={loading}
          itemsPerPage={10}
          showExport={false}
          storageKey="me-finance-guarantor-requests"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
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
                    {readString(row, ["accountNo", "account_no"], `Loan #${rowId(row)}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {prettify(readString(row, ["productType", "product_type"], ""))}
                  </p>
                </div>
              ),
            },
            {
              key: "outstanding",
              label: "Outstanding",
              render: (row) =>
                readString(row, ["outstandingTotal", "outstanding_total"], "0.00"),
            },
            {
              key: "installment",
              label: "Monthly",
              render: (row) =>
                readString(
                  row,
                  ["scheduledMonthlyInstallment", "scheduled_monthly_installment"],
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
          {readString(correctTarget, ["decisionComments", "decision_comments"], "") ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {readString(correctTarget, ["decisionComments", "decision_comments"])}
            </p>
          ) : null}
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Amount</span>
              <input
                className={inputClass}
                value={correctForm.requested_amount ?? ""}
                onChange={(event) =>
                  setCorrectForm((current) => ({ ...current, requested_amount: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Repayment period (months)</span>
              <input
                className={inputClass}
                value={correctForm.requested_term_months ?? ""}
                onChange={(event) =>
                  setCorrectForm((current) => ({ ...current, requested_term_months: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Purpose</span>
              <Textarea
                className={textareaClass}
                value={correctForm.purpose ?? ""}
                onChange={(event) =>
                  setCorrectForm((current) => ({ ...current, purpose: event.target.value }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCorrectTarget(null)}>
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
            {readString(deferTarget?.installment ?? null, ["totalDue", "total_due"], "")} due{" "}
            {readString(deferTarget?.installment ?? null, ["dueDate", "due_date"], "")} would move to after your last
            instalment. Finance must approve it.
          </p>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason</span>
            <Textarea
              className={textareaClass}
              value={deferReason}
              onChange={(event) => setDeferReason(event.target.value)}
            />
          </label>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setDeferTarget(null)}>
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
          <div className="space-y-4">
            {checkpoint ? (
              <p role="status" className="text-sm text-muted-foreground">
                Your draft and completed steps are saved. Retry continues the
                unfinished steps. Choose any missing documents again after
                reloading.
              </p>
            ) : null}
            <fieldset disabled={saving} className="contents">
              <div className="grid grid-cols-4 gap-2">
                {wizardSteps.map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                      wizardStep === index
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setWizardStep(index)}
                  >
                    {index + 1}. {step}
                  </button>
                ))}
              </div>
            </fieldset>
            {wizardStep === 0 ? (
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Product</span>
                  <FluentSelect
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
                </label>
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
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Amount</span>
                    <input
                      className={inputClass}
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
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Term (months)</span>
                    <input
                      className={inputClass}
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
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Purpose</span>
                    <Textarea
                      className={textareaClass}
                      disabled={saving || Boolean(checkpoint)}
                      value={form.purpose ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purpose: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">Eligibility</p>
                    {eligibilityLoading ? (
                      <FluentLoadingIndicator className="size-4 animate-spin text-muted-foreground" />
                    ) : eligibility ? (
                      eligible ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : (
                        <XCircleIcon className="size-4 text-rose-600" />
                      )
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Installment</span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "estimatedInstallment",
                          "estimated_installment",
                        ])}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "availableInstallment",
                          "available_installment",
                        ])}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        After deduction
                      </span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "estimatedNetPayAfterDeduction",
                          "estimated_net_pay_after_deduction",
                        ])}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Max eligible
                      </span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "maximumEligibleAmount",
                          "maximum_eligible_amount",
                        ])}
                      </span>
                    </div>
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
                  {requiredDocuments.length ? (
                    requiredDocuments.map((type) => (
                      <label key={type} className="grid gap-1.5 text-sm">
                        <span className="font-medium">{prettify(type)}</span>
                        <input
                          className={inputClass}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx"
                          onChange={(event) =>
                            setDocumentFiles((current) => ({
                              ...current,
                              [type]: event.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        {documentFiles[type] ? (
                          <span className="text-xs text-muted-foreground">
                            {documentFiles[type]?.name}
                          </span>
                        ) : null}
                      </label>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      No document is required for this product.
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheckIcon className="size-4" /> Guarantors
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Employee IDs{" "}
                      {requiredGuarantors
                        ? `(minimum ${requiredGuarantors})`
                        : ""}
                    </span>
                    <input
                      className={inputClass}
                      placeholder="Example: 12, 25"
                      disabled={saving || Boolean(checkpoint)}
                      value={form.guarantor_employee_ids ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          guarantor_employee_ids: event.target.value,
                        }))
                      }
                    />
                  </label>
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
                      {requiredDocuments.length
                        ? `${requiredDocuments.length} required`
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={saving || Boolean(checkpoint)}
                    checked={form.auto_submit === "true"}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        auto_submit: event.target.checked ? "true" : "false",
                      }))
                    }
                  />
                  Submit immediately after creating the draft
                </label>
              </div>
            ) : null}
            {formError ? (
              <p className="text-sm text-rose-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
              disabled={wizardStep === 0 || saving}
            >
              Back
            </button>
            {wizardStep < wizardSteps.length - 1 ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() =>
                  setWizardStep((step) =>
                    Math.min(wizardSteps.length - 1, step + 1),
                  )
                }
                disabled={saving}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => void onCreate()}
                disabled={saving || !canCreate}
              >
                {saving ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : checkpoint ? (
                  "Continue draft"
                ) : (
                  "Create"
                )}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
