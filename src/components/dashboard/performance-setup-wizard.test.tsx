// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceSetupWizard } from "./performance-setup-wizard";
import {
  PERFORMANCE_SETUP_STEPS,
  PerformanceSetupStepSchema,
  setupStepComplete,
} from "@/lib/performance-setup-wizard";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function button(label: string) {
  const match = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}
const defaults: React.ComponentProps<typeof PerformanceSetupWizard> = {
  step: "years",
  counts: { years: 0 },
  skipped: [],
  loading: false,
  busy: false,
  canCreate: true,
  onStepChange: vi.fn(),
  onCreate: vi.fn(),
  onSkip: vi.fn(),
  onRetry: vi.fn(),
  children: <div>Saved setup records</div>,
};
async function render(overrides: Partial<typeof defaults> = {}) {
  await act(async () =>
    root.render(<PerformanceSetupWizard {...defaults} {...overrides} />),
  );
}
describe("performance setup wizard", () => {
  it("names all nine unique steps and accepts only known deep-link keys", () => {
    expect(PERFORMANCE_SETUP_STEPS).toHaveLength(9);
    expect(
      new Set(PERFORMANCE_SETUP_STEPS.map((step) => step.createMode)).size,
    ).toBe(9);
    expect(PerformanceSetupStepSchema.safeParse("scorecards").success).toBe(
      true,
    );
    expect(PerformanceSetupStepSchema.safeParse("unknown").success).toBe(false);
    expect(setupStepComplete("years", {}, ["years"])).toBe(false);
    expect(setupStepComplete("templates", {}, ["templates"])).toBe(true);
  });
  it("opens the named create action and blocks progression until a saved record exists", async () => {
    const create = vi.fn(),
      change = vi.fn();
    await render({ onCreate: create, onStepChange: change });
    expect(button("Next: Review periods").disabled).toBe(true);
    await act(async () => button("Create financial year").click());
    expect(create).toHaveBeenCalledTimes(1);
    await render({
      counts: { years: 1 },
      onStepChange: change,
      savedStep: "years",
    });
    expect(container.textContent).toContain("Financial years saved");
    expect(button("Create another financial year").disabled).toBe(false);
    await act(async () => button("Next: Review periods").click());
    expect(change).toHaveBeenCalledWith("periods");
  });
  it("offers an explicit skip only for optional steps", async () => {
    const skip = vi.fn();
    await render({ step: "templates", counts: { templates: 0 }, onSkip: skip });
    await act(async () => button("Skip this optional step").click());
    expect(skip).toHaveBeenCalledWith("templates");
    await render();
    expect(container.textContent).not.toContain("Skip this optional step");
  });
  it("keeps loading, permissions, and failed requests separate from empty records", async () => {
    const retry = vi.fn();
    await render({
      error: "You do not have access to this configuration.",
      onRetry: retry,
    });
    expect(container.textContent).not.toContain("Saved setup records");
    expect(button("Create financial year").disabled).toBe(true);
    await act(async () => button("Retry this step").click());
    expect(retry).toHaveBeenCalledTimes(1);
    await render({ canCreate: false });
    expect(container.textContent).toContain("Creation is limited");
    expect(button("Create financial year").disabled).toBe(true);
    await render({ loading: true });
    expect(button("Next: Review periods").disabled).toBe(true);
    expect(container.textContent).toContain("Checking saved records");
  });
  it("requires complete setup before providing the employee plans link", async () => {
    await render({ step: "workflows", counts: { workflows: 1 } });
    expect(button("Finish setup and open employee plans").disabled).toBe(true);
    await render({
      step: "workflows",
      counts: {
        years: 1,
        periods: 1,
        kpis: 1,
        scales: 1,
        scorecards: 1,
        workflows: 1,
      },
      skipped: ["templates", "rules", "competencies"],
    });
    const finish = container.querySelector(
      'a[href="/dashboard/performance/plans"]',
    );
    expect(finish?.textContent).toBe("Finish setup and open employee plans");
    expect(container.textContent).toContain("9 / 9 complete");
  });
  it("blocks creation until prerequisites are available and disables navigation during saves", async () => {
    await render({
      step: "periods",
      createBlocked: "Create a financial year first.",
    });
    expect(button("Create review period").disabled).toBe(true);
    expect(container.textContent).toContain("Create a financial year first.");
    await render({ busy: true, counts: { years: 1 } });
    expect(button("Create another financial year").disabled).toBe(true);
    expect(button("Next: Review periods").disabled).toBe(true);
    expect(
      container
        .querySelector('button[aria-current="step"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);
  });
});
