// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import {
  getSessionSnapshot,
  persistAuthSession,
  SESSION_STORAGE_KEY,
} from "./auth-session-store";
import { consumeDashboardWarmCache } from "./dashboard-warm-cache";

let root: Root | undefined;
let container: HTMLDivElement;
const user = (id: number, companyId: number) => ({
  id,
  companyId,
  fullName: `User ${id}`,
  email: `${id}@test.example`,
});
const tokens = (id: number, companyId: number) => ({
  accessToken: `header.${btoa(JSON.stringify({ sub: id, companyId }))}.signature`,
  refreshToken: `refresh-${id}-${companyId}`,
});
function Probe() {
  const session = useAuth();
  return (
    <span>
      {session.user?.companyId ?? "none"}:
      {session.tokens?.refreshToken ?? "none"}
    </span>
  );
}
function putWarmSnapshot() {
  const actor = getSessionSnapshot();
  window.sessionStorage.setItem(
    "hrms.dashboard.warmSnapshot",
    JSON.stringify({
      subject: actor.subject,
      companyId: actor.companyId,
      credentialVersion: actor.credentialVersion,
      savedAt: Date.now(),
      fromDate: "2026-01-01",
      toDate: "2026-02-01",
      employees: [{ id: 3 }],
      employeesTotal: 1,
      departments: [],
      leaveRequests: [],
      attendanceSummaries: [],
      onboardingRequests: [],
      offboardingRequests: [],
    }),
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.clear();
  window.sessionStorage.clear();
  persistAuthSession(null, null);
  container = document.createElement("div");
  document.body.appendChild(container);
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("atomic auth storage and hydration", () => {
  it("hydrates the stable server snapshot without a mismatch before applying browser credentials", async () => {
    persistAuthSession(tokens(1, 10), user(1, 10));
    container.innerHTML = renderToString(<Probe />);
    expect(container.textContent).toBe("none:none");
    const errors = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, <Probe />, { onRecoverableError: errors });
    });
    expect(container.textContent).toBe("10:refresh-1-10");
    expect(errors).not.toHaveBeenCalled();
  });
  it("synchronizes multiple mounted auth consumers atomically in the same window", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <>
          <Probe />
          <Probe />
        </>,
      );
    });
    await act(async () => persistAuthSession(tokens(2, 20), user(2, 20)));
    expect(
      [...container.querySelectorAll("span")].map((item) => item.textContent),
    ).toEqual(["20:refresh-2-20", "20:refresh-2-20"]);
  });
  it("responds to native cross-tab storage events using the whole canonical record", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<Probe />);
    });
    await act(async () => {
      const raw = JSON.stringify({
        tokens: tokens(3, 30),
        user: user(3, 30),
        credentialVersion: "from-other-tab",
      });
      window.localStorage.setItem(SESSION_STORAGE_KEY, raw);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SESSION_STORAGE_KEY,
          newValue: raw,
          storageArea: window.localStorage,
        }),
      );
    });
    expect(container.textContent).toBe("30:refresh-3-30");
  });
  it("purges warm memory and storage on a company/credential switch", () => {
    persistAuthSession(tokens(1, 10), user(1, 10));
    putWarmSnapshot();
    expect(consumeDashboardWarmCache()?.employees).toHaveLength(1);
    persistAuthSession(tokens(1, 20), user(1, 20));
    expect(consumeDashboardWarmCache()).toBeNull();
    expect(
      window.sessionStorage.getItem("hrms.dashboard.warmSnapshot"),
    ).toBeNull();
  });
  it("expires memory snapshots after their TTL instead of returning them forever", () => {
    vi.useFakeTimers();
    persistAuthSession(tokens(1, 10), user(1, 10));
    putWarmSnapshot();
    expect(consumeDashboardWarmCache()).not.toBeNull();
    vi.advanceTimersByTime(90_001);
    expect(consumeDashboardWarmCache()).toBeNull();
  });
});
