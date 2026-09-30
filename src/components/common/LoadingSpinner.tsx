import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  const fluentSize = size === "sm" ? "small" : size === "lg" ? "large" : "medium";
  return <FluentLoadingIndicator size={fluentSize} />;
}
