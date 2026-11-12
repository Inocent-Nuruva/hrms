"use client";
import * as React from "react";
import { Dialog, DialogSurface, DialogTitle } from "@fluentui/react-components";
import {
  base64ToBlob,
  previewContractDraft,
  saveBlob,
  type ContractReadiness,
} from "@/lib/contracts-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";

type PreviewResult = {
  blob: Blob;
  fileName: string;
  count: number;
  missing: string[];
};
export function ContractWorkspacePreview({
  open,
  onClose,
  token,
  id,
  body,
  readiness,
  onFocusField,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  id: number;
  body: Record<string, unknown>;
  readiness: ContractReadiness | null;
  onFocusField: (key: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PreviewResult | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [zoom, setZoom] = React.useState<string>("100");
  const [attempt, setAttempt] = React.useState(0);
  const frame = React.useRef<HTMLIFrameElement | null>(null);
  const cache = React.useRef(new Map<string, PreviewResult>());
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setPage(1);
    previewContractDraft(token, id, body)
      .then((response) => {
        if (cancelled) return;
        const next = cache.current.get(response.preview_hash) ?? {
          blob: base64ToBlob(response.content_base64),
          fileName: response.file_name,
          count: response.page_count,
          missing: response.missing_fields,
        };
        cache.current.set(response.preview_hash, next);
        setResult(next);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            (cause as { payload?: { code?: string } }).payload?.code ===
              "CONTRACT_PREVIEW_SALARY_ACCESS_REQUIRED"
              ? m.previewDenied
              : m.previewError,
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, id, body, attempt]);
  React.useEffect(() => {
    if (!result) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(result.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [result]);
  const missing = [
    ...new Set([
      ...(readiness?.missing_fields ?? []),
      ...(result?.missing ?? []),
    ]),
  ];
  const focus = (key: string) => {
    onClose();
    onFocusField(key);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(_event, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className="!w-[min(1100px,calc(100vw-2rem))] !max-w-[1100px]">
        <DialogTitle>{m.previewTitle}</DialogTitle>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={!result || page <= 1}
          >
            {m.previousPage}
          </button>
          <span>
            {m.page} {page} / {result?.count ?? "—"}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((value) => Math.min(result?.count ?? 1, value + 1))
            }
            disabled={!result || page >= (result?.count ?? 1)}
          >
            {m.nextPage}
          </button>
          <label>
            {m.zoom}{" "}
            <select
              value={zoom}
              onChange={(event) => setZoom(event.target.value)}
            >
              <option value="page-width">{m.fitWidth}</option>
              {[50, 75, 100, 125, 150, 200].map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!result}
            onClick={() => result && saveBlob(result.blob, result.fileName)}
          >
            {m.download}
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={() => {
              try {
                frame.current?.contentWindow?.focus();
                frame.current?.contentWindow?.print();
              } catch {
                if (url) window.open(url, "_blank", "noopener");
              }
            }}
          >
            {m.print}
          </button>
          <button type="button" onClick={onClose}>
            {m.close}
          </button>
        </div>
        {loading ? (
          <div role="status" className="grid gap-2">
            <p>{m.previewLoading}</p>
            <div
              aria-hidden="true"
              className="h-[45vh] animate-pulse rounded bg-muted"
            />
          </div>
        ) : null}
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {m.retry}
            </button>
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          {url ? (
            <iframe
              ref={frame}
              title={m.previewTitle}
              className="h-[65vh] w-full border border-border"
              src={`${url}#page=${page}&zoom=${zoom}`}
            />
          ) : (
            <div />
          )}
          <aside>
            <h3>{m.missingFields}</h3>
            {missing.length ? (
              <ul>
                {missing.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => focus(key)}
                    >
                      {m.label(key)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{m.noMissingFields}</p>
            )}
          </aside>
        </div>
      </DialogSurface>
    </Dialog>
  );
}
