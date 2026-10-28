"use client";

import * as React from "react";
import {
  Button,
  Textarea as FluentTextarea,
  type TextareaProps as FluentTextareaProps,
} from "@fluentui/react-components";
import {
  TextBold20Regular,
  TextBulletListLtr20Regular,
  TextItalic20Regular,
  TextNumberListLtr20Regular,
} from "@fluentui/react-icons";

import { Error } from "@/components/ui/error";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<FluentTextareaProps, "size"> & {
  error?: string;
  size?: "xSmall" | "small" | "mediumSmall" | "large";
  containerClassName?: string;
  formatting?: boolean;
};

const sizeClasses: Record<NonNullable<TextareaProps["size"]>, string> = {
  xSmall: "min-h-9 text-xs",
  small: "min-h-10 text-sm",
  mediumSmall: "min-h-11 text-sm",
  large: "min-h-12 text-base",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdownToHtml(value: string) {
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
  const lines = value.split("\n");
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const unordered = /^-\s+(.*)$/.exec(lines[index]);
    const ordered = /^\d+\.\s+(.*)$/.exec(lines[index]);
    if (unordered || ordered) {
      const tag = ordered ? "ol" : "ul";
      const pattern = ordered ? /^\d+\.\s+(.*)$/ : /^-\s+(.*)$/;
      const items: string[] = [];
      while (index < lines.length) {
        const match = pattern.exec(lines[index]);
        if (!match) break;
        items.push(`<li>${inline(match[1])}</li>`);
        index += 1;
      }
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    output.push(
      lines[index] ? `<div>${inline(lines[index])}</div>` : "<div><br></div>",
    );
    index += 1;
  }
  return output.join("");
}

function editorToMarkdown(root: HTMLElement) {
  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const content = Array.from(node.childNodes).map(inline).join("");
    if (node.tagName === "BR") return "\n";
    if (node.tagName === "B" || node.tagName === "STRONG")
      return `**${content}**`;
    if (node.tagName === "I" || node.tagName === "EM") return `_${content}_`;
    return content;
  };

  return Array.from(root.childNodes)
    .map((node) => {
      if (!(node instanceof HTMLElement)) return inline(node);
      if (node.tagName === "UL" || node.tagName === "OL") {
        return Array.from(node.children)
          .map((item, index) => {
            const marker = node.tagName === "OL" ? `${index + 1}.` : "-";
            return `${marker} ${Array.from(item.childNodes).map(inline).join("")}`;
          })
          .join("\n");
      }
      return inline(node);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      containerClassName,
      disabled,
      error,
      formatting,
      size = "small",
      value,
      defaultValue,
      onChange,
      placeholder,
      maxLength,
      readOnly,
      ...props
    },
    ref,
  ) => {
    const richText = formatting ?? !className?.includes("font-mono");
    const hiddenRef = React.useRef<HTMLTextAreaElement>(null);
    const editorRef = React.useRef<HTMLDivElement>(null);
    const currentValue = String(value ?? defaultValue ?? "");

    React.useLayoutEffect(() => {
      if (!richText) return;
      const editor = editorRef.current;
      if (!editor || document.activeElement === editor) return;
      const html = markdownToHtml(currentValue);
      if (editor.innerHTML !== html) editor.innerHTML = html;
    }, [currentValue, richText]);

    const emitChange = (nextValue: string) => {
      const textarea = hiddenRef.current;
      if (!textarea) return;
      textarea.value = nextValue;
      const event = {
        target: textarea,
        currentTarget: textarea,
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange?.(event, { value: nextValue });
    };

    const runCommand = (command: string) => {
      if (disabled || readOnly) return;
      editorRef.current?.focus();
      document.execCommand(command);
      if (editorRef.current) emitChange(editorToMarkdown(editorRef.current));
    };

    if (richText) {
      const richEditor = (
        <div
          className={cn(
            "w-full overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/30",
            disabled && "cursor-not-allowed opacity-70",
            error && "border-destructive ring-2 ring-destructive/15",
            containerClassName,
          )}
        >
          <div
            role="toolbar"
            aria-label="Text formatting"
            className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1"
          >
            {[
              ["Bold", "bold", <TextBold20Regular key="bold" />],
              ["Italic", "italic", <TextItalic20Regular key="italic" />],
              [
                "Bulleted list",
                "insertUnorderedList",
                <TextBulletListLtr20Regular key="bullets" />,
              ],
              [
                "Numbered list",
                "insertOrderedList",
                <TextNumberListLtr20Regular key="numbers" />,
              ],
            ].map(([label, command, icon]) => (
              <Button
                key={String(command)}
                type="button"
                appearance="subtle"
                size="small"
                icon={icon as React.ReactElement}
                aria-label={String(label)}
                title={String(label)}
                disabled={disabled || readOnly}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(String(command))}
              />
            ))}
          </div>
          <div
            ref={editorRef}
            role="textbox"
            aria-label={props["aria-label"] ?? placeholder ?? "Formatted text"}
            aria-multiline="true"
            contentEditable={!disabled && !readOnly}
            suppressContentEditableWarning
            data-placeholder={placeholder}
            aria-describedby={props["aria-describedby"]}
            style={{
              ...props.style,
              minHeight: props.rows
                ? `${Math.max(3, Number(props.rows)) * 1.5 + 1}rem`
                : props.style?.minHeight,
            }}
            className={cn(
              "min-h-20 px-3 py-2 font-sans text-foreground outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc",
              sizeClasses[size],
              className,
            )}
            onInput={(event) => {
              let next = editorToMarkdown(event.currentTarget);
              if (maxLength && next.length > maxLength)
                next = next.slice(0, maxLength);
              emitChange(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const selection = window.getSelection();
                const anchor = selection?.anchorNode;
                const element =
                  anchor instanceof HTMLElement
                    ? anchor
                    : anchor?.parentElement;
                if (element?.closest("li")?.textContent?.trim()) {
                  event.preventDefault();
                  document.execCommand("insertParagraph");
                  window.requestAnimationFrame(() => {
                    if (editorRef.current)
                      emitChange(editorToMarkdown(editorRef.current));
                  });
                  return;
                }
              }
              if (!(event.ctrlKey || event.metaKey)) return;
              const key = event.key.toLowerCase();
              if (key === "b" || key === "i") {
                event.preventDefault();
                runCommand(key === "b" ? "bold" : "italic");
              }
            }}
          />
          <FluentTextarea
            {...props}
            ref={(node) => {
              hiddenRef.current = node;
              assignRef(ref, node);
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            value={currentValue}
            readOnly
          />
        </div>
      );
      return error ? (
        <div className="flex w-full flex-col gap-2">
          {richEditor}
          <Error size={size === "large" ? "large" : "small"}>{error}</Error>
        </div>
      ) : (
        richEditor
      );
    }

    const textarea = (
      <FluentTextarea
        ref={ref}
        data-slot="textarea"
        appearance="outline"
        resize="none"
        size={
          size === "large" ? "large" : size === "xSmall" ? "small" : "medium"
        }
        className={cn(
          "w-full min-w-0 max-w-none font-sans text-foreground",
          sizeClasses[size],
          disabled && "cursor-not-allowed text-muted-foreground",
          error && "text-destructive ring-2 ring-destructive/15",
          className,
        )}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={readOnly}
        {...props}
      />
    );

    if (!error) {
      if (!containerClassName) {
        return textarea;
      }

      return <div className={cn("w-full", containerClassName)}>{textarea}</div>;
    }

    return (
      <div className={cn("flex w-full flex-col gap-2", containerClassName)}>
        {textarea}
        <Error size={size === "large" ? "large" : "small"}>{error}</Error>
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
