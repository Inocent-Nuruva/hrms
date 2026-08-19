import { useState } from "react";
import { authService } from "@/services/authService";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import {
  clearStoredSession,
  persistSessionTokens,
  readStoredSessionTokens,
} from "@/lib/session-client";
import { publishDashboardActorSnapshotFromSources } from "@/lib/dashboard-permissions";
import type {
  AuthSessionRecord,
  AuthTokens,
  AuthUser,
  AuthSwitchCompanyResponse,
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
    try {
      const session = readStoredSessionTokens();
      await authService.logout({
        accessToken: storedTokens?.accessToken || session.accessToken,
        refreshToken: storedTokens?.refreshToken || session.refreshToken,
      });
    } finally {
      clearSession();
    }
  };

  const logoutAll = async () => {
    if (!accessToken) {
      clearSession();
      return;
    }
    await authService.logoutAll(accessToken);
    clearSession();
  };

  const listSessions = async (): Promise<AuthSessionRecord[]> => {
    if (!accessToken) {
      return [];
    }
    return authService.listSessions(accessToken);
  };

  const revokeSession = async (sessionId: string) => {
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    await authService.revokeSession(accessToken, sessionId);
  };

  const switchCompany = async (companyId: number): Promise<AuthSwitchCompanyResponse> => {
    if (!accessToken || !storedTokens) {
      throw new Error("Authentication required. Please sign in again.");
    }
    const response = await authService.switchCompany(accessToken, companyId);
    saveSession(
      {
        accessToken: response.accessToken,
        refreshToken: storedTokens.refreshToken,
      },
      storedUser
        ? {
            ...storedUser,
            companyId: response.companyId ?? storedUser.companyId,
            companyName: response.companyName ?? storedUser.companyName,
          }
        : undefined
    );
    return response;
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
    logoutAll,
    listSessions,
    revokeSession,
    switchCompany,
    clearSession,
  };
}
