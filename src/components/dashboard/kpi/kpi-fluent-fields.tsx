"use client";

import * as React from "react";
import { Input, Select, Textarea } from "@fluentui/react-components";
import { DateInput } from "@/components/ui/date-input";
import { fluentControlClass } from "./kpi-fluent-class";

export function KpiFluentInput({ type = "text", onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  if (type === "date") {
    return <DateInput {...props as React.ComponentProps<typeof DateInput>} className={fluentControlClass(props.className)} value={String(props.value ?? "")} onValueChange={(value) => onChange?.({ target: { value }, currentTarget: { value } } as React.ChangeEvent<HTMLInputElement>)} />;
  }
  if (type === "file") {
    return <input type={type} onChange={onChange} {...props} />;
  }
  return <Input type={type as React.ComponentProps<typeof Input>["type"]} onChange={onChange as React.ComponentProps<typeof Input>["onChange"]} {...props as React.ComponentProps<typeof Input>} className={fluentControlClass(props.className)} />;
}

export function KpiFluentSelect(props: React.ComponentProps<typeof Select>) {
  return <Select {...props} className={fluentControlClass(props.className)} />;
}

export function KpiFluentTextarea(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea {...props} className={fluentControlClass(props.className)} />;
}
