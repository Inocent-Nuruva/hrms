// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContractCreate } from "./contract-create";

const mock = vi.hoisted(() => ({
  replace: vi.fn(),
  getEmployeeById: vi.fn(),
  listEmployees: vi.fn(),
  listContracts: vi.fn(),
  listContractTemplateSummaries: vi.fn(),
  createContractDraft: vi.fn(),
  getContract: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mock.replace }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getEmployeeById: mock.getEmployeeById,
  listEmployees: mock.listEmployees,
}));
vi.mock("@/lib/contracts-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  listContracts: mock.listContracts,
  listContractTemplateSummaries: mock.listContractTemplateSummaries,
  createContractDraft: mock.createContractDraft,
  getContract: mock.getContract,
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("new contract", () => {
  it("searches employees through the tenant-scoped API from the list entry point", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    mock.listContractTemplateSummaries.mockResolvedValue([]);
    mock.listEmployees.mockResolvedValue({
      rows: [
        {
          id: 8,
          fullName: "Amina Mary Ali",
          employeeNo: "E8",
        },
      ],
    });
    mock.getEmployeeById.mockResolvedValue({
      id: 8,
      first_name: "Amina",
      last_name: "Ali",
      employee_no: "E8",
      hire_date: "2026-01-01",
    });
    mock.listContracts.mockResolvedValue({ data: [] });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <ContractCreate
          token="token"
          presetEmployeeId={null}
          fromContractId={null}
        />,
      );
      await Promise.resolve();
    });
    const input = element.querySelector(
      'input[placeholder="Search employee name or number"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "Ami");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mock.listEmployees).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ search: "Ami" }),
    );
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "E8");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(mock.listEmployees).toHaveBeenCalledWith("token", expect.objectContaining({ search: "E8" }));
    const option = [...element.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Amina Mary Ali") && button.textContent?.includes("E8"),
    )!;
    expect(option).toBeTruthy();
    await act(async () => {
      option.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(element.textContent).toContain("Amina Ali");
    await act(async () => root.unmount());
    element.remove();
  });
  it("warns about an existing draft and creates a live draft for a preset employee", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mock.getEmployeeById.mockResolvedValue({
      id: 8,
      first_name: "Amina",
      last_name: "Ali",
      employee_no: "E8",
      hire_date: "2026-01-01",
    });
    mock.listContracts.mockResolvedValue({
      data: [{ id: 3, referenceNo: "EC-3", status: "DRAFT" }],
    });
    mock.listContractTemplateSummaries.mockResolvedValue([
      { contract_type: "UNSPECIFIED", title: "Employment template" },
    ]);
    mock.createContractDraft.mockResolvedValue({ id: 9 });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <ContractCreate
          token="token"
          presetEmployeeId={8}
          fromContractId={null}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      element.querySelector('a[href="/dashboard/employees/contracts/3"]'),
    ).toBeTruthy();
    expect(element.textContent).toContain("Employment template");
    const startInput = element.querySelector('input[type="date"]') as HTMLInputElement;
    expect(startInput.value).toBe("2026-01-01");
    expect(startInput.readOnly).toBe(true);
    await act(async () => {
      element
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });
    expect(mock.createContractDraft).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        employee_id: 8,
        mode: "live",
        start_date: "2026-01-01",
      }),
    );
    expect(mock.replace).toHaveBeenCalledWith(
      "/dashboard/employees/contracts/9",
    );
    await act(async () => root.unmount());
    element.remove();
  });
  it("asks HR to add a missing hire date before creating a contract", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mock.getEmployeeById.mockResolvedValue({ id: 8, first_name: "Amina", last_name: "Ali", hire_date: null });
    mock.listContracts.mockResolvedValue({ data: [] });
    mock.listContractTemplateSummaries.mockResolvedValue([]);
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(<ContractCreate token="token" presetEmployeeId={8} fromContractId={null} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(element.textContent).toContain("The employee has no hire date");
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await act(async () => root.unmount());
    element.remove();
  });
});
