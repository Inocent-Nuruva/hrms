"use client";

import * as React from "react";
import { Button, Input, Select, Textarea } from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
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

export function KpiFluentSelect(props: React.ComponentProps<typeof Select>) {
  return <Select {...props} icon={props.icon ?? <ChevronDownRegular />} className={fluentControlClass(props.className)} />;
}

export function KpiFluentTextarea(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={fluentControlClass(props.className)} />;
}
