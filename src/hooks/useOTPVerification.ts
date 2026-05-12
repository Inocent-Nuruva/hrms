// ─────────────────────────────────────────────────────────────────────────────
// hooks/useOTPVerification.ts
// Hook that wraps the "verify OTP" step with loading + error state
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { verifyOTP, storeToken } from "../lib/auth-client";
import type { VerifyOTPResponse, UseOTPVerificationReturn } from "../types/auth";

export function useOTPVerification(): UseOTPVerificationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  const verifyOTPHandler = useCallback(
    async (contact: string, otp: string): Promise<VerifyOTPResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await verifyOTP({ contact, otp });

        // Persist token if returned
        if (response.token) {
          storeToken(response.token);
        }

        return response;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Invalid verification code. Please try again.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    verifyOTP: verifyOTPHandler,
    isLoading,
    error,
    reset,
  };
}
