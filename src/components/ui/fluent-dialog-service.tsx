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
} from "@fluentui/react-components";

type DialogRequest = {
  kind: "confirm" | "prompt";
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  defaultValue: string;
  resolve: (value: boolean | string | null) => void;
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

export function FluentDialogService() {
  const [, refresh] = React.useReducer((value) => value + 1, 0);
  const request = queue[0];
  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);

  React.useEffect(() => {
    setInput(request?.defaultValue ?? "");
  }, [request]);

  const finish = React.useCallback((value: boolean | string | null) => {
    const current = queue.shift();
    current?.resolve(value);
    publish();
  }, []);

  if (!request) return null;

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
            <p className="text-sm leading-6 text-muted-foreground">
              {request.message}
            </p>
            {request.kind === "prompt" ? (
              <Field label="Response">
                <Input
                  autoFocus
                  value={input}
                  onChange={(_event, data) => setInput(data.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") finish(input);
                  }}
                />
              </Field>
            ) : null}
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
              onClick={() => finish(request.kind === "confirm" ? true : input)}
            >
              {request.confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
