"use client";
import * as React from "react";
import type {
  ContractField,
  ContractFieldMetadata,
  ContractSection,
} from "@/lib/contracts-api";
import { contractWorkspaceMessages as m } from "./contract-workspace-messages";
import { toast } from "@/components/ui/fluent-toast-store";
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

/** Uses the same lowercase/underscore grammar as the server renderer. */
export function clauseTokenErrors(
  sections: ContractSection[],
  metadata: ContractFieldMetadata[],
): string[] {
  const allowed = new Set(metadata.map((item) => item.key));
  const errors: string[] = [];
  for (const section of sections.filter((entry) => entry.enabled !== false)) {
    for (const text of [section.heading, section.body]) {
      const remainder = text.replace(
        /\{\{([^{}]*?)\}\}/g,
        (_match, token: string) => {
          const trimmed = token.trim();
          if (!/^[a-z_]+$/.test(trimmed) || !allowed.has(trimmed))
            errors.push(trimmed || "{{ }}");
          return "";
        },
      );
      if (remainder.includes("{{") || remainder.includes("}}"))
        errors.push("{{…}}");
    }
  }
  return [...new Set(errors)];
}

export function ContractWorkspaceClauses({
  sections,
  metadata,
  fields,
  onChange,
  templateSections,
}: {
  sections: ContractSection[];
  metadata: ContractFieldMetadata[];
  fields: ContractField[];
  onChange: (sections: ContractSection[]) => void;
  templateSections?: ContractSection[];
}) {
  const [focused, setFocused] = React.useState<{
    id: string;
    part: number;
  } | null>(null);
  const [suggest, setSuggest] = React.useState<string | null>(null);
  const [dragged, setDragged] = React.useState<number | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const sectionsRef = React.useRef(sections);
  React.useEffect(() => { sectionsRef.current = sections; }, [sections]);
  const textareas = React.useRef<Record<string, HTMLTextAreaElement | null>>(
    {},
  );
  const partsOf = (body: string) => body.split(/(\{\{[^{}]*\}\})/g);
  const update = (index: number, patch: Partial<ContractSection>) =>
    onChange(
      sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const insert = (key: string, autocomplete = false) => {
    const index = sections.findIndex((s) => s.id === focused?.id);
    if (index < 0 || sections[index].editable === false) return;
    const parts = partsOf(sections[index].body);
    const part = focused!.part;
    const area = textareas.current[`${focused!.id}:${part}`];
    const text = parts[part] ?? "";
    const at = area?.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const start = autocomplete ? Math.max(0, before.lastIndexOf("{{")) : at;
    parts[part] = text.slice(0, start) + `{{${key}}}` + text.slice(at);
    const body = parts.join("");
    update(index, { body });
    setSuggest(null);
    requestAnimationFrame(() => {
      const next = textareas.current[`${focused!.id}:${part + 2}`];
      next?.focus();
      next?.setSelectionRange(0, 0);
    });
  };
  let number = 0;
  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="w-fit rounded border border-border p-2"
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? m.expandAll : m.collapseAll}
      </button>
      <label className="grid gap-1">
        {m.insertField}
        <select
          aria-label={m.insertField}
          className="rounded border border-border bg-background p-2"
          value=""
          onChange={(event) => {
            if (event.target.value) insert(event.target.value);
          }}
        >
          <option value="">{m.choose}</option>
          {[...new Set(metadata.map((item) => item.group))].map((group) => (
            <optgroup key={group} label={group}>
              {metadata
                .filter((item) => item.group === group)
                .map((item) => (
                  <option key={item.key} value={item.key}>
                    {m.label(item.key)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <ol className="grid gap-3">
        {sections.map((section, index) => {
          const currentNumber = section.enabled === false ? null : ++number;
          const parts = partsOf(section.body);
          const sectionErrors = clauseTokenErrors([section], metadata);
          const editable = section.editable !== false;
          const template = templateSections?.find(
            (item) => item.id === section.id,
          );
          const modified =
            !!template &&
            (template.heading !== section.heading ||
              template.body !== section.body);
          const removable = editable && section.optional !== false;
          return (
            <li
              key={section.id}
              draggable
              onDragStart={() => setDragged(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged !== null) move(dragged, index);
                setDragged(null);
              }}
              className={`group grid gap-2 rounded-lg border bg-background p-3 shadow-xs transition-shadow hover:shadow-sm ${section.enabled === false ? "border-dashed border-border opacity-70" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={
                    currentNumber
                      ? "inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {currentNumber ?? m.optionalDisabled}
                </span>
                {!editable ? (
                  <span
                    aria-label={m.locked}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Lock className="size-3" aria-hidden /> {m.locked}
                  </span>
                ) : null}
                {modified ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    {m.modifiedTemplate}
                  </span>
                ) : null}
                {section.optional === true ? (
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={section.enabled !== false}
                      onChange={(event) =>
                        update(index, { enabled: event.target.checked })
                      }
                    />
                    {m.enabled}
                  </label>
                ) : null}
                <span className="flex-1" />
                {modified && editable && template ? (
                  <button
                    type="button"
                    className={iconBtn}
                    title={m.resetTemplate}
                    onClick={() =>
                      update(index, {
                        heading: template.heading,
                        body: template.body,
                      })
                    }
                  >
                    <RotateCcw className="size-4" aria-hidden /><span className="sr-only">{m.resetTemplate}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className={iconBtn}
                  title={m.moveUp}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="size-4" aria-hidden /><span className="sr-only">{m.moveUp}</span>
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  title={m.moveDown}
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="size-4" aria-hidden /><span className="sr-only">{m.moveDown}</span>
                </button>
                {removable ? (
                  <button
                    type="button"
                    className={`${iconBtn} hover:bg-rose-50 hover:text-rose-700`}
                    title={m.removeClause}
                    onClick={() => {
                      onChange(sections.filter((_, i) => i !== index));
                      toast.message(m.clauseRemoved, {
                        description: (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => {
                              if (
                                sectionsRef.current.some(
                                  (item) => item.id === section.id,
                                )
                              )
                                return;
                              const restored = [...sectionsRef.current];
                              restored.splice(
                                Math.min(index, restored.length),
                                0,
                                section,
                              );
                              onChange(restored);
                            }}
                          >
                            {m.undo}
                          </button>
                        ),
                      });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden /><span className="sr-only">{m.removeClause}</span>
                  </button>
                ) : null}
              </div>
              {!collapsed && (
                <>
                  <input
                    aria-label={m.clauseTitle}
                    readOnly={!editable}
                    className="rounded-md border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold hover:border-border focus:border-primary focus:outline-none"
                    value={section.heading}
                    onChange={(event) =>
                      update(index, { heading: event.target.value })
                    }
                  />
                  <div className="grid gap-1 rounded-md bg-muted/40 p-2">
                    {parts.map((part, partIndex) => {
                      const match = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(part);
                      const known =
                        match && metadata.some((item) => item.key === match[1]);
                      if (match && known) {
                        const field = fields.find(
                          (item) => item.key === match[1],
                        );
                        return (
                          <span
                            key={partIndex}
                            className="w-fit rounded-full border border-border px-2 text-xs"
                            title={`${m.tokenValue}: ${field?.hidden ? m.hidden : field?.value || m.empty}`}
                          >
                            {m.label(match[1])}
                            {editable ? (
                              <button
                                type="button"
                                aria-label={`${m.removeField}: ${m.label(match[1])}`}
                                onClick={() => {
                                  const next = [...parts];
                                  next.splice(partIndex, 1);
                                  update(index, { body: next.join("") });
                                }}
                              >
                                {" "}
                                ×
                              </button>
                            ) : null}
                          </span>
                        );
                      }
                      return (
                        <textarea
                          key={partIndex}
                          ref={(element) => {
                            textareas.current[`${section.id}:${partIndex}`] =
                              element;
                          }}
                          aria-label={m.clauseBody}
                          aria-invalid={sectionErrors.length > 0}
                          readOnly={!editable}
                          className={`min-h-20 w-full rounded-md border bg-background p-2.5 text-sm leading-relaxed focus:border-primary focus:outline-none ${sectionErrors.length ? "border-destructive" : "border-border"} ${/^\{\{[^{}]*\}\}$/.test(part) ? "text-destructive underline decoration-destructive" : ""}`}
                          value={part}
                          onFocus={() =>
                            setFocused({ id: section.id, part: partIndex })
                          }
                          onChange={(event) => {
                            const next = [...parts];
                            next[partIndex] = event.target.value;
                            update(index, { body: next.join("") });
                            const typed = /\{\{([a-z_]*)$/.exec(
                              event.target.value.slice(
                                0,
                                event.target.selectionStart,
                              ),
                            );
                            setSuggest(typed ? typed[1] : null);
                          }}
                        />
                      );
                    })}
                  </div>
                  {editable &&
                    sectionErrors.map((bad) => (
                      <label key={bad} className="grid gap-1 text-destructive">
                        <span>
                          {m.invalidTokens} <u>{bad}</u>
                        </span>
                        {bad !== "{{…}}" ? (
                          <select
                            aria-label={`${m.replaceWith}: ${bad}`}
                            className="rounded border border-border bg-background p-2 text-foreground"
                            value=""
                            onChange={(event) => {
                              const replacement = event.target.value;
                              if (!replacement) return;
                              let replaced = false;
                              const replace = (text: string) =>
                                text.replace(
                                  /\{\{([^{}]*?)\}\}/g,
                                  (whole, token: string) => {
                                    if (!replaced && token.trim() === bad) {
                                      replaced = true;
                                      return `{{${replacement}}}`;
                                    }
                                    return whole;
                                  },
                                );
                              const heading = replace(section.heading);
                              const body = replace(section.body);
                              update(index, { heading, body });
                            }}
                          >
                            <option value="">{m.replaceWith}</option>
                            {[
                              ...new Set(metadata.map((item) => item.group)),
                            ].map((group) => (
                              <optgroup key={group} label={group}>
                                {metadata
                                  .filter((item) => item.group === group)
                                  .map((item) => (
                                    <option key={item.key} value={item.key}>
                                      {m.label(item.key)}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                        ) : null}
                      </label>
                    ))}
                  {focused?.id === section.id &&
                  suggest !== null &&
                  editable ? (
                    <ul className="rounded border border-border p-2">
                      {[...new Set(metadata.map((item) => item.group))].map(
                        (group) => {
                          const matches = metadata.filter(
                            (item) =>
                              item.group === group &&
                              (item.key.includes(suggest) ||
                                m
                                  .label(item.key)
                                  .toLowerCase()
                                  .includes(suggest.toLowerCase())),
                          );
                          return matches.length ? (
                            <li key={group}>
                              <span className="font-semibold">{group}</span>
                              <ul>
                                {matches.map((item) => (
                                  <li key={item.key}>
                                    <button
                                      type="button"
                                      onMouseDown={(event) =>
                                        event.preventDefault()
                                      }
                                      onClick={() => insert(item.key, true)}
                                    >
                                      {m.label(item.key)}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ) : null;
                        },
                      )}
                    </ul>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
        onClick={() =>
          onChange([
            ...sections,
            {
              id: `clause_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`,
              heading: m.addClause,
              body: "",
            },
          ])
        }
      >
        <Plus className="size-4" aria-hidden />{m.addClause}
      </button>
    </div>
  );
}
