import { useState, useSyncExternalStore } from "react";
import { ApiError } from "@/services/api";
import { authService } from "@/services/authService";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
  persistAuthUser,
  AuthUserSchema,
} from "@/lib/auth-session-store";
import {
  clearStoredSession,
  persistSessionTokens,
  readStoredSessionTokens,
} from "@/lib/session-client";
import {
  publishDashboardActorSnapshotFromSources,
  requestDashboardAccessRefresh,
} from "@/lib/dashboard-permissions";
import type {
  AuthSessionRecord,
  AuthScope,
  DashboardType,
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
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const storedTokens = session.tokens;
  const storedUser = session.user;
  const setStoredUser = persistAuthUser;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    clearStoredSession();
  };

  const saveSession = (
    tokens: AuthTokens,
    user?: AuthUser,
    dashboardType?: DashboardType,
    scope?: AuthScope,
  ) => {
    const sessionUser =
      user && (dashboardType || scope)
        ? { ...user, dashboardType, scope }
        : user;
    persistSessionTokens(
      tokens.accessToken,
      tokens.refreshToken,
      sessionUser ?? null,
    );
    publishDashboardActorSnapshotFromSources(
      ...(dashboardType ? [{ dashboard_type: dashboardType }] : []),
      ...(scope ? [{ scope }] : []),
      sessionUser ?? null,
      ...(sessionUser?.accessContextResolved
        ? []
        : [tokens, tokens.accessToken]),
    );
    setError(null);
  };

  const login = async (payload: LoginRequest): Promise<LoginResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(payload);

      if (!response.requiresOtp && response.tokens) {
        saveSession(
          response.tokens,
          response.user,
          response.dashboardType,
          response.scope,
        );
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

  const completeOtpLogin = async (
    tempToken: string,
    code: string,
  ): Promise<VerifyOtpResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyOtp({ tempToken, code });
      saveSession(
        response.tokens,
        response.user,
        response.user.dashboardType,
        response.user.scope,
      );
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OTP verification failed.";
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
      if (readStoredSessionTokens().accessToken !== accessToken) return null;
      setStoredUser(user);
      publishDashboardActorSnapshotFromSources(
        user,
        ...(user.accessContextResolved ? [] : [storedTokens, accessToken]),
      );
      return user;
    } catch (error) {
      if (readStoredSessionTokens().accessToken !== accessToken) return null;
      if (error instanceof ApiError && error.statusCode === 401) clearSession();
      else
        setError(
          error instanceof Error
            ? error.message
            : "Could not refresh your profile.",
        );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    const session = readStoredSessionTokens();
    const previous = getSessionSnapshot();
    const refreshToken = session.refreshToken;
    if (!refreshToken) {
      throw new Error(
        "Your session cannot be refreshed. Please sign in again.",
      );
    }
    const response = await authService.refresh(refreshToken);
    if (getSessionSnapshot().credentialVersion !== previous.credentialVersion)
      throw new DOMException("Session changed during refresh.", "AbortError");
    saveSession(
      response.tokens,
      response.user ?? storedUser ?? undefined,
      response.user?.dashboardType ?? storedUser?.dashboardType,
      response.user?.scope ?? storedUser?.scope,
    );
    requestDashboardAccessRefresh();
    return response;
  };

  const acceptPasswordChangeTokens = (payload: unknown) => {
    const record =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const data =
      typeof record.data === "object" && record.data !== null
        ? (record.data as Record<string, unknown>)
        : record;
    const accessToken =
      typeof data.accessToken === "string"
        ? data.accessToken
        : typeof data.access_token === "string"
          ? data.access_token
          : "";
    const refreshToken =
      typeof data.refreshToken === "string"
        ? data.refreshToken
        : typeof data.refresh_token === "string"
          ? data.refresh_token
          : "";
    if (!accessToken || !refreshToken) {
      throw new Error(
        "Password changed, but the server did not return a refreshed session. Please sign in again.",
      );
    }
    const nextTokens = { accessToken, refreshToken };

    const userRecord =
      typeof data.user === "object" && data.user !== null
        ? AuthUserSchema.parse(data.user)
        : storedUser;
    if (userRecord) {
      const nextUser = { ...userRecord, requiresPasswordChange: false };
      persistSessionTokens(accessToken, refreshToken, nextUser);
      publishDashboardActorSnapshotFromSources(
        nextUser,
        nextTokens,
        accessToken,
      );
    } else {
      persistSessionTokens(accessToken, refreshToken, null);
      publishDashboardActorSnapshotFromSources(nextTokens, accessToken);
    }
    requestDashboardAccessRefresh();
    return nextTokens;
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

  const switchCompany = async (
    companyId: number,
  ): Promise<AuthSwitchCompanyResponse> => {
    if (!accessToken || !storedTokens) {
      throw new Error("Authentication required. Please sign in again.");
    }
    const previous = getSessionSnapshot();
    const response = await authService.switchCompany(accessToken, companyId);
    if (getSessionSnapshot().credentialVersion !== previous.credentialVersion)
      throw new DOMException(
        "Session changed during company switch.",
        "AbortError",
      );
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
            // Dashboard type is company-membership specific. Never retain the
            // previous company's shell while the refreshed /users/me loads.
            dashboardType: response.dashboardType,
            scope: response.scope,
            permissions: undefined,
            accessContextResolved: false,
          }
        : undefined,
      response.dashboardType,
      response.scope,
    );
    requestDashboardAccessRefresh();
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
    refreshSession,
    acceptPasswordChangeTokens,
    logout,
    logoutAll,
    listSessions,
    revokeSession,
    switchCompany,
    clearSession,
  };
}
