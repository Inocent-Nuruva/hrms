"use client";

import * as React from "react";
import {
  sessionManagement,
  type SessionDeadlines,
} from "@/services/session-management";
import { ApiError } from "@/services/api";
import { getSessionSnapshot, subscribeSession } from "@/lib/auth-session-store";
import { readJwtExpiry } from "@/lib/session-client";
import { decodeJwtPayload } from "@/utils/token-utils";
import { Button } from "@/components/ui/button";

const warningWindow = 60_000;
const activityInterval = 15_000;
function currentSessionId() {
  if (
    typeof window === "undefined" ||
    ["/login", "/auth/sso/callback"].includes(window.location.pathname)
  )
    return null;
  const token = getSessionSnapshot().tokens?.accessToken;
  if (!token) return null;
  const id = decodeJwtPayload(token)?.sessionId;
  return typeof id === "string" ? id : null;
}

export function SessionDeadlineWarning({ onExpire }: { onExpire: () => void }) {
  const id = React.useSyncExternalStore(
    subscribeSession,
    currentSessionId,
    () => null,
  );
  const [warning, setWarning] = React.useState<{
    seconds: number;
    idle: boolean;
  } | null>(null);
  const continueSession = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    if (!id) return;
    let disposed = false,
      busy = false,
      lastActivity = 0,
      lastCheck = 0,
      idle = 0,
      hard = 0,
      latestServerTime = 0;
    const key = "hrms.auth.deadline." + id;
    const apply = (value: SessionDeadlines, received: number) => {
      if (value.session_id !== id || value.server_time < latestServerTime)
        return;
      latestServerTime = value.server_time;
      const offset = received - value.server_time;
      idle = value.idle_expires_at + offset;
      hard =
        Math.min(value.absolute_expires_at, value.refresh_expires_at) + offset;
      render();
    };
    const render = () => {
      if (disposed || !idle || currentSessionId() !== id) return;
      const remaining = Math.min(idle, hard) - Date.now();
      if (remaining > warningWindow) {
        setWarning(null);
        return;
      }
      setWarning({
        seconds: Math.max(0, Math.ceil(remaining / 1000)),
        idle: idle < hard,
      });
    };
    const sync = async (activity = false) => {
      const token = getSessionSnapshot().tokens?.accessToken;
      if (busy || disposed || !token || currentSessionId() !== id) return;
      busy = true;
      lastCheck = Date.now();
      if (activity) lastActivity = lastCheck;
      try {
        const value = await sessionManagement.deadlines(token, activity);
        if (disposed || currentSessionId() !== id) return;
        const received = Date.now();
        apply(value, received);
        if (activity) {
          try {
            localStorage.setItem(key, JSON.stringify({ value, received }));
          } catch {
            /* Other tabs also verify deadlines with the server. */
          }
        }
      } catch (error) {
        if (
          !disposed &&
          getSessionSnapshot().tokens?.accessToken === token &&
          error instanceof ApiError &&
          error.statusCode === 401 &&
          (readJwtExpiry(token) ?? 0) > Date.now()
        ) {
          onExpire();
        } else if (
          !disposed &&
          currentSessionId() === id &&
          idle &&
          Math.min(idle, hard) <= Date.now() &&
          !(error instanceof ApiError && error.statusCode === 401)
        )
          onExpire();
      } finally {
        busy = false;
      }
    };
    const onActivity = (event: Event) => {
      if (
        event.isTrusted &&
        document.visibilityState === "visible" &&
        Date.now() - lastActivity >= activityInterval
      )
        void sync(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try {
        const { value, received } = JSON.parse(event.newValue) as {
          value: SessionDeadlines;
          received: number;
        };
        apply(value, received);
      } catch {
        /* Ignore incomplete storage notifications. */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    continueSession.current = () => void sync(true);
    void sync();
    const timer = window.setInterval(() => {
      render();
      if (
        (!idle ||
          Math.min(idle, hard) <= Date.now() ||
          Date.now() - lastCheck >= 60000) &&
        Date.now() - lastCheck >= 3000
      )
        void sync();
    }, 1000);
    for (const event of ["pointerdown", "keydown", "wheel", "touchstart"])
      window.addEventListener(event, onActivity, { passive: true });
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      setWarning(null);
      window.clearInterval(timer);
      for (const event of ["pointerdown", "keydown", "wheel", "touchstart"])
        window.removeEventListener(event, onActivity);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, onExpire]);

  if (!id || !warning) return null;
  return (
    <aside
      aria-label="Session expiration"
      role="alert"
      className="fixed bottom-4 inset-x-3 z-[100] mx-auto max-w-md space-y-2 rounded-lg border bg-background p-4 text-sm shadow-lg"
    >
      <p className="font-semibold">
        Your session expires in {warning.seconds} seconds.
      </p>
      {warning.idle ? (
        <Button type="button" onClick={() => continueSession.current()}>
          Stay signed in
        </Button>
      ) : (
        <p>Save your work and sign in again when the session ends.</p>
      )}
    </aside>
  );
}
