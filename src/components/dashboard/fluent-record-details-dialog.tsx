"use client";
import { useMemo, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
} from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { collectReadableDetailSections } from "@/components/dashboard/admin-view-shared";
import styles from "./fluent-record-details-dialog.module.css";
import type { AdminRecord } from "@/lib/admin-api";

export function FluentRecordDetailsDialog({
  open,
  onOpenChange,
  title,
  description,
  row,
  actions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  row: AdminRecord | null;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const sections = useMemo(
    () => (row ? collectReadableDetailSections(row) : null),
    [row],
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(_event, data) => onOpenChange(data.open)}
    >
      <DialogSurface
        style={{
          width: "min(720px, calc(100vw - 32px))",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <DialogBody style={{ maxHeight: "none", overflow: "visible" }}>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss20Regular />}
                aria-label="Close record details"
                onClick={() => onOpenChange(false)}
              />
            }
          >
            {title}
          </DialogTitle>
          <DialogContent
            className="space-y-5"
            style={{ maxHeight: "none", overflow: "visible" }}
          >
            {description ? <Text as="p">{description}</Text> : null}
            {actions ? (
              <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <Text as="h3" weight="semibold">
                  Available actions
                </Text>
                <div className={styles.actions}>{actions}</div>
              </section>
            ) : null}
            {children ?? (!sections ||
            !(
              sections.fields.length ||
              sections.lists.length ||
              sections.lead.length
            ) ? (
              <Text>No details available for this record.</Text>
            ) : (
              <>
                {sections.lead.map((paragraph) => (
                  <Text as="p" key={paragraph}>
                    {paragraph}
                  </Text>
                ))}
                <dl className="grid gap-4 sm:grid-cols-2">
                  {sections.fields.map((field) => (
                    <div key={field.key}>
                      <dt>
                        <Text weight="semibold">{field.label}</Text>
                      </dt>
                      <dd>
                        <Text className="whitespace-pre-wrap break-words">
                          {field.value}
                        </Text>
                      </dd>
                    </div>
                  ))}
                </dl>
                {sections.lists.map((list) => (
                  <section key={list.title}>
                    <Text as="h3" weight="semibold">
                      {list.title}
                    </Text>
                    <div className="flex flex-wrap gap-3">
                      {list.items.map((item) => (
                        <Text key={item}>{item}</Text>
                      ))}
                    </div>
                  </section>
                ))}
              </>
            ))}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
