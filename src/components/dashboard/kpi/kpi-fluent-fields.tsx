"use client";

import * as React from "react";
import { Button, Dropdown, Input, Option, Textarea } from "@fluentui/react-components";
import { DateInput } from "@/components/ui/date-input";
import { fluentControlClass } from "./kpi-fluent-class";

export function KpiFluentInput({ type = "text", onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  if (type === "date") {
    return <DateInput {...props as React.ComponentProps<typeof DateInput>} className={fluentControlClass(props.className)} value={String(props.value ?? "")} onValueChange={(value) => onChange?.({ target: { value }, currentTarget: { value } } as React.ChangeEvent<HTMLInputElement>)} />;
  }
  if (type === "file") {
    return <FluentFilePicker {...props} className={props.className} onChange={onChange} />;
  }
  return <Input type={type as React.ComponentProps<typeof Input>["type"]} onChange={onChange as React.ComponentProps<typeof Input>["onChange"]} {...props as React.ComponentProps<typeof Input>} className={fluentControlClass(props.className)} />;
}

function FluentFilePicker({
  className,
  onChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState("");
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className ?? ""}`}>
      <input
        {...props}
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          setFileName(event.currentTarget.files?.[0]?.name ?? "");
          onChange?.(event);
        }}
      />
      <Button type="button" appearance="secondary" disabled={props.disabled} onClick={() => inputRef.current?.click()}>
        Choose file
      </Button>
      <span role="status" className="min-w-0 truncate text-sm text-muted-foreground">
        {fileName || "No file selected"}
      </span>
    </div>
  );
}

type SelectOption = { value: string; label: string; disabled: boolean };

function optionLabel(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionLabel).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return optionLabel(node.props.children);
  return "";
}

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      options.push(...collectOptions((child.props as { children?: React.ReactNode }).children));
      return;
    }
    if (child.type !== "option") return;
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    const label = optionLabel(props.children);
    options.push({ value: props.value == null ? label : String(props.value), label, disabled: !!props.disabled });
  });
  return options;
}

type KpiFluentSelectProps = {
  children?: React.ReactNode;
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  appearance?: React.ComponentProps<typeof Dropdown>["appearance"];
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  title?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function KpiFluentSelect({ children, value, onChange, className, appearance, disabled, required, id, name, title, style, tabIndex, autoFocus, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy }: KpiFluentSelectProps) {
  const options = collectOptions(children);
  const selectedValue = String(value ?? "");
  const selected = options.find((option) => option.value === selectedValue);
  const dropdownRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <Dropdown
        ref={dropdownRef}
        id={id}
        name={name}
        title={title}
        style={style}
        tabIndex={tabIndex}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        aria-required={required || undefined}
        appearance={appearance}
        className={`${fluentControlClass(className)} min-w-0`}
        button={{ className: "!w-full !min-w-0" }}
        selectedOptions={selected ? [selectedValue] : []}
        value={selected?.label ?? ""}
        onOptionSelect={(_, data) => {
          const nextValue = data.optionValue ?? "";
          onChange?.({ target: { value: nextValue }, currentTarget: { value: nextValue } } as React.ChangeEvent<HTMLSelectElement>);
        }}
      >
        {options.map((option) => <Option key={option.value} value={option.value} text={option.label} disabled={option.disabled}>{option.label}</Option>)}
      </Dropdown>
      {required && (
        <select aria-hidden="true" tabIndex={-1} required value={selectedValue} onChange={() => {}} onInvalid={(event) => { event.preventDefault(); dropdownRef.current?.focus(); }} className="pointer-events-none absolute size-px opacity-0">
          {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
      )}
    </>
  );
}

export function KpiFluentTextarea(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={fluentControlClass(props.className)} />;
}
