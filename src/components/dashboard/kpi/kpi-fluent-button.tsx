"use client";

import * as React from "react";
import { Button, tokens, type ButtonProps } from "@fluentui/react-components";
import { fluentControlClass } from "./kpi-fluent-class";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ButtonProps["icon"] };

/** Keeps the native button submit behavior used by existing KPI forms. */
export function KpiFluentButton({ className = "", type = "submit", style, ...props }: Props) {
  const appearance = className.includes("underline")
    ? "subtle"
    : className.includes("bg-blue") || className.includes("bg-green") || className.includes("bg-[var(--primary)]")
      ? "primary"
      : "secondary";
  const tone = /text-(?:red|destructive)/.test(className) ? tokens.colorPaletteRedForeground1 : className.includes("text-primary") ? tokens.colorBrandForeground1 : undefined;
  return <Button as="button" appearance={appearance} type={type} className={fluentControlClass(className)} style={{ ...style, ...(tone ? { color: tone } : {}) }} {...props} />;
}
