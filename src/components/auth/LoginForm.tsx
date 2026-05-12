import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { isValidEmail, hasMinLength } from "@/utils/validators";

interface LoginFormProps {
  onSubmit: (payload: { identifier: string; password: string }) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function LoginForm({ onSubmit, loading = false, error }: LoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);

    if (!isValidEmail(identifier)) {
      setFieldError("Enter a valid work email address.");
      return;
    }

    if (!hasMinLength(password, 8)) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }

    await onSubmit({ identifier: identifier.trim().toLowerCase(), password });
  };

  return (
    <form className="form-stack" onSubmit={handleSubmit} noValidate>
      <Input
        id="identifier"
        label="Work email"
        type="email"
        autoComplete="username"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
        placeholder="name@company.com"
        required
      />

      <Input
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      {fieldError ? <p className="input-message input-message-error">{fieldError}</p> : null}
      {error ? <p className="input-message input-message-error">{error}</p> : null}

      <Button type="submit" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}
