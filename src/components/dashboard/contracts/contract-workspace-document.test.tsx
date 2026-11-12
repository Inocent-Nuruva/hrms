// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContractWorkspaceDocument } from "./contract-workspace-document";

const mock = vi.hoisted(() => ({
  getContract: vi.fn(),
  loadContractVersions: vi.fn(),
}));
vi.mock("./contract-page-panels", () => ({ SignatoriesPanel: () => null }));
vi.mock("./contract-signing-panel", () => ({
  ContractSigningPanel: () => null,
}));
vi.mock("./contract-ui", () => ({ ContractPdfViewer: () => null }));
vi.mock("./contract-workspace-version-data", () => ({
  loadContractVersions: mock.loadContractVersions,
}));
vi.mock("@/lib/contracts-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getContract: mock.getContract,
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("version comparison", () => {
  it("hides file and verification actions from an unauthorized reviewer", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mock.loadContractVersions.mockResolvedValue([]);
    const contract = {
      id: 9,
      employeeId: 1,
      version: 1,
      status: "PENDING_VERIFICATION",
      canManage: true,
      can_view_document: false,
      salaryHidden: true,
      signatures: [],
      signing: { my_party: null },
      sections: [],
      particulars: {},
      files: [],
      updatedAt: "v1",
    } as never;
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(<ContractWorkspaceDocument token="x" contract={contract} />);
      await Promise.resolve();
    });
    expect(element.textContent).toContain("Waiting for an authorized reviewer");
    expect(element.textContent).not.toContain(
      "Verify the employee's signed upload",
    );
    expect(
      [...element.querySelectorAll("button")].some(
        (button) => button.textContent === "Download",
      ),
    ).toBe(false);
    expect(
      [...element.querySelectorAll("button")].some(
        (button) => button.textContent === "Print",
      ),
    ).toBe(false);
    await act(async () => root.unmount());
    element.remove();
  });
  it("compares selected snapshots while hiding salary and clause text when masked", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const row = (
      id: number,
      version: number,
      salary: string,
      role: string,
    ) => ({
      id,
      employeeId: 1,
      version,
      status: "SIGNED",
      canManage: false,
      can_view_document: false,
      salaryHidden: true,
      signatures: [],
      signing: { my_party: null },
      sections: [{ id: "pay", heading: "Pay", body: `salary ${salary}` }],
      particulars: { snapshot: { values: { salary, job_title: role } } },
      updatedAt: "v1",
    });
    const old = row(1, 1, "secret100", "Clerk");
    const current = row(2, 2, "secret200", "Manager");
    mock.loadContractVersions.mockResolvedValue([old, current]);
    mock.getContract.mockImplementation(async (_token, id) =>
      id === 1 ? old : current,
    );
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <ContractWorkspaceDocument token="x" contract={current as never} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const compare = [...element.querySelectorAll("button")].find(
      (button) => button.textContent === "Compare versions",
    )!;
    await act(async () => {
      compare.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(element.textContent).toContain("Clerk");
    expect(element.textContent).toContain("Manager");
    expect(element.textContent).not.toContain("secret100");
    expect(element.textContent).not.toContain("secret200");
    await act(async () => root.unmount());
    element.remove();
  });
});
