// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContractWorkspaceShell } from "./contract-workspace-shell";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("./contract-page-panels", () => ({ ActivityPanel: () => null }));
vi.mock("./contract-workspace-versions", () => ({
  ContractWorkspaceVersions: () => null,
}));
const api = vi.hoisted(() => ({
  getContractFields: vi.fn(),
  getContractReadiness: vi.fn(),
  resolveContractDraftFields: vi.fn(),
  updateContractDraft: vi.fn(),
  listSignatories: vi.fn(),
}));
vi.mock("@/lib/contracts-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const dto: Record<string, string> = {
  job_title: "job_title",
  work_location: "work_location",
  hours_of_work: "hours_of_work",
  probation_months: "probation_months",
  salary: "salary_amount",
  currency: "salary_currency",
  pay_frequency: "pay_frequency",
  remuneration_method: "remuneration_method",
  benefits: "benefits",
  place_of_recruitment: "place_of_recruitment",
  job_description: "job_description",
  employee_address: "permanent_address",
  start_date: "start_date",
  end_date: "end_date",
  task_description: "task_description",
  contract_type: "contract_type",
};
const entries = [
  ["job_title", "Role", "reference", "Clerk II"],
  ["work_location", "Role", "reference", "Dodoma"],
  ["hours_of_work", "Terms", "text", "40 hours"],
  ["probation_months", "Terms", "number", "4"],
  ["salary", "Pay & benefits", "money", "1200.50"],
  ["currency", "Pay & benefits", "enum", "USD"],
  ["pay_frequency", "Pay & benefits", "enum", "weekly"],
  ["remuneration_method", "Pay & benefits", "enum", "Cash"],
  ["benefits", "Pay & benefits", "longtext", "Transport"],
  ["place_of_recruitment", "Role", "text", "Arusha"],
  ["job_description", "Role", "longtext", "Deliver work"],
  ["employee_address", "Parties", "text", "Mwanza"],
  ["start_date", "Terms", "date", "2026-02-01"],
  ["end_date", "Terms", "date", "2026-12-31"],
] as const;
const metadata = [
  ...entries.map(([key, group, inputKind]) => ({
    key,
    labelKey: key,
    group,
    inputKind,
    owner: "contract",
    overridePolicy: "none",
  })),
  {
    key: "contract_type",
    labelKey: "contract_type",
    group: "Terms",
    inputKind: "enum",
    owner: "contract",
    overridePolicy: "none",
  },
  {
    key: "task_description",
    labelKey: "task_description",
    group: "Terms",
    inputKind: "longtext",
    owner: "contract",
    overridePolicy: "none",
  },
] as never;

describe("legacy form/resolution invariant", () => {
  it("keeps changed flat values and overrides aligned with unsaved and saved resolution", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    let saved: Record<string, string> = {
      contract_type: "FIXED_TERM",
      start_date: "2026-01-01",
      end_date: "2026-10-01",
      job_title: "Automatic",
    };
    let overrides: Record<string, string> = { job_title: "Former title" };
    let unsaved: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (body: Record<string, any>, persist: boolean) => {
      const next = { ...saved };
      const nextOverrides = { ...overrides };
      for (const [key, name] of Object.entries(dto))
        if (name in body) next[key] = String(body[name] ?? "");
      for (const [key, value] of Object.entries(body.field_overrides ?? {})) {
        if (value) nextOverrides[key] = String(value);
        else delete nextOverrides[key];
      }
      unsaved = { ...next, ...nextOverrides };
      if (persist) {
        saved = next;
        overrides = nextOverrides;
      }
      return [...Object.keys(dto)].map((key) => ({
        key,
        value: unsaved[key] ?? "",
        automatic: next[key] ?? "",
        override: nextOverrides[key] ?? null,
        used: true,
      }));
    };
    api.getContractFields.mockImplementation(async () => apply({}, false));
    api.getContractReadiness.mockResolvedValue({
      ready: true,
      field_errors: {},
      missing_fields: [],
      warnings: {},
      signatory_id: 1,
    });
    api.listSignatories.mockResolvedValue([]);
    api.resolveContractDraftFields.mockImplementation(
      async (_token, _id, body) => apply(body, false),
    );
    api.updateContractDraft.mockImplementation(async (_token, _id, body) => {
      expect(body).not.toHaveProperty("refs");
      apply(body, true);
      return { updatedAt: new Date().toISOString() };
    });
    const contract = {
      id: 1,
      employeeId: 1,
      employeeNo: "E1",
      referenceNo: "EC-1",
      version: 1,
      title: "Contract",
      contractType: "FIXED_TERM",
      startDate: "2026-01-01",
      status: "DRAFT",
      sections: [],
      particulars: { field_overrides: { job_title: "Former title" } },
      updatedAt: "2026-01-01T00:00:00Z",
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
    for (const [key, , , value] of entries) {
      const input = element.querySelector(
        `#field-${key} input, #field-${key} textarea, #field-${key} select`,
      ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      expect(input).toBeTruthy();
      const proto =
        input instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(
          input,
          value,
        );
        input.dispatchEvent(
          new Event(input instanceof HTMLSelectElement ? "change" : "input", {
            bubbles: true,
          }),
        );
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(unsaved[key]).toBe(value);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(overrides[key] || saved[key]).toBe(value);
      expect(input.value).toBe(value);
    }
    const type = element.querySelector(
      "#field-contract_type select",
    ) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!.call(type, "SPECIFIC_TASK");
      type.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(element.querySelector("#field-end_date")).toBeNull();
    const task = element.querySelector(
      "#field-task_description textarea",
    ) as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(task, "Build a bridge");
      task.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(unsaved.task_description).toBe("Build a bridge");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(saved.task_description).toBe("Build a bridge");
    const title = element.querySelector("#field-job_title")!;
    await act(async () => {
      [...title.querySelectorAll("button")]
        .find((button) => button.textContent === "Reset to automatic")!
        .click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });
    expect(overrides.job_title).toBeUndefined();
    expect(unsaved.job_title).toBe("Automatic");
    await act(async () => root.unmount());
    element.remove();
  }, 30000);
});
