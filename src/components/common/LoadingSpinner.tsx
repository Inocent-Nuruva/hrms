import { LumaSpin } from "@/components/ui/luma-spin";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  // Note: LumaSpin is fixed size; `size` is accepted for API compatibility with
  // callers but currently has no effect on rendering.
  void size;
  return <LumaSpin />;
}
