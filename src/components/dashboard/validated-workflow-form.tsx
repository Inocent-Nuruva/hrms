"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { FluentNotice } from "@/components/dashboard/fluent-notice";
import { Button } from "@fluentui/react-components";

export type WorkflowValidation = { schema: z.ZodType; input: unknown };

/** Details are validated before review and again before the existing mutation. */
export function ValidatedWorkflowForm({
  children,
  validation,
  saving,
  onSubmit,
  description,
  submitError,
  requireReview = true,
  submitLabel = "Save",
  onCancel,
}: {
  children: ReactNode;
  validation: WorkflowValidation;
  saving: boolean;
  onSubmit: () => Promise<void>;
  description: string;
  submitError?: string | null;
  requireReview?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<"details" | "review">("details");
  const [issues, setIssues] = useState<z.core.$ZodIssue[]>([]);
  const [reviewed, setReviewed] = useState<unknown>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const fingerprint = JSON.stringify(validation.input);
  const reviewedFingerprint = useRef("");

  useEffect(() => {
    if (step === "review" && reviewedFingerprint.current !== fingerprint) {
      setStep("details");
      setReviewed(null);
    }
  }, [fingerprint, step]);

  function validate() {
    const result = validation.schema.safeParse(validation.input);
    setIssues(result.success ? [] : result.error.issues);
    if (!result.success) return false;
    setReviewed(result.data);
    reviewedFingerprint.current = fingerprint;
    return true;
  }

  async function submit() {
    if (saving || submitting.current || !validate()) return;
    submitting.current = true;
    try {
      await onSubmit();
    } catch (cause) {
      if (active.current)
        setIssues([
          {
            code: "custom",
            path: ["save"],
            message:
              cause instanceof Error
                ? cause.message
                : "The changes could not be saved. Your details are retained; try again.",
          },
        ]);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {requireReview
          ? `Step ${step === "details" ? "1 of 2: Enter details" : "2 of 2: Review and confirm"}. `
          : ""}
        {description}
      </p>
      {!requireReview || step === "details" ? (
        <fieldset disabled={saving} className="min-w-0">
          {children}
        </fieldset>
      ) : (
        <FluentNotice>
          <strong>Review your changes</strong>
          <div>
            <dl className="flex max-h-80 flex-col gap-2 overflow-auto">
              {reviewed && typeof reviewed === "object"
                ? Object.entries(reviewed)
                    .filter(([, value]) => value !== undefined && value !== "")
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="font-medium">{humanize(key)}</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {reviewValue(value)}
                        </dd>
                      </div>
                    ))
                : null}
            </dl>
          </div>
        </FluentNotice>
      )}
      {submitError ? (
        <FluentNotice intent="error">
          <strong>The change could not be completed</strong>
          <div>{submitError}</div>
        </FluentNotice>
      ) : null}
      {issues.length ? (
        <FluentNotice intent="error">
          <strong>Correct these fields before continuing</strong>
          <div>
            <ul className="list-disc pl-5">
              {issues.map((issue, index) => (
                <li key={index}>
                  {issue.path.map(String).join(" → ").replaceAll("_", " ")}:{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        </FluentNotice>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            appearance="secondary"
            style={{ width: "fit-content", flex: "none" }}
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        {requireReview && step === "review" ? (
          <Button
            type="button"
            appearance="outline"
            disabled={saving}
            onClick={() => setStep("details")}
          >
            Back to details
          </Button>
        ) : null}
        <Button
          type="button"
          appearance="primary"
          style={{ width: "fit-content", flex: "none" }}
          disabled={saving}
          onClick={() => {
            if (!requireReview) {
              void submit();
            } else if (step === "details") {
              if (validate()) setStep("review");
            } else void submit();
          }}
        >
          {saving
            ? "Saving…"
            : !requireReview
              ? submitLabel
              : step === "details"
                ? "Review details"
                : "Confirm and save"}
        </Button>
      </div>
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function reviewValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "")
    return "Not specified";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length ? (
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {value.map((item, index) => (
          <li key={index}>{reviewValue(item)}</li>
        ))}
      </ol>
    ) : (
      "None"
    );
  if (typeof value === "object")
    return (
      <dl className="flex flex-col gap-1">
        {Object.entries(value)
          .filter(([key]) => key !== "id")
          .map(([key, item]) => (
            <div key={key}>
              <dt className="inline font-medium">{humanize(key)}: </dt>
              <dd className="inline">{reviewValue(item)}</dd>
            </div>
          ))}
      </dl>
    );
  return String(value);
}
