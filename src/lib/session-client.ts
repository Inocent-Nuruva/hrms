"use client";

import {
  getSessionSnapshot,
  persistAuthSession,
  persistAuthUser,
} from "@/lib/auth-session-store";
import type { AuthUser } from "@/types";

import { ROUTES } from "@/utils/constants";
import {
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
} from "@/lib/dashboard-permissions";

const LEGACY_SESSION_TOKEN_KEY = "ess_auth_token";

export const SESSION_CLEARED_EVENT = "hrms:session-cleared";

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export function readStoredSessionTokens(): StoredTokens {
  const tokens = getSessionSnapshot().tokens;
  return {
    accessToken: tokens?.accessToken ?? "",
    refreshToken: tokens?.refreshToken ?? "",
  };
}
export function persistSessionTokens(
  accessToken: string,
  refreshToken: string,
  user?: AuthUser | null,
) {
  if (typeof window === "undefined") return;
  persistAuthSession(
    { accessToken, refreshToken },
    user === undefined ? getSessionSnapshot().user : user,
  );
  persistDashboardAccessToken(accessToken);
}
export function persistSessionUser(user: unknown) {
  persistAuthUser(user);
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  persistAuthSession(null, null);
  window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  clearDashboardActorSnapshot();
  void import("@/lib/forbidden-routes").then((mod) => {
    mod.clearDashboardRouteMemory();
  });
  // The photo store listens for this. Importing it here would pull the full
  // admin API client into every page that clears a session, including login.
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}

export function readJwtExpiry(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== ROUTES.login) {
    window.location.assign(ROUTES.login);
  }
}
