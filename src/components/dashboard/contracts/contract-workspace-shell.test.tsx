// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ContractWorkspaceShell } from "./contract-workspace-shell";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("./contract-page-panels", () => ({
  VersionsPanel: () => <span>Versions</span>,
  ActivityPanel: () => <span>Activity</span>,
}));
vi.mock("./contract-workspace-versions", () => ({
  ContractWorkspaceVersions: () => <span>Versions</span>,
}));
const api = vi.hoisted(() => ({
  getContractFields: vi.fn(),
  getContractReadiness: vi.fn(),
}));
vi.mock("@/lib/contracts-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));

describe("read-only contract shell", () => {
  it("shows an owner's salary without granting salary editing", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContractFields.mockResolvedValue([
      {
        key: "salary",
        value: "1500.00",
        automatic: "1500.00",
        override: null,
        used: true,
      },
    ]);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    const contract = {
      id: 1,
      employeeId: 1,
      employeeNo: "E1",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      contractType: "UNSPECIFIED",
      startDate: "2026-01-01",
      status: "DRAFT",
      can_edit_salary: false,
      salaryHidden: false,
      sections: [],
      particulars: { mode: "live" },
      updatedAt: "2026-01-01",
    } as never;
    const metadata = [
      {
        key: "salary",
        labelKey: "salary",
        group: "Pay & benefits",
        inputKind: "money",
        owner: "compensation",
        overridePolicy: "with-reason",
      },
    ] as never;
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <ContractWorkspaceShell
          token="x"
          contract={contract}
          metadata={metadata}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const salary = element.querySelector("#field-salary")!;
    expect(salary.textContent).toContain("1500.00");
    expect(salary.textContent).toContain(
      "A salary-authorized user must change this value",
    );
    expect(salary.querySelector("input,button,select,textarea")).toBeNull();
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("does not display masked salary in fields, summaries or clauses", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContractFields.mockResolvedValue([
      {
        key: "salary",
        value: "secret100",
        automatic: "secret50",
        override: "secret100",
        override_reason: "secret reason",
        used: true,
        hidden: true,
      },
    ]);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    const contract = {
      id: 1,
      employeeId: 1,
      employeeNo: "E1",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      contractType: "UNSPECIFIED",
      startDate: "2026-01-01",
      status: "DRAFT",
      salaryHidden: true,
      sections: [{ id: "pay", heading: "Pay", body: "secret100" }],
      particulars: { mode: "live" },
      updatedAt: "2026-01-01",
    } as never;
    const metadata = [
      {
        key: "salary",
        labelKey: "salary",
        group: "Pay & benefits",
        inputKind: "money",
        owner: "compensation",
        overridePolicy: "with-reason",
      },
    ] as never;
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <ContractWorkspaceShell
          token="x"
          contract={contract}
          metadata={metadata}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(element.textContent).not.toContain("secret100");
    expect(element.textContent).not.toContain("secret50");
    expect(element.textContent).not.toContain("secret reason");
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("blocks sending a live draft with an unknown clause token", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContractFields.mockResolvedValue([]);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const contract = {
      id: 1,
      employeeId: 1,
      employeeNo: "E1",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      contractType: "UNSPECIFIED",
      startDate: "2026-01-01",
      status: "DRAFT",
      sections: [{ id: "a", heading: "Clause", body: "{{unknown}}" }],
      particulars: { mode: "live" },
      updatedAt: "2026-01-01T00:00:00Z",
    } as never;
    await act(async () => {
      root.render(
        <ContractWorkspaceShell token="x" contract={contract} metadata={[]} />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      [...element.querySelectorAll("button")].find(
        (button) => button.textContent === "Send for signature",
      )?.disabled,
    ).toBe(true);
    expect(element.textContent).toContain("unknown or malformed");
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("offers plain inputs for a legacy draft without a classic link or reference picker", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContractFields.mockResolvedValue([
      {
        key: "job_title",
        value: "Clerk",
        automatic: "Clerk",
        override: null,
        used: true,
      },
    ]);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const contract = {
      id: 42,
      employeeId: 1,
      employeeNo: "E1",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      contractType: "UNSPECIFIED",
      startDate: "2026-01-01",
      status: "DRAFT",
      sections: [],
      particulars: {},
      updatedAt: "2026-01-01",
    } as never;
    await act(async () => {
      root.render(
        <ContractWorkspaceShell
          token="x"
          contract={contract}
          metadata={
            [
              {
                key: "job_title",
                labelKey: "job_title",
                group: "Role",
                inputKind: "reference",
                owner: "employee",
                overridePolicy: "reference-only",
                referenceKey: "position_id",
              },
            ] as never
          }
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.textContent).toContain("Legacy draft");
    expect(element.querySelector('a[href*="classic=1"]')).toBeNull();
    expect(
      (element.querySelector("#field-job_title input") as HTMLInputElement)
        ?.value,
    ).toBe("Clerk");
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("shows the automatic reference beside the chosen override", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContractFields.mockResolvedValue([
      {
        key: "department",
        value: "Finance",
        automatic_reference_id: 3,
        automatic_reference_label: "Audit",
        override_reason: "Transfer",
        source: "Selected for this contract",
      },
    ]);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const contract = {
      id: 1,
      employeeId: 1,
      employeeNo: "E1",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      status: "DRAFT",
      sections: [],
      particulars: { refs: { department_id: 4 } },
      updatedAt: "2026-01-01",
    } as never;
    const metadata = [
      {
        key: "department",
        labelKey: "contracts.fields.department",
        group: "Role",
        inputKind: "reference",
        owner: "employee",
        overridePolicy: "reference-only",
        referenceKey: "department_id",
      },
    ] as never;
    await act(async () => {
      root.render(
        <ContractWorkspaceShell
          token="x"
          contract={contract}
          metadata={metadata}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.querySelector("#field-department")?.textContent).toContain(
      "Automatic: Audit",
    );
    expect(element.querySelector("#field-department")?.textContent).toContain(
      "Overridden: Finance",
    );
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("renders the registry field once with its source and override", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    api.getContractFields.mockResolvedValue([
      {
        key: "employee_name",
        value: "Edited",
        automatic: "Original",
        override: "Edited",
        override_reason: "Existing",
        source: "Employee profile",
      },
    ]);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const contract = {
      id: 1,
      employeeId: 1,
      employeeNo: "E1",
      employeeName: "Employee",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      status: "DRAFT",
      sections: [],
      updatedAt: "2026-01-01",
    } as never;
    const metadata = [
      {
        key: "employee_name",
        labelKey: "contracts.fields.employee_name",
        group: "Parties",
        inputKind: "text",
        owner: "employee",
        overridePolicy: "none",
      },
    ] as never;
    await act(async () => {
      root.render(
        <ContractWorkspaceShell
          token="x"
          contract={contract}
          metadata={metadata}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.querySelectorAll("#field-employee_name")).toHaveLength(1);
    expect(element.textContent).toContain("Employee profile");
    expect(element.textContent).toContain("Automatic: Original");
    expect(element.querySelector("#field-employee_name input")).toBeNull();
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
});
