// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ContractOverrideInput } from "./contract-workspace-override";

describe("contract field accessibility", () => {
  it("associates an invalid reason with its accessible error", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const element = document.createElement("div");
    document.body.append(element);
    const root = createRoot(element);
    const item = {
      key: "employee_address",
      labelKey: "employee_address",
      group: "Parties",
      inputKind: "text",
      owner: "employee",
      overridePolicy: "with-reason",
    } as never;
    await act(async () =>
      root.render(
        <ContractOverrideInput
          item={item}
          field={undefined}
          active
          value="Arusha"
          reason=""
          onActivate={() => undefined}
          onReset={() => undefined}
          onValue={() => undefined}
          onReason={() => undefined}
        />,
      ),
    );
    const reason = [...element.querySelectorAll("input")].find(
      (input) => input.getAttribute("aria-invalid") === "true",
    )!;
    expect(reason).toBeTruthy();
    const id = reason.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.getAttribute("role")).toBe("alert");
    await act(async () => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  });
});
