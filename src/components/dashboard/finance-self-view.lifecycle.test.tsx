// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistAuthSession } from "@/lib/auth-session-store";
import type { FinanceCheckpoint } from "@/lib/finance-draft-workflow";

const mocks = vi.hoisted(() => ({ evaluate: vi.fn(), leave: () => false }));
vi.mock("@/hooks/use-forbidden-route-guard", () => ({
  useLeaveIfForbidden: () => mocks.leave,
}));
vi.mock("@/lib/admin-api", () => ({
  evaluateMyFinanceEligibility: mocks.evaluate,
  listMyFinanceApplications: vi.fn().mockResolvedValue([]),
  listMyFinanceProducts: vi
    .fn()
    .mockResolvedValue([{ id: 1, name: "Loan", requiredDocumentTypes: [] }]),
  listMyFinanceAccounts: vi.fn().mockResolvedValue([]),
  getMyFinanceAccountStatement: vi.fn(),
  requestMyFinanceDeferment: vi.fn(),
  updateMyFinanceApplication: vi.fn(),
  downloadMyFinanceSanctionLetter: vi.fn(),
  downloadMyFinanceStatement: vi.fn(),
  listMyFinanceGuarantorRequests: vi.fn().mockResolvedValue([]),
  listMyFinanceApplicationDocuments: vi.fn().mockResolvedValue([]),
  listMyFinanceApplicationGuarantors: vi.fn().mockResolvedValue([]),
  createMyFinanceApplication: vi.fn(),
  uploadMyFinanceApplicationDocument: vi.fn(),
  addMyFinanceApplicationGuarantor: vi.fn(),
  acceptMyFinanceApplication: vi.fn(),
  decideMyFinanceGuarantorRequest: vi.fn(),
  submitMyFinanceApplication: vi.fn(),
  withdrawMyFinanceApplication: vi.fn(),
  fileToBase64UploadDto: vi.fn(),
}));
vi.mock("@/components/dashboard/talent-visuals", async (original) => {
  const visualExports =
    await original<typeof import("@/components/dashboard/talent-visuals")>();
  return {
    ...visualExports,
    HeroBand: ({ actions }: { actions: React.ReactNode }) => (
      <div>{actions}</div>
    ),
    CompactStatStrip: () => null,
    TalentDoodleSprites: () => null,
  };
});
vi.mock("@/components/animate-ui/components/base/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open: boolean;
    }) => (open ? <div>{children}</div> : null),
    DialogFooter: Wrapper,
    DialogHeader: Wrapper,
    DialogPopup: Wrapper,
    DialogTitle: Wrapper,
  };
});
vi.mock("@/components/ui/resizable-table", () => ({
  ResizableTable: () => null,
}));
vi.mock("@/components/ui/fluent-select", () => ({ FluentSelect: () => null }));
import { FinanceSelfView } from "./finance-self-view";

let root: Root;
let container: HTMLDivElement;
function deferred() {
  let resolve!: (value: Record<string, unknown>) => void;
  const promise = new Promise<Record<string, unknown>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function button(label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll("button")].find((element) =>
    element.textContent?.includes(label),
  );
  if (!result) throw new Error(`Missing ${label} button.`);
  return result;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  mocks.evaluate.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  persistAuthSession(
    {
      accessToken: `head.${btoa(JSON.stringify({ sub: 1, companyId: 10 }))}.sig`,
      refreshToken: "refresh",
    },
    { id: 1, companyId: 10, fullName: "Test User", email: "test@example.com" },
  );
  const saved: FinanceCheckpoint = {
    payload: {
      product_id: 1,
      requested_amount: "100",
      requested_term_months: 6,
      purpose: "Test",
    },
    form: {
      product_id: "1",
      requested_amount: "100",
      requested_term_months: "6",
      purpose: "Test",
    },
    requiredDocuments: [],
    guarantorIds: [],
    autoSubmit: false,
    draftId: "99",
    startedAt: Date.now(),
    creationPending: false,
    completedDocuments: [],
    completedGuarantors: [],
    submitted: false,
  };
  window.sessionStorage.setItem(
    "hrms.finance.draft:1:10",
    JSON.stringify(saved),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("finance component effect cleanup", () => {
  it("keeps the newer eligibility result when an older closed-dialog request resolves last", async () => {
    const old = deferred();
    const latest = deferred();
    mocks.evaluate
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise);
    await act(async () => root.render(<FinanceSelfView />));
    await act(async () => vi.advanceTimersByTime(450));
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
    await act(async () => button("Cancel").click());
    await act(async () => button("Resume application").click());
    await act(async () => vi.advanceTimersByTime(450));
    expect(mocks.evaluate).toHaveBeenCalledTimes(2);
    await act(async () =>
      latest.resolve({
        eligible: true,
        checks: [
          { code: "LATEST", passed: true, message: "Fresh eligibility" },
        ],
      }),
    );
    await act(async () =>
      old.resolve({
        eligible: false,
        checks: [{ code: "OLD", passed: false, message: "Stale eligibility" }],
      }),
    );
    expect(container.textContent).toContain("Fresh eligibility");
    expect(container.textContent).not.toContain("Stale eligibility");
  });
});
