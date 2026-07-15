import { useState } from "react";
import { authService } from "@/services/authService";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import {
  clearStoredSession,
  persistSessionTokens,
} from "@/lib/session-client";
import { publishDashboardActorSnapshotFromSources } from "@/lib/dashboard-permissions";
import type {
  AuthTokens,
  AuthUser,
  LoginRequest,
  LoginResponse,
  VerifyOtpResponse,
} from "@/types";

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [storedTokens, setStoredTokens, clearStoredTokens] = useLocalStorage<AuthTokens | null>(
    AUTH_STORAGE_KEYS.tokens,
    null
  );
  const [storedUser, setStoredUser, clearStoredUser] = useLocalStorage<AuthUser | null>(
    AUTH_STORAGE_KEYS.user,
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    clearStoredTokens();
    clearStoredUser();
    clearStoredSession();
  };

  const saveSession = (tokens: AuthTokens, user?: AuthUser) => {
    persistSessionTokens(tokens.accessToken, tokens.refreshToken);
    setStoredTokens(tokens);
    if (user) {
      setStoredUser(user);
    }
    publishDashboardActorSnapshotFromSources(user ?? null, tokens, tokens.accessToken);
    setError(null);
  };

  const login = async (payload: LoginRequest): Promise<LoginResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(payload);

      if (!response.requiresOtp && response.tokens) {
        saveSession(response.tokens, response.user);
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const completeOtpLogin = async (tempToken: string, code: string): Promise<VerifyOtpResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyOtp({ tempToken, code });
      saveSession(response.tokens, response.user);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "OTP verification failed.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const accessToken = storedTokens?.accessToken;

  const refreshCurrentUser = async () => {
    if (!accessToken) {
      return null;
    }

    setIsLoading(true);

    try {
      const user = await authService.getCurrentUser(accessToken);
      setStoredUser(user);
      publishDashboardActorSnapshotFromSources(user, storedTokens, accessToken);
      return user;
    } catch {
      clearSession();
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout(storedTokens ?? undefined);
    clearSession();
  };

  const state: AuthState = {
    user: storedUser,
    tokens: storedTokens,
    isAuthenticated: Boolean(accessToken),
    isLoading,
    error,
  };

  return {
    ...state,
    login,
    completeOtpLogin,
    refreshCurrentUser,
    logout,
    clearSession,
  };
}
