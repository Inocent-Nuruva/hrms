import * as React from "react";

interface InputOTPContextValue {
  value: string;
  maxLength: number;
  setChar: (index: number, char: string) => void;
}

const InputOTPContext = React.createContext<InputOTPContextValue | null>(null);

interface InputOTPProps {
  maxLength: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  children: React.ReactNode;
}

export function InputOTP({ maxLength, value, onChange, onComplete, autoFocus = false, children }: InputOTPProps) {
  const setChar = (index: number, char: string) => {
    const normalizedChar = char.replace(/\D/g, "").slice(0, 1);
    const chars = value.split("");
    chars[index] = normalizedChar;
    const nextValue = chars.join("").slice(0, maxLength);
    onChange(nextValue);

    if (nextValue.length === maxLength && /^\d+$/.test(nextValue)) {
      onComplete?.(nextValue);
    }
  };

  React.useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const firstInput = document.querySelector<HTMLInputElement>("[data-otp-index='0']");
    firstInput?.focus();
  }, [autoFocus]);

  return (
    <InputOTPContext.Provider value={{ value, maxLength, setChar }}>
      <div>{children}</div>
    </InputOTPContext.Provider>
  );
}

export function InputOTPGroup({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-center gap-2 ${className}`.trim()}>{children}</div>;
}

interface InputOTPSlotProps {
  index: number;
  className?: string;
  style?: React.CSSProperties;
}

export function InputOTPSlot({ index, className = "", style }: InputOTPSlotProps) {
  const context = React.useContext(InputOTPContext);
  if (!context) {
    return null;
  }

  const char = context.value[index] ?? "";

  return (
    <input
      data-otp-index={index}
      value={char}
      inputMode="numeric"
      className={className}
      style={style}
      onChange={(event) => {
        context.setChar(index, event.target.value);

        if (event.target.value && index < context.maxLength - 1) {
          const next = document.querySelector<HTMLInputElement>(`[data-otp-index='${index + 1}']`);
          next?.focus();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && !char && index > 0) {
          const prev = document.querySelector<HTMLInputElement>(`[data-otp-index='${index - 1}']`);
          prev?.focus();
        }
      }}
    />
  );
}

export function InputOTPSeparator({ className = "", children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={className} {...props}>
      {children}
    </span>
  );
}
