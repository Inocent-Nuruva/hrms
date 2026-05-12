import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { validatePasswordPolicy } from "@/utils/validators";

interface ChangePasswordFormProps {
  onSubmit: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function ChangePasswordForm({ onSubmit, loading = false, error }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    const issues = validatePasswordPolicy(newPassword);
    if (issues.length > 0) {
      setFieldError(issues[0]);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldError("New password and confirmation do not match.");
      return;
    }

    await onSubmit({ currentPassword, newPassword, confirmPassword });
  };

  return (
    <form className="form-stack" onSubmit={handleSubmit} noValidate>
      <Input
        id="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        required
      />

      <Input
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        required
      />

      <Input
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        required
      />

      {fieldError ? <p className="input-message input-message-error">{fieldError}</p> : null}
      {error ? <p className="input-message input-message-error">{error}</p> : null}

      <Button type="submit" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
