// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  clauseTokenErrors,
  ContractWorkspaceClauses,
} from "./contract-workspace-clauses";
import type {
  ContractFieldMetadata,
  ContractSection,
} from "@/lib/contracts-api";
import { subscribeToAppToasts } from "@/components/ui/fluent-toast-store";

const metadata = [
  {
    key: "employee_name",
    labelKey: "employee_name",
    group: "Parties",
    inputKind: "text",
    owner: "employee",
    overridePolicy: "none",
  },
] as ContractFieldMetadata[];
describe("contract clause tokens", () => {
  it("adds, titles, removes and restores a clause through undo", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let sections: ContractSection[] = [];
    let undo: React.ReactNode = null;
    const unsubscribe = subscribeToAppToasts((event) => {
      undo = event.options?.description;
    });
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const render = () =>
      root.render(
        <ContractWorkspaceClauses
          sections={sections}
          metadata={metadata}
          fields={[]}
          onChange={(next) => {
            sections = next;
            render();
          }}
        />,
      );
    await act(async () => render());
    await act(async () => {
      [...element.querySelectorAll("button")]
        .find((button) => button.textContent === "Add clause")!
        .click();
    });
    const title = element.querySelector(
      'input[aria-label="Clause title"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(title, "Duties");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(sections[0].heading).toBe("Duties");
    await act(async () => {
      [...element.querySelectorAll("button")]
        .find((button) => button.textContent === "Remove clause")!
        .click();
    });
    expect(sections).toHaveLength(0);
    const toastElement = document.createElement("div");
    document.body.append(toastElement);
    const toastRoot = createRoot(toastElement);
    await act(async () => toastRoot.render(<>{undo}</>));
    await act(async () => toastElement.querySelector("button")!.click());
    expect(sections[0].heading).toBe("Duties");
    await act(async () => {
      root.unmount();
      toastRoot.unmount();
    });
    element.remove();
    toastElement.remove();
    unsubscribe();
    vi.unstubAllGlobals();
  });
  it("inserts a field from the autocomplete without changing surrounding wording", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let sections: ContractSection[] = [
      { id: "free", heading: "Text", body: "Hello " },
    ];
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const render = () =>
      root.render(
        <ContractWorkspaceClauses
          sections={sections}
          metadata={metadata}
          fields={[]}
          onChange={(next) => {
            sections = next;
            render();
          }}
        />,
      );
    await act(async () => render());
    const area = element.querySelector("textarea")!;
    await act(async () => {
      area.focus();
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(area, "Hello {{employee");
      area.setSelectionRange(area.value.length, area.value.length);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const suggestion = [...element.querySelectorAll("button")].find(
      (button) => button.textContent === "Employee full name",
    );
    expect(suggestion).toBeTruthy();
    await act(async () => suggestion!.click());
    expect(sections[0].body).toBe("Hello {{employee_name}}");
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("detects unknown and malformed tokens without rejecting valid tokens", () => {
    const sections = [
      {
        id: "a",
        heading: "Title",
        body: "{{employee_name}} {{unknown}} {{Bad-Token}} {{open",
      },
    ];
    expect(clauseTokenErrors(sections, metadata)).toEqual(
      expect.arrayContaining(["unknown", "Bad-Token", "{{…}}"]),
    );
    expect(
      clauseTokenErrors(
        [{ ...sections[0], body: "Hello {{ employee_name }}" }],
        metadata,
      ),
    ).toEqual([]);
  });
  it("never places a hidden resolved value in a token tooltip", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    await act(async () =>
      root.render(
        <ContractWorkspaceClauses
          sections={[{ id: "a", heading: "Terms", body: "{{employee_name}}" }]}
          metadata={metadata}
          fields={[
            {
              key: "employee_name",
              value: "secret",
              automatic: "secret",
              override: null,
              used: true,
              hidden: true,
            },
          ]}
          onChange={() => undefined}
        />,
      ),
    );
    expect(element.innerHTML).not.toContain("secret");
    expect(
      element.querySelector('[title="Current value: Hidden"]'),
    ).toBeTruthy();
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
  it("preserves locked and required clauses and allows keyboard reordering", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let sections: ContractSection[] = [
      { id: "locked", heading: "Locked", body: "Fixed", editable: false },
      { id: "required", heading: "Required", body: "Text", optional: false },
      {
        id: "optional",
        heading: "Optional",
        body: "{{employee_name}}",
        optional: true,
      },
    ];
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const render = () =>
      root.render(
        <ContractWorkspaceClauses
          sections={sections}
          metadata={metadata}
          fields={[
            {
              key: "employee_name",
              value: "Amina",
              automatic: "Amina",
              override: null,
              used: true,
            },
          ]}
          onChange={(next) => {
            sections = next;
            render();
          }}
        />,
      );
    await act(async () => render());
    const items = element.querySelectorAll("li[draggable]");
    expect(
      (items[0].querySelector("textarea") as HTMLTextAreaElement).readOnly,
    ).toBe(true);
    expect(items[0].textContent).not.toContain("Remove clause");
    expect(items[1].textContent).not.toContain("Remove clause");
    expect(
      items[2].querySelector('[title="Current value: Amina"]'),
    ).toBeTruthy();
    const area = items[2].querySelector("textarea") as HTMLTextAreaElement;
    const picker = element.querySelector(
      'select[aria-label="Insert a field"]',
    ) as HTMLSelectElement;
    await act(async () => {
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    });
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )!.set!.call(picker, "employee_name");
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(sections[2].body).toBe("{{employee_name}}{{employee_name}}");
    const up = [...items[2].querySelectorAll("button")].find(
      (button) => button.textContent === "Move up",
    )!;
    await act(async () => up.click());
    expect(sections.map((section) => section.id)).toEqual([
      "locked",
      "optional",
      "required",
    ]);
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
});
