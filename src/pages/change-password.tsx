import { useState } from "react";
import { useRouter } from "next/router";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Card } from "@/components/common/Card";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { ROUTES } from "@/utils/constants";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { tokens } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!tokens?.accessToken) {
      setError("Your session is missing. Please sign in again.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.changePassword(payload, tokens.accessToken);
      router.push(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Change password" subtitle="Keep your ESS account secure.">
      <Card title="Password update" description="Set a strong password that meets company policy.">
        <ChangePasswordForm onSubmit={handleSubmit} loading={isLoading} error={error} />
      </Card>
    </AuthLayout>
  );
}
