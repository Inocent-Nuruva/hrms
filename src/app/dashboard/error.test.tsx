// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardError from "./error";
import { registerErrorReporter } from "@/lib/error-monitoring";

let root: Root;
let container: HTMLDivElement;
let unregister: () => void;
const reporter = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  reporter.mockReset();
  unregister = registerErrorReporter(reporter);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  unregister();
  container.remove();
  vi.unstubAllGlobals();
});

describe("dashboard fault recovery", () => {
  it("reports once under StrictMode without disclosing raw messages", async () => {
    const error = Object.assign(new Error("secret credential"), { digest: "12345" });
    await act(async () => root.render(
      <React.StrictMode><DashboardError error={error} reset={vi.fn()} /></React.StrictMode>,
    ));
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(error, {
      tags: { boundary: "dashboard", phase: "render" }, extra: { digest: "12345" },
    });
    expect(container.textContent).not.toContain("secret credential");
    expect(container.textContent).toContain("12345");
  });

  it("deduplicates immediate clicks and allows a later recovery attempt", async () => {
    const reset = vi.fn();
    await act(async () => root.render(<DashboardError error={new Error("failed")} reset={reset} />));
    const button = container.querySelector("button")!;
    await act(async () => { button.click(); button.click(); });
    expect(reset).toHaveBeenCalledTimes(1);
    await act(async () => button.click());
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("handles synchronous reset and monitoring failures without losing recovery", async () => {
    const failure = new Error("reset failed");
    reporter.mockImplementation(() => { throw new Error("monitor offline"); });
    const reset = vi.fn(() => { throw failure; });
    await act(async () => root.render(<DashboardError error={new Error("render failed")} reset={reset} />));
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("Recovery could not complete");
    expect(reporter).toHaveBeenCalledWith(failure, {
      tags: { boundary: "dashboard", phase: "reset" }, extra: { digest: undefined },
    });
    await act(async () => container.querySelector("button")!.click());
    expect(reset).toHaveBeenCalledTimes(2);
  });
});
