"use client";
import * as React from "react";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Dialog, DialogSurface, DialogTitle } from "@fluentui/react-components";
import {
  base64ToBlob,
  previewContractDraft,
  saveBlob,
  type ContractReadiness,
} from "@/lib/contracts-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Printer,
  RotateCw,
  X,
  ZoomIn,
} from "lucide-react";

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";
const toolBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50";

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
      <DialogSurface className="!flex !h-[min(92vh,960px)] !w-[min(1200px,calc(100vw-2rem))] !max-w-[1200px] !flex-col !gap-0 !overflow-hidden !p-0">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <FileText className="size-5 text-primary" aria-hidden />
          <DialogTitle className="!m-0 flex-1 !text-base !font-semibold">
            {m.previewTitle}
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-800">
              DRAFT
            </span>
          </DialogTitle>
          <button
            type="button"
            className={iconBtn}
            title={m.close}
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
            <span className="sr-only">{m.close}</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-5 py-2 text-sm">
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              className={iconBtn}
              title={m.previousPage}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={!result || page <= 1}
            >
              <ChevronLeft className="size-4" aria-hidden />
              <span className="sr-only">{m.previousPage}</span>
            </button>
            <span className="min-w-20 text-center text-xs tabular-nums">
              {m.page} {page} / {result?.count ?? "—"}
            </span>
            <button
              type="button"
              className={iconBtn}
              title={m.nextPage}
              onClick={() =>
                setPage((value) => Math.min(result?.count ?? 1, value + 1))
              }
              disabled={!result || page >= (result?.count ?? 1)}
            >
              <ChevronRight className="size-4" aria-hidden />
              <span className="sr-only">{m.nextPage}</span>
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ZoomIn className="size-4" aria-hidden />
            <span className="sr-only">{m.zoom}</span>
            <FluentSelect
              ariaLabel={m.zoom}
              size="small"
              className="w-28"
              value={String(zoom)}
              onChange={(value) => setZoom(value)}
              options={[
                { value: "page-width", label: m.fitWidth },
                ...[50, 75, 100, 125, 150, 200].map((value) => ({
                  value: String(value),
                  label: `${value}%`,
                })),
              ]}
            />
          </label>
          <span className="flex-1" />
          <button
            type="button"
            className={toolBtn}
            disabled={!result}
            onClick={() => result && saveBlob(result.blob, result.fileName)}
          >
            <Download className="size-4" aria-hidden />
            {m.download}
          </button>
          <button
            type="button"
            className={toolBtn}
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
            <Printer className="size-4" aria-hidden />
            {m.print}
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-h-0 bg-muted/60 p-3">
            {loading ? (
              <div
                role="status"
                className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-background text-sm text-muted-foreground"
              >
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                {m.previewLoading}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-background p-6 text-center text-sm text-rose-700"
              >
                <AlertTriangle className="size-6" aria-hidden />
                <p>{error}</p>
                <button
                  type="button"
                  className={toolBtn}
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <RotateCw className="size-4" aria-hidden />
                  {m.retry}
                </button>
              </div>
            ) : url ? (
              <iframe
                ref={frame}
                title={m.previewTitle}
                className="h-full min-h-[50vh] w-full rounded-lg border border-border bg-white shadow-sm"
                src={`${url}#page=${page}&zoom=${zoom}`}
              />
            ) : null}
          </div>
          <aside className="min-h-0 overflow-y-auto border-t border-border p-4 lg:border-l lg:border-t-0">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {missing.length ? (
                <AlertTriangle className="size-4 text-amber-600" aria-hidden />
              ) : (
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
              )}
              {m.missingFields}
              {missing.length ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">
                  {missing.length}
                </span>
              ) : null}
            </h3>
            {missing.length ? (
              <ul className="grid gap-1">
                {missing.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-left text-sm text-amber-900 hover:bg-amber-100"
                      onClick={() => focus(key)}
                    >
                      {m.label(key)}
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{m.noMissingFields}</p>
            )}
          </aside>
        </div>
      </DialogSurface>
    </Dialog>
  );
}
