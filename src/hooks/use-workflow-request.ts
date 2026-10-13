"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth-session-store";
import { readStoredSessionTokens } from "@/lib/session-client";

/** Suppresses old responses after navigation, unmount, refresh, or login changes. */
export function useWorkflowRequest(scope: string) {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const tokens = session.tokens;
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    let active = true;
    mounted.current = active;
    generation.current += 1;
    return () => {
      active = false;
      mounted.current = active;
      generation.current += 1;
    };
  }, [scope, session.credentialVersion]);

  const begin = useCallback(() => {
    const ticket = ++generation.current;
    const credential = readStoredSessionTokens().accessToken;
    const identityVersion = session.credentialVersion;
    const current = () =>
      mounted.current &&
      generation.current === ticket &&
      readStoredSessionTokens().accessToken === credential &&
      getSessionSnapshot().credentialVersion === identityVersion;
    return {
      scope,
      current,
      commit: (apply: () => void) => {
        if (current()) apply();
      },
    };
  }, [scope, session.credentialVersion]);

  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);
  return {
    begin,
    invalidate,
    credential: tokens?.accessToken,
    identityVersion: session.credentialVersion,
  };
}
