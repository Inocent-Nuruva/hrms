"use client";
import { useState, useRef } from "react";
import { z } from "zod";
import {
  Button,
  Combobox,
  Option,
  Text,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Field,
  Input,
  Textarea,
} from "@fluentui/react-components";
import { Add16Regular } from "@fluentui/react-icons";
import { cleanKpiCategory, resolveKpiCategory } from "@/lib/kpi-categories";
import { FluentNotice } from "./fluent-notice";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

const CategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a category name.")
    .max(80, "Use at most 80 characters."),
  description: z.string().trim().max(500, "Use at most 500 characters."),
});
export function KpiCategorySelect({
  value,
  categories,
  onChange,
  onCreateCategory,
  onCategoryCreated,
}: {
  value: string;
  categories: readonly string[];
  onChange: (value: string) => void;
  onCreateCategory: (
    name: string,
    description: string,
  ) => Promise<{ name: string }>;
  onCategoryCreated: (name: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const { begin } = useWorkflowRequest("kpi-category-create");
  const draft = cleanKpiCategory(value);
  const existing = categories.find(
    (category) =>
      category.toLocaleLowerCase("en") === draft.toLocaleLowerCase("en"),
  );
  const filtered = categories.filter((category) =>
    category.toLocaleLowerCase("en").includes(draft.toLocaleLowerCase("en")),
  );
  function openCategory() {
    setName(existing ? "" : draft);
    setDescription("");
    setError(null);
    setOpen(true);
  }
  async function create() {
    if (pending.current) return;
    const result = CategorySchema.safeParse({
      name: cleanKpiCategory(name),
      description,
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (
      categories.some(
        (category) =>
          category.toLocaleLowerCase("en") ===
          result.data.name.toLocaleLowerCase("en"),
      )
    ) {
      setError("This category already exists. Select it from the list.");
      return;
    }
    const { commit } = begin();
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const created = await onCreateCategory(
        result.data.name,
        result.data.description,
      );
      commit(() => {
        onCategoryCreated(created.name);
        onChange(created.name);
        setOpen(false);
      });
    } catch (cause) {
      commit(() =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Category could not be saved. Try again.",
        ),
      );
    } finally {
      pending.current = false;
      commit(() => setSaving(false));
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <Combobox
          freeform
          aria-label="Category"
          placeholder="Select or type a category"
          className="!w-full !min-w-0"
          input={{ maxLength: 80 }}
          value={value}
          selectedOptions={existing ? [existing] : []}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(resolveKpiCategory(value, categories))}
          onOptionSelect={(_event, data) => {
            if (data.optionValue !== undefined)
              onChange(resolveKpiCategory(data.optionValue, categories));
          }}
        >
          {filtered.map((category) => (
            <Option key={category} value={category} text={category}>
              {category}
            </Option>
          ))}
          {draft && !existing ? (
            <Option value={draft} text={draft}>
              Use “{draft}”
            </Option>
          ) : null}
        </Combobox>
        <Button
          type="button"
          appearance="secondary"
          icon={<Add16Regular />}
          onClick={openCategory}
          className="shrink-0"
          aria-label="Add category"
        >
          Add category
        </Button>
      </div>
      {draft && !existing ? (
        <Text size={200}>
          Use Add category to save it now, or save it with the KPI.
        </Text>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(_event, data) => {
          if (!saving) setOpen(data.open);
        }}
      >
        <DialogSurface style={{ width: "min(420px, calc(100vw - 32px))" }}>
          <DialogBody>
            <DialogTitle>Add KPI category</DialogTitle>
            <DialogContent className="flex flex-col gap-3">
              <Field label="Category name" required>
                <Input
                  value={name}
                  maxLength={80}
                  disabled={saving}
                  onChange={(_event, data) => setName(data.value)}
                />
              </Field>
              <Field label="Description (optional)">
                <Textarea
                  value={description}
                  maxLength={500}
                  disabled={saving}
                  onChange={(_event, data) => setDescription(data.value)}
                />
              </Field>
              {error ? (
                <FluentNotice intent="error">{error}</FluentNotice>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                type="button"
                appearance="secondary"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                appearance="primary"
                disabled={saving}
                onClick={() => void create()}
              >
                {saving ? "Saving…" : "Add category"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
