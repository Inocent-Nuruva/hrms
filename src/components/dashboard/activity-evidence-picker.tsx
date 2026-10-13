"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  addMyActivityEvidence,
  listMyDocuments,
  type AdminRecord,
} from "@/lib/admin-api";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";
import { readStoredSessionTokens } from "@/lib/session-client";
import { workflowFailure } from "@/lib/workflow-error";
import { optionLabel, rowId } from "./talent-visuals";

const selectionSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Choose an existing document.")
  .refine(
    (value) => Number.isSafeInteger(Number(value)),
    "Choose a valid document.",
  );

export function ActivityEvidencePicker({
  entryId,
  onAttached,
}: {
  entryId: string;
  onAttached: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<AdminRecord[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [documentId, setDocumentId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { begin, invalidate } = useWorkflowRequest(`${entryId}:evidence-list`);
  const { begin: beginSave } = useWorkflowRequest(`${entryId}:evidence-save`);

  useEffect(() => {
    savingRef.current = false;
    setSaving(false);
    setDocumentId("");
    setMessage("");
  }, [beginSave, entryId]);

  useEffect(() => {
    let active = true;
    if (!open) return;
    const { current } = begin();
    const token = readStoredSessionTokens().accessToken;
    setStatus("loading");
    setMessage("");
    void listMyDocuments(token)
      .then((items) => {
        if (active && current()) {
          setDocuments(items);
          setStatus("ready");
        }
      })
      .catch((cause) => {
        if (active && current()) {
          setStatus("error");
          setMessage(
            workflowFailure(cause, "Your documents could not be loaded."),
          );
        }
      });
    return () => {
      active = false;
      invalidate();
    };
  }, [begin, entryId, invalidate, open]);

  async function attach() {
    const parsed = selectionSchema.safeParse(documentId);
    if (
      !parsed.success ||
      !documents.some((document) => rowId(document) === documentId)
    ) {
      setMessage("Choose a document from your own document list.");
      return;
    }
    if (savingRef.current) return;
    const { current } = beginSave();
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      await addMyActivityEvidence(
        readStoredSessionTokens().accessToken,
        entryId,
        { document_id: Number(parsed.data) },
      );
      if (!current()) return;
      setDocumentId("");
      setMessage("Evidence attached. You can continue your activity report.");
      try {
        await onAttached();
      } catch {
        if (current())
          setMessage(
            "Evidence was attached. Reload the report to refresh its details.",
          );
      }
    } catch (cause) {
      if (current())
        setMessage(
          workflowFailure(
            cause,
            "Evidence could not be attached. Your selection is retained.",
          ),
        );
    } finally {
      if (current()) {
        setSaving(false);
        savingRef.current = false;
      }
    }
  }

  if (!open)
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Attach evidence
      </Button>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Select supporting evidence from your employee documents before
        submitting the daily report.
      </p>
      {status === "loading" ? (
        <p role="status">Loading your documents…</p>
      ) : null}
      {status === "ready" && documents.length > 0 ? (
        <FluentSelect
          ariaLabel="Supporting document"
          value={documentId}
          disabled={saving}
          onChange={setDocumentId}
          options={[
            { value: "", label: "Choose a document" },
            ...documents.map((document) => ({
              value: rowId(document),
              label: optionLabel(document),
            })),
          ]}
        />
      ) : null}
      {status === "ready" && documents.length === 0 ? (
        <p className="text-sm">You have no documents to attach yet.</p>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Activity evidence</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || status !== "ready" || !documentId}
          onClick={() => void attach()}
        >
          {saving ? "Attaching…" : "Attach selected document"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Close evidence picker
        </Button>
        <Link href="/dashboard/me/requests/documents">
          Upload or manage your documents
        </Link>
      </div>
    </div>
  );
}
