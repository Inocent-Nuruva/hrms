// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  VersionsPanel: () => null,
  ActivityPanel: () => null,
}));
vi.mock("./contract-workspace-versions", () => ({
  ContractWorkspaceVersions: () => null,
}));
const api = vi.hoisted(() => ({
  getContractFields: vi.fn(),
  getContractReadiness: vi.fn(),
  resolveContractDraftFields: vi.fn(),
  updateContractDraft: vi.fn(),
  getContract: vi.fn(),
  listSignatories: vi.fn(),
}));
vi.mock("@/lib/contracts-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));

const types: Record<string, string> = {
  UNSPECIFIED: "Contract for an unspecified period",
  FIXED_TERM: "Fixed-term contract",
  SPECIFIC_TASK: "Contract for a specific task",
};
const metadata = [
  { key: "contract_type", group: "Terms", inputKind: "enum" },
  { key: "start_date", group: "Terms", inputKind: "date" },
  { key: "end_date", group: "Terms", inputKind: "date" },
  { key: "probation_months", group: "Terms", inputKind: "number" },
  { key: "place_of_recruitment", group: "Role", inputKind: "text" },
  { key: "job_description", group: "Role", inputKind: "longtext" },
  { key: "benefits", group: "Pay & benefits", inputKind: "longtext" },
  { key: "task_description", group: "Terms", inputKind: "longtext" },
].map((item) => ({
  ...item,
  owner: "contract",
  overridePolicy: "none",
  labelKey: item.key,
})) as never;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("direct live contract fields", () => {
  it("reapplies only the edited field after loading a newer version", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    const fields = [
      {
        key: "place_of_recruitment",
        value: "Dar",
        automatic: "Dar",
        override: null,
        used: true,
      },
    ];
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
      sections: [],
      particulars: { mode: "live" },
      updatedAt: "v1",
    } as never;
    api.getContractFields.mockResolvedValue(fields);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    api.resolveContractDraftFields.mockResolvedValue(fields);
    api.listSignatories.mockResolvedValue([]);
    api.getContract.mockResolvedValue({
      ...(contract as object),
      updatedAt: "v2",
    });
    api.updateContractDraft
      .mockRejectedValueOnce({ status: 409 })
      .mockResolvedValueOnce({ updatedAt: "v3" });
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
    const input = element.querySelector(
      "#field-place_of_recruitment input",
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "Arusha");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
      await Promise.resolve();
    });
    const reapply = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Re-apply my changes on top",
    ) as HTMLButtonElement;
    expect(reapply?.disabled).toBe(false);
    await act(async () => {
      reapply.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.updateContractDraft).toHaveBeenLastCalledWith(
      "x",
      1,
      expect.objectContaining({
        expected_updated_at: "v2",
        place_of_recruitment: "Arusha",
      }),
    );
    await act(async () => root.unmount());
    element.remove();
  });
  it("blocks cancellable programmatic navigation while edits are unsaved", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    const navigation = new EventTarget();
    vi.stubGlobal("navigation", navigation);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    api.getContractFields.mockResolvedValue([
      {
        key: "place_of_recruitment",
        value: "Dar",
        automatic: "Dar",
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
    api.listSignatories.mockResolvedValue([]);
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
      sections: [],
      particulars: { mode: "live" },
      updatedAt: "v1",
    } as never;
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
    const input = element.querySelector(
      "#field-place_of_recruitment input",
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "Arusha");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const event = new Event("navigate", { cancelable: true });
    Object.defineProperty(event, "destination", {
      value: { url: `${window.location.origin}/another-page` },
    });
    navigation.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalled();
    await act(async () => root.unmount());
    element.remove();
    confirm.mockRestore();
  });
  it("keeps edits and opens the conflict dialog after a stale save", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    const fields = [
      {
        key: "place_of_recruitment",
        value: "Dar",
        automatic: "Dar",
        override: null,
        used: true,
      },
    ];
    api.getContractFields.mockResolvedValue(fields);
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    api.resolveContractDraftFields.mockResolvedValue(fields);
    api.updateContractDraft.mockRejectedValue({ status: 409 });
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
      sections: [],
      particulars: { mode: "live" },
      updatedAt: "2026-01-01T00:00:00Z",
    } as never;
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
    const input = element.querySelector(
      "#field-place_of_recruitment input",
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "Arusha");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(input.value).toBe("Arusha");
    expect(document.body.textContent).toContain("This draft changed elsewhere");
    await act(async () => root.unmount());
    element.remove();
  });
  it("keeps edited controls, unsaved resolution and saved resolution aligned", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    let saved: Record<string, string> = {
      contract_type: "UNSPECIFIED",
      start_date: "2026-01-01",
      end_date: "",
      probation_months: "3",
      place_of_recruitment: "Dar",
      job_description: "Clerk",
      benefits: "Medical",
      task_description: "",
    };
    let latestResolved: Record<string, string> = { ...saved };
    let savedTitle = "Contract";
    const apply = (
      base: Record<string, string>,
      // The mock accepts the different nested draft payload shapes.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: Record<string, any>,
    ) => ({
      ...base,
      ...Object.fromEntries(
        Object.entries(body)
          .filter(([key]) => key in base)
          .map(([key, value]) => [key, value ?? ""]),
      ),
      ...(body.field_overrides?.probation_months !== undefined
        ? { probation_months: body.field_overrides.probation_months }
        : {}),
    });
    const asFields = (values: Record<string, string>) =>
      Object.entries(values).map(([key, value]) => ({
        key,
        value: key === "contract_type" ? types[value] : value,
        automatic: value,
        override: null,
        used: true,
      }));
    api.getContractFields.mockImplementation(async () => asFields(saved));
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    api.resolveContractDraftFields.mockImplementation(
      async (_token, _id, body) => {
        latestResolved = apply(saved, body);
        return asFields(latestResolved);
      },
    );
    api.updateContractDraft.mockImplementation(async (_token, _id, body) => {
      saved = apply(saved, body);
      if (typeof body.title === "string") savedTitle = body.title;
      return { updatedAt: new Date().toISOString() };
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
      sections: [],
      particulars: { mode: "live" },
      updatedAt: "2026-01-01T00:00:00Z",
    } as never;
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
    async function change(key: string, value: string, reason?: string) {
      const rootField = element.querySelector(`#field-${key}`)!;
      const input = rootField.querySelector("input, textarea, select") as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement;
      expect(input).toBeTruthy();
      const prototype =
        input instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
          input,
          value,
        );
        input.dispatchEvent(
          new Event(input instanceof HTMLSelectElement ? "change" : "input", {
            bubbles: true,
          }),
        );
      });
      const leaving = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(leaving);
      expect(leaving.defaultPrevented).toBe(true);
      if (reason) {
        const reasonInput = rootField.querySelectorAll(
          "input",
        )[1] as HTMLInputElement;
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!.call(reasonInput, reason);
          reasonInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(latestResolved[key]).toBe(value);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(saved[key]).toBe(value);
      expect(input.value).toBe(value);
    }
    await change("start_date", "2026-02-01");
    await change("place_of_recruitment", "Arusha");
    await change("job_description", "Review documents");
    await change("benefits", "Medical and transport");
    await change("probation_months", "4", "Agreed period");
    // Fixed term is held locally until its required end date is supplied.
    const select = element.querySelector(
      "#field-contract_type select",
    ) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!.call(select, "FIXED_TERM");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await change("end_date", "2026-12-31");
    expect(saved.contract_type).toBe("FIXED_TERM");
    await change("contract_type", "SPECIFIC_TASK");
    await change("task_description", "Complete project");
    const titleInput = [...element.querySelectorAll("label")]
      .find((label) => label.textContent?.includes("Contract title"))
      ?.querySelector("input") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(titleInput, "Employment agreement");
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(savedTitle).toBe("Employment agreement");
    expect(element.querySelector("h1")?.textContent).toContain(
      "Employment agreement",
    );
    await act(async () => root.unmount());
    element.remove();
  });
});
