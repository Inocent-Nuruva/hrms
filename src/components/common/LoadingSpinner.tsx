import { LumaSpin } from "@/components/ui/luma-spin";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  // Note: LumaSpin is fixed size; for variable sizes consider scaling or variant
  return <LumaSpin />;
}
