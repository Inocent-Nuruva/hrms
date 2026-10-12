import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as AppButton } from "@/components/ui/button";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const fluentVariants = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
} as const;

const fluentSizes = {
  sm: "small",
  md: "medium",
  lg: "large",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <AppButton
      variant={fluentVariants[variant]}
      size={fluentSizes[size]}
      className={className}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </AppButton>
  );
}
