import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";

interface OTPVerificationProps {
  challengeId: string;
  onVerify: (otpCode: string) => Promise<void>;
  onBack: () => void;
  loading?: boolean;
  error?: string | null;
}

export function OTPVerification({
  challengeId,
  onVerify,
  onBack,
  loading = false,
  error,
}: OTPVerificationProps) {
  const [otpCode, setOtpCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setFieldError("Enter the 6-digit verification code.");
      return;
    }

    await onVerify(otpCode.trim());
  };

  return (
    <form className="form-stack" onSubmit={handleSubmit} noValidate>
      <p className="meta-text">
        Challenge ID: <strong>{challengeId}</strong>
      </p>

      <Input
        id="otpCode"
        label="Verification code"
        inputMode="numeric"
        maxLength={6}
        autoComplete="one-time-code"
        value={otpCode}
        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        required
      />

      {fieldError ? <p className="input-message input-message-error">{fieldError}</p> : null}
      {error ? <p className="input-message input-message-error">{error}</p> : null}

      <div className="actions-row">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={loading}>
          Verify
        </Button>
      </div>
    </form>
  );
}
