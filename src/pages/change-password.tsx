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
  const { tokens, user, refreshCurrentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiresPasswordChange =
    router.query.required === "1" || user?.requiresPasswordChange === true;

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
      await refreshCurrentUser();
      router.push(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Change password"
      subtitle={
        requiresPasswordChange
          ? "Change the temporary password you received before you can continue."
          : "Keep your ESS account secure."
      }
    >
      <Card
        title="Password update"
        description={
          requiresPasswordChange
            ? "Your account was created with a temporary password. Set a new secure password to continue."
            : "Set a strong password that meets company policy."
        }
      >
        <ChangePasswordForm onSubmit={handleSubmit} loading={isLoading} error={error} />
      </Card>
    </AuthLayout>
  );
}
