import { forwardRef, type ComponentProps, type InputHTMLAttributes } from "react";

import { FormField } from "@/components/ui/form-field";
import { Input as SharedInput } from "@/components/ui/input";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/** Thin wrapper over the shared Fluent input that keeps the label/error/helper API. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, helperText, className, size: _size, ...props },
  ref
) {
  void _size;
  const control = (
    <SharedInput
      {...(props as Omit<ComponentProps<typeof SharedInput>, "ref">)}
      id={id}
      ref={ref}
      className={className}
      aria-invalid={Boolean(error)}
      aria-describedby={error || helperText ? `${id}-message` : undefined}
    />
  );

  if (!label) {
    return (
      <div className="grid gap-1.5">
        {control}
        {error ? (
          <p id={`${id}-message`} role="alert" className="text-[11px] leading-snug text-destructive">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${id}-message`} className="text-[11px] leading-snug text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <FormField label={label} htmlFor={id} required={props.required} error={error} hint={helperText}>
      {control}
    </FormField>
  );
});
