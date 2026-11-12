// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ContractWorkspaceShell } from "./contract-workspace-shell";
import type { ContractFieldMetadata } from "@/lib/contracts-api";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("./contract-page-panels", () => ({ ActivityPanel: () => null }));
vi.mock("./contract-workspace-versions", () => ({
  ContractWorkspaceVersions: () => null,
}));
vi.mock("./contract-workspace-reference", () => ({
  ContractReferencePicker: ({
    label,
    value,
    reason,
    onChange,
    onReason,
  }: {
    label: string;
    value: number | null;
    reason: string;
    onChange: (value: number | null) => void;
    onReason: (value: string) => void;
  }) => (
    <div>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">Automatic</option>
        <option value="42">Selected</option>
      </select>
      <input
        aria-label={`${label} reason`}
        value={reason}
        onChange={(event) => onReason(event.target.value)}
      />
    </div>
  ),
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

const tokens = [
  "employee_address",
  "employee_phone",
  "employee_email",
  "hours_of_work",
  "annual_leave_days",
  "notice_period",
  "governing_law",
  "salary",
  "currency",
  "pay_frequency",
  "remuneration_method",
];
const references: Record<string, string> = {
  department_id: "department",
  position_id: "job_title",
  grade_id: "grade",
  branch_id: "work_location",
  reports_to_id: "reporting_manager",
};
const metadata = [
  ...tokens.map((key) => ({
    key,
    labelKey: key,
    group: "Terms",
    inputKind: ["currency", "pay_frequency", "remuneration_method"].includes(
      key,
    )
      ? "enum"
      : key === "annual_leave_days"
        ? "number"
        : "text",
    owner: "policy",
    overridePolicy: "with-reason",
  })),
  ...Object.entries(references).map(([referenceKey, key]) => ({
    key,
    labelKey: key,
    group: "Role",
    inputKind: "reference",
    owner: "employee",
    overridePolicy: "reference-only",
    referenceKey,
  })),
] as ContractFieldMetadata[];

describe("override and reference form invariant", () => {
  it("matches form edits to unsaved and saved values, including override reset", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    let savedOverrides: Record<string, string> = {};
    let savedRefs: Record<string, number> = {};
    let latestOverrides = {};
    let latestRefs = {};
    const automatic: Record<string, string> = Object.fromEntries(
      tokens.map((key) => [
        key,
        key === "currency"
          ? "TZS"
          : key === "pay_frequency"
            ? "monthly"
            : key === "remuneration_method"
              ? "Cash"
              : "original",
      ]),
    );
    const build = (
      overrides: Record<string, string>,
      refs: Record<string, number>,
    ) => [
      ...tokens.map((key) => ({
        key,
        value: overrides[key] || automatic[key],
        automatic: automatic[key],
        override: overrides[key] || null,
        used: true,
      })),
      ...Object.entries(references).map(([ref, key]) => ({
        key,
        value: refs[ref] ? "Selected" : "Automatic",
        automatic: "Automatic",
        automatic_reference_id: 1,
        automatic_reference_label: "Automatic",
        reference_id: refs[ref] ?? 1,
        override: null,
        used: true,
      })),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (body: Record<string, any>, save: boolean) => {
      const overrides = { ...savedOverrides };
      const refs = { ...savedRefs };
      for (const [key, value] of Object.entries(body.field_overrides ?? {})) {
        if (value) overrides[key] = String(value);
        else delete overrides[key];
      }
      for (const [key, value] of Object.entries(body.refs ?? {})) {
        if (value) refs[key] = Number(value);
        else delete refs[key];
      }
      if (save) {
        savedOverrides = overrides;
        savedRefs = refs;
      }
      latestOverrides = overrides;
      latestRefs = refs;
      return build(overrides, refs);
    };
    api.getContractFields.mockImplementation(async () =>
      build(savedOverrides, savedRefs),
    );
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
      apply(body, true);
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
    const change = async (
      input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
      value: string,
    ) => {
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
    };
    for (const key of tokens) {
      const wrapper = element.querySelector(`#field-${key}`) as HTMLElement;
      await act(async () => wrapper.querySelector("button")!.click());
      const field = wrapper.querySelector("input,textarea,select") as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      const value =
        key === "salary"
          ? "1200.50"
          : key === "annual_leave_days"
            ? "30"
            : key === "currency"
              ? "USD"
              : key === "pay_frequency"
                ? "weekly"
                : key === "remuneration_method"
                  ? "Bank transfer"
                  : "Changed";
      await change(field, value);
      if (key === "salary") {
        const before = api.updateContractDraft.mock.calls.length;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        expect(api.updateContractDraft.mock.calls.length).toBe(before);
        expect(wrapper.textContent).toContain("at least three characters");
      }
      const reason = [...wrapper.querySelectorAll("input")].find(
        (item) => item !== field,
      )!;
      await change(reason, "Agreed change");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect((latestOverrides as Record<string, string>)[key]).toBe(value);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(savedOverrides[key]).toBe(value);
      expect(field.value).toBe(value);
    }
    for (const [ref, key] of Object.entries(references)) {
      const wrapper = element.querySelector(`#field-${key}`) as HTMLElement;
      await change(wrapper.querySelector("select")!, "42");
      await change(wrapper.querySelector("input")!, "Approved assignment");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect((latestRefs as Record<string, number>)[ref]).toBe(42);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      expect(savedRefs[ref]).toBe(42);
    }
    const salary = element.querySelector("#field-salary") as HTMLElement;
    await act(async () =>
      [...salary.querySelectorAll("button")]
        .find((button) => button.textContent === "Reset to automatic")!
        .click(),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect((latestOverrides as Record<string, string>).salary).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(savedOverrides.salary).toBeUndefined();
    await act(async () => root.unmount());
    element.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }, 30000);
});
