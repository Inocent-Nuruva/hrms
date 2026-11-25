"use client";

import * as React from "react";

import {
  clearStoredSession,
  persistSessionUser,
  persistSessionTokens,
  readJwtExpiry,
  readStoredSessionTokens,
  redirectToLogin,
} from "@/lib/session-client";
import {
  DASHBOARD_ACCESS_REFRESH_EVENT,
  DASHBOARD_PERMISSION_STORAGE_KEY,
  publishDashboardActorSnapshot,
  publishDashboardActorSnapshotFromBrowserStorage,
  publishDashboardActorSnapshotFromSources,
  readDashboardActorSnapshotFromBrowser,
} from "@/lib/dashboard-permissions";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { ROUTES } from "@/utils/constants";
import { env } from "@/lib/env";
import { SessionDeadlineWarning } from "./session-deadline-warning";
import { withAuthSessionLock } from "@/lib/auth-session-lock";
import { getSessionSnapshot } from "@/lib/auth-session-store";

const SESSION_CHECK_INTERVAL_MS = env.NEXT_PUBLIC_SESSION_CHECK_INTERVAL_MS;
const ACCESS_TOKEN_REFRESH_WINDOW_MS = env.NEXT_PUBLIC_TOKEN_REFRESH_WINDOW_MS;

export function SessionExpiryGuard() {
  const refreshInFlightRef = React.useRef<Promise<void> | null>(null);
  const accessSyncInFlightRef = React.useRef<Promise<
    "ok" | "unauthorized" | "failed"
  > | null>(null);
  const lastAccessSyncAtRef = React.useRef(0);

  const expireSession = React.useCallback(() => {
    clearStoredSession();
    redirectToLogin();
  }, []);

  const isProtectedPath = React.useCallback((pathname: string) => {
    return (
      pathname.startsWith(ROUTES.dashboard) ||
      pathname.startsWith(ROUTES.onboarding)
    );
  }, []);

  const syncAccessContext = React.useCallback(
    async (accessToken: string, force = false) => {
      if (
        !force &&
        Date.now() - lastAccessSyncAtRef.current < SESSION_CHECK_INTERVAL_MS
      ) {
        return "ok" as const;
      }

      if (!accessSyncInFlightRef.current) {
        accessSyncInFlightRef.current = (async () => {
          try {
            const snapshot = await authService.getAccessSnapshot(accessToken);
            if (readStoredSessionTokens().accessToken !== accessToken)
              return "failed" as const;
            publishDashboardActorSnapshotFromSources(snapshot);
            if (readDashboardActorSnapshotFromBrowser().scope === "company") {
              const user = await authService.getCurrentUser(accessToken);
              if (readStoredSessionTokens().accessToken !== accessToken) return "failed" as const;
              const employeeLinked = snapshot.employeeId === undefined
                ? getSessionSnapshot().user?.employeeLinked
                : snapshot.employeeId !== null;
              persistSessionUser({ ...user, ...(employeeLinked === undefined ? {} : { employeeLinked }) });
              publishDashboardActorSnapshotFromSources(snapshot);
            }
            lastAccessSyncAtRef.current = Date.now();
            return "ok" as const;
          } catch (errorObject) {
            if (readStoredSessionTokens().accessToken !== accessToken)
              return "failed" as const;
            if (
              errorObject instanceof ApiError &&
              errorObject.statusCode === 401
            ) {
              return "unauthorized" as const;
            }
            // A temporary network outage must not make the authenticated shell
            // unusable. Prefer the last exact live snapshot; only older sessions
            // without one need the legacy browser/JWT compatibility fallback.
            if (
              window.sessionStorage.getItem(
                DASHBOARD_PERMISSION_STORAGE_KEY,
              ) !== null
            ) {
              publishDashboardActorSnapshot(
                readDashboardActorSnapshotFromBrowser(),
              );
            } else {
              publishDashboardActorSnapshotFromBrowserStorage(accessToken);
            }
            return "failed" as const;
          } finally {
            accessSyncInFlightRef.current = null;
          }
        })();
      }

      return accessSyncInFlightRef.current;
    },
    [],
  );

  const ensureFreshSession = React.useCallback(
    async (forceAccessSync = false) => {
      if (typeof window === "undefined") {
        return;
      }

      const pathname = window.location.pathname;

      if (pathname === ROUTES.login || pathname === "/auth/sso/callback") {
        return;
      }

      const { accessToken, refreshToken } = readStoredSessionTokens();
      if (!accessToken) {
        if (isProtectedPath(pathname)) {
          expireSession();
        }
        return;
      }

      const accessExpiry = readJwtExpiry(accessToken);
      let activeAccessToken = accessToken;

      if (
        accessExpiry !== null &&
        accessExpiry - Date.now() <= ACCESS_TOKEN_REFRESH_WINDOW_MS &&
        !refreshToken
      ) {
        expireSession();
        return;
      }

      if (
        accessExpiry !== null &&
        accessExpiry - Date.now() <= ACCESS_TOKEN_REFRESH_WINDOW_MS &&
        refreshToken &&
        !refreshInFlightRef.current
      ) {
        refreshInFlightRef.current = (async () => {
          try {
            await withAuthSessionLock(async () => {
              if (readStoredSessionTokens().refreshToken !== refreshToken || readStoredSessionTokens().accessToken !== accessToken) return;
              const response = await authService.refresh(refreshToken);
              const nextAccessToken = response.tokens.accessToken.trim();
              const nextRefreshToken = response.tokens.refreshToken.trim();

              if (!nextAccessToken || !nextRefreshToken) {
                expireSession();
                return;
              }

              if (
                readStoredSessionTokens().refreshToken !== refreshToken ||
                readStoredSessionTokens().accessToken !== accessToken
              )
                return;
              persistSessionTokens(
                nextAccessToken,
                nextRefreshToken,
                response.user,
              );
              activeAccessToken = nextAccessToken;
            });
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 401 &&
              readStoredSessionTokens().accessToken === accessToken &&
              readStoredSessionTokens().refreshToken === refreshToken
            )
              expireSession();
          } finally {
            refreshInFlightRef.current = null;
          }
        })();
      }

      if (refreshInFlightRef.current) {
        await refreshInFlightRef.current;
        activeAccessToken =
          readStoredSessionTokens().accessToken || activeAccessToken;
      }

      if ((readJwtExpiry(activeAccessToken) ?? Infinity) <= Date.now() && refreshToken) return;
      const accessSyncResult = await syncAccessContext(
        activeAccessToken,
        forceAccessSync,
      );
      if (accessSyncResult === "unauthorized") {
        expireSession();
      }
    },
    [expireSession, isProtectedPath, syncAccessContext],
  );

  React.useEffect(() => {
    void ensureFreshSession(true);

    const intervalId = window.setInterval(() => {
      void ensureFreshSession();
    }, SESSION_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void ensureFreshSession(true);
      }
    };

    const handleFocus = () => {
      void ensureFreshSession(true);
    };

    const handleAccessRefreshRequest = () => {
      void ensureFreshSession(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(
      DASHBOARD_ACCESS_REFRESH_EVENT,
      handleAccessRefreshRequest,
    );

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        DASHBOARD_ACCESS_REFRESH_EVENT,
        handleAccessRefreshRequest,
      );
    };
  }, [ensureFreshSession]);

  return <SessionDeadlineWarning onExpire={expireSession} />;
}
