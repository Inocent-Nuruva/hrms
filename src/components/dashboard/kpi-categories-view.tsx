"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./kpi-categories-view.module.css";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Badge,
  Button,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Field,
  Input,
  Textarea,
  Spinner,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Text,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Edit20Regular,
  Delete20Regular,
  ArrowLeft20Regular,
  ArrowClockwise20Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import {
  listPerformanceKpiCategories,
  createPerformanceKpiCategory,
  updatePerformanceKpiCategory,
  deletePerformanceKpiCategory,
} from "@/lib/admin-api";
import { toast } from "@/components/ui/fluent-toast-store";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { canPerformPermission } from "@/lib/dashboard-permissions";
import { FluentNotice } from "./fluent-notice";
import { cleanKpiCategory } from "@/lib/kpi-categories";

type Category = Awaited<
  ReturnType<typeof listPerformanceKpiCategories>
>[number];
const schema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(80),
  description: z.string().trim().max(500),
});
export function KpiCategoriesView({
  embedded = false,
  onChanged,
}: {
  embedded?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter(),
    actor = useDashboardActor();
  const [rows, setRows] = useState<Category[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Category | "new" | null>(null),
    [deleting, setDeleting] = useState<Category | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState<string | null>(null);
  const pending = useRef(false);
  const { begin, invalidate, credential, identityVersion } =
    useWorkflowRequest("kpi-category-list");
  const { begin: beginMutation } = useWorkflowRequest("kpi-category-mutations");
  const canRead =
    actor.isAdmin ||
    canPerformPermission(actor.permissionLabels, {
      permissions: ["kpi_definitions:read", "manage_performance"],
      mode: "any",
    });
  const canCreate =
    actor.isAdmin ||
    canPerformPermission(actor.permissionLabels, {
      permissions: ["kpi_definitions:create", "manage_performance"],
      mode: "any",
    });
  const canEdit =
    actor.isAdmin ||
    canPerformPermission(actor.permissionLabels, {
      permissions: ["kpi_definitions:update", "manage_performance"],
      mode: "any",
    });
  const load = useCallback(async () => {
    const { commit } = begin();
    if (!credential) {
      commit(() => {
        setError("Please sign in again.");
        setLoading(false);
      });
      return;
    }
    commit(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const result = await listPerformanceKpiCategories(credential);
      commit(() => setRows(result));
    } catch (cause) {
      commit(() =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Categories could not be loaded.",
        ),
      );
    } finally {
      commit(() => setLoading(false));
    }
  }, [begin, credential]);
  useEffect(() => {
    setRows([]);
    setEditor(null);
    setDeleting(null);
    setSaving(false);
    setFormError(null);
    pending.current = false;
  }, [identityVersion]);
  useEffect(() => {
    if (actor.ready && canRead) void load();
    return invalidate;
  }, [actor.ready, canRead, load, invalidate]);
  function edit(category: Category | "new") {
    setEditor(category);
    setName(category === "new" ? "" : category.name);
    setDescription(category === "new" ? "" : (category.description ?? ""));
    setFormError(null);
  }
  async function save() {
    if (pending.current || !editor || !credential) return;
    const result = schema.safeParse({
      name: cleanKpiCategory(name),
      description,
    });
    if (!result.success) {
      setFormError(result.error.issues[0].message);
      return;
    }
    pending.current = true;
    setSaving(true);
    setFormError(null);
    const { commit, current } = beginMutation();
    try {
      if (editor === "new")
        await createPerformanceKpiCategory(credential, result.data);
      else
        await updatePerformanceKpiCategory(credential, editor.id, result.data);
      if (!current()) return;
      commit(() => {
        setEditor(null);
        toast.success("Category saved");
      });
      await load();
      if (current()) onChanged?.();
    } catch (cause) {
      commit(() =>
        setFormError(
          cause instanceof Error
            ? cause.message
            : "Category could not be saved.",
        ),
      );
    } finally {
      if (current()) {
        pending.current = false;
        commit(() => setSaving(false));
      }
    }
  }
  async function remove() {
    if (pending.current || !deleting || !credential) return;
    pending.current = true;
    setSaving(true);
    setFormError(null);
    const { commit, current } = beginMutation();
    try {
      await deletePerformanceKpiCategory(credential, deleting.id);
      if (!current()) return;
      commit(() => {
        setDeleting(null);
        toast.success("Category deleted");
      });
      await load();
      if (current()) onChanged?.();
    } catch (cause) {
      commit(() =>
        setFormError(
          cause instanceof Error
            ? cause.message
            : "Category could not be deleted.",
        ),
      );
    } finally {
      if (current()) {
        pending.current = false;
        commit(() => setSaving(false));
      }
    }
  }
  if (!actor.ready) return <Spinner label="Checking access" />;
  if (!canRead)
    return (
      <FluentNotice intent="warning">
        You do not have permission to manage KPI categories.
      </FluentNotice>
    );
  const filtered = rows.filter((category) =>
    `${category.name} ${category.description ?? ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const isDefault = (category: Category) =>
    ["delivery", "quality"].includes(category.name.toLocaleLowerCase("en"));
  return (
    <section className={styles.root}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-xl font-semibold">KPI categories</h1>
            <Text size={200}>
              Organize KPIs by Delivery, Quality, or your own categories.
            </Text>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!embedded && (
            <Button
              appearance="secondary"
              icon={<ArrowLeft20Regular />}
              onClick={() =>
                router.push("/dashboard/performance/setup?step=kpis")
              }
            >
              Back to KPIs
            </Button>
          )}
        </div>
      </div>
      <div>
        <div className={styles.toolbar}>
          <Input
            aria-label="Search categories"
            placeholder="Search categories"
            contentBefore={<Search20Regular />}
            value={search}
            onChange={(_event, data) => setSearch(data.value)}
          />
          <Button
            appearance="subtle"
            icon={<ArrowClockwise20Regular />}
            aria-label="Refresh categories"
            disabled={loading || saving}
            onClick={() => void load()}
          />
          {canCreate ? (
            <Button
              appearance="primary"
              icon={<Add20Regular />}
              disabled={saving}
              onClick={() => edit("new")}
            >
              Add category
            </Button>
          ) : null}
        </div>
        {error ? (
          <FluentNotice intent="error">{error}</FluentNotice>
        ) : loading ? (
          <Spinner label="Loading categories" />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="KPI categories" className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell className={styles.actionHeading}>
                    Actions
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className={styles.name}>
                        <Text weight="semibold">{category.name}</Text>
                        {isDefault(category) ? (
                          <Badge appearance="tint">Default</Badge>
                        ) : null}
                      </div>
                      <Text className={styles.description} size={200}>
                        {category.description || "No description added."}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <div className={styles.actions}>
                        {canEdit ? (
                          <Button
                            appearance="primary"
                            size="small"
                            aria-label={`Edit ${category.name}`}
                            icon={<Edit20Regular />}
                            disabled={saving}
                            onClick={() => edit(category)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canEdit && !isDefault(category) ? (
                          <Button
                            appearance="secondary"
                            size="small"
                            icon={<Delete20Regular />}
                            className={styles.deleteButton}
                            aria-label={`Delete ${category.name}`}
                            disabled={saving}
                            onClick={() => {
                              setDeleting(category);
                              setFormError(null);
                            }}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      No categories match your search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Dialog
        open={editor !== null}
        onOpenChange={(_event, data) => {
          if (!saving && !data.open) setEditor(null);
        }}
      >
        <DialogSurface style={{ width: "min(440px, calc(100vw - 32px))" }}>
          <DialogBody>
            <DialogTitle>
              {editor === "new" ? "Add category" : "Edit category"}
            </DialogTitle>
            <DialogContent className="flex flex-col gap-3">
              <Field label="Name" required>
                <Input
                  value={name}
                  maxLength={80}
                  disabled={
                    saving ||
                    (editor !== null && editor !== "new" && isDefault(editor))
                  }
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
              {editor !== "new" && editor ? (
                <Text size={200}>
                  {isDefault(editor)
                    ? "Default names stay the same. You can edit the description."
                    : "Renaming also updates KPIs using this category."}
                </Text>
              ) : null}
              {formError ? (
                <FluentNotice intent="error">{formError}</FluentNotice>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                disabled={saving}
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(_event, data) => {
          if (!saving && !data.open) setDeleting(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogContent>
              <Text>
                Delete “{deleting?.name}”? Categories used by KPIs cannot be
                deleted.
              </Text>
              {formError ? (
                <FluentNotice intent="error">{formError}</FluentNotice>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                disabled={saving}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={saving}
                onClick={() => void remove()}
              >
                {saving ? "Deleting…" : "Delete"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}
