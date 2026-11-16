// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContractDetailView } from "./contract-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("classic=1"),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("./contract-workspace-shell", () => ({
  ContractWorkspaceShell: ({
    contract,
  }: {
    contract: { particulars?: { mode?: string } };
  }) => <p>Unified workspace: {contract.particulars?.mode ?? "legacy"}</p>,
}));
const api = vi.hoisted(() => ({
  getContractFieldMetadata: vi.fn(),
  getContract: vi.fn(),
  listSignatories: vi.fn(),
}));
vi.mock("@/lib/contracts-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("unified contract detail", () => {
  for (const mode of ["live", "legacy"])
    it(`opens ${mode} drafts in the workspace regardless of the former flag or classic query`, async () => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      api.getContract.mockResolvedValue({
        id: 1,
        status: "DRAFT",
        canManage: true,
        field_metadata: [],
        particulars: { mode },
      });
      const element = document.createElement("div");
      document.body.append(element);
      const root = createRoot(element);
      await act(async () => {
        root.render(<ContractDetailView contractId={1} token="token" />);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(element.textContent).toContain(`Unified workspace: ${mode}`);
      expect(api.getContractFieldMetadata).not.toHaveBeenCalled();
      await act(async () => root.unmount());
      element.remove();
    });
  it("shows a retryable error when detail loading fails", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContract.mockRejectedValue(new Error("network"));
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(<ContractDetailView contractId={1} token="token" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
    await act(async () => root.unmount());
    element.remove();
  });
});
