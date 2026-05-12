import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, helperText, className = "", ...props },
  ref
) {
  return (
    <div className="input-group">
      {label ? (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      ) : null}

      <input
        id={id}
        ref={ref}
        className={`input ${error ? "input-error" : ""} ${className}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        {...props}
      />

      {error ? (
        <p id={`${id}-error`} className="input-message input-message-error" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="input-message">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
