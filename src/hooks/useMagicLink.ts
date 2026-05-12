// ─────────────────────────────────────────────────────────────────────────────
// hooks/useMagicLink.ts
// Hook that wraps the "send OTP" step with loading + error state
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { sendOTP } from "../lib/auth-client";
import type { ContactMethod, SendOTPResponse, UseMagicLinkReturn } from "../types/auth";

export function useMagicLink(): UseMagicLinkReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  const sendOTPHandler = useCallback(
    async (contact: string, method: ContactMethod): Promise<SendOTPResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await sendOTP({ contact, method });
        return response;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to send verification code. Please try again.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    sendOTP: sendOTPHandler,
    isLoading,
    error,
    reset,
  };
}
