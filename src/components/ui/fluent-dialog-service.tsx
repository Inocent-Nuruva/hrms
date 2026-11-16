"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Textarea,
} from "@fluentui/react-components";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea";
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
};

type DialogValue = boolean | string | Record<string, string> | null;

type DialogRequest = {
  kind: "confirm" | "prompt" | "form";
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  defaultValue: string;
  fields?: FormField[];
  resolve: (value: DialogValue) => void;
};

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

function enqueue(request: DialogRequest) {
  queue.push(request);
  publish();
}

export function fluentConfirm(message: string, options: DialogOptions = {}) {
  return new Promise<boolean>((resolve) => {
    enqueue({
      kind: "confirm",
      title: options.title ?? "Confirm action",
      message,
      confirmLabel: options.confirmLabel ?? "Continue",
      cancelLabel: options.cancelLabel ?? "Cancel",
      defaultValue: "",
      resolve: (value) => resolve(value === true),
    });
  });
}

export function fluentPrompt(
  message: string,
  defaultValue = "",
  options: DialogOptions = {},
) {
  return new Promise<string | null>((resolve) => {
    enqueue({
      kind: "prompt",
      title: options.title ?? "Enter details",
      message,
      confirmLabel: options.confirmLabel ?? "Continue",
      cancelLabel: options.cancelLabel ?? "Cancel",
      defaultValue,
      resolve: (value) => resolve(typeof value === "string" ? value : null),
    });
  });
}

/**
 * Opens one popup with several fields. Resolves to trimmed values keyed by
 * field name, or null when cancelled. Required fields block submit until filled.
 */
export function fluentForm(
  fields: FormField[],
  options: DialogOptions & { message?: string } = {},
) {
  return new Promise<Record<string, string> | null>((resolve) => {
    enqueue({
      kind: "form",
      title: options.title ?? "Enter details",
      message: options.message ?? "",
      confirmLabel: options.confirmLabel ?? "Continue",
      cancelLabel: options.cancelLabel ?? "Cancel",
      defaultValue: "",
      fields,
      resolve: (value) =>
        resolve(value && typeof value === "object" ? value : null),
    });
  });
}

export function FluentDialogService() {
  const [, refresh] = React.useReducer((value) => value + 1, 0);
  const request = queue[0];
  const [input, setInput] = React.useState("");
  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);

  React.useEffect(() => {
    setInput(request?.defaultValue ?? "");
    setValues(
      Object.fromEntries(
        (request?.fields ?? []).map((f) => [f.name, f.defaultValue ?? ""]),
      ),
    );
  }, [request]);

  const finish = React.useCallback((value: DialogValue) => {
    const current = queue.shift();
    current?.resolve(value);
    publish();
  }, []);

  if (!request) return null;

  const formMissing =
    request.kind === "form" &&
    (request.fields ?? []).some(
      (f) => f.required && !(values[f.name] ?? "").trim(),
    );

  const submit = () => {
    if (request.kind === "confirm") return finish(true);
    if (request.kind === "prompt") return finish(input);
    if (formMissing) return;
    finish(
      Object.fromEntries(
        (request.fields ?? []).map((f) => [f.name, (values[f.name] ?? "").trim()]),
      ),
    );
  };

  const setField = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  return (
    <Dialog
      modalType="alert"
      open
      onOpenChange={(_event, data) => {
        if (!data.open) finish(request.kind === "confirm" ? false : null);
      }}
    >
      <DialogSurface className="!w-[min(28rem,calc(100vw-2rem))]">
        <DialogBody>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogContent className="space-y-4">
            {request.message ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {request.message}
              </p>
            ) : null}
            {request.kind === "prompt" ? (
              <Field label="Response">
                <Input
                  autoFocus
                  value={input}
                  onChange={(_event, data) => setInput(data.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submit();
                  }}
                />
              </Field>
            ) : null}
            {request.kind === "form"
              ? (request.fields ?? []).map((f, index) => (
                  <Field
                    key={f.name}
                    label={f.label}
                    required={f.required}
                    hint={f.hint}
                  >
                    {f.type === "textarea" ? (
                      <Textarea
                        autoFocus={index === 0}
                        placeholder={f.placeholder}
                        value={values[f.name] ?? ""}
                        onChange={(_event, data) => setField(f.name, data.value)}
                      />
                    ) : (
                      <Input
                        autoFocus={index === 0}
                        type={f.type ?? "text"}
                        placeholder={f.placeholder}
                        value={values[f.name] ?? ""}
                        onChange={(_event, data) => setField(f.name, data.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") submit();
                        }}
                      />
                    )}
                  </Field>
                ))
              : null}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => finish(request.kind === "confirm" ? false : null)}
            >
              {request.cancelLabel}
            </Button>
            <Button
              appearance="primary"
              autoFocus={request.kind === "confirm"}
              disabled={formMissing}
              onClick={submit}
            >
              {request.confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
