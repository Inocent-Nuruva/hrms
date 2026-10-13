// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { persistAuthSession, persistAuthUser } from "@/lib/auth-session-store";
import { ValidatedWorkflowForm } from "./validated-workflow-form";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

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
const schema = z.object({ title: z.string().trim().min(1) });
function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!button) throw new Error(`Missing button ${label}`);
  button.click();
}

describe("validated workflow recovery", () => {
  it("validates direct creation without requiring a review and prevents duplicate submits", async () => {
    let resolveSave: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const render = (title: string) =>
      root.render(
        <ValidatedWorkflowForm
          requireReview={false}
          submitLabel="Create"
          saving={false}
          onSubmit={save}
          validation={{ schema, input: { title } }}
          description="Enter details."
        >
          <input aria-label="Title" defaultValue={title} />
        </ValidatedWorkflowForm>,
      );
    await act(async () => render(""));
    expect(container.textContent).not.toContain("Review details");
    await act(async () => click("Create"));
    expect(save).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Correct these fields");
    await act(async () => render("Annual cycle"));
    await act(async () => {
      click("Create");
      click("Create");
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Review your changes");
    await act(async () => resolveSave?.());
  });

  it("keeps invalid details inline and requires review before the mutation", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const render = (title: string) =>
      root.render(
        <ValidatedWorkflowForm
          saving={false}
          onSubmit={save}
          validation={{ schema, input: { title } }}
          description="Confirm the changes."
        >
          <input aria-label="Title" defaultValue={title} />
        </ValidatedWorkflowForm>,
      );
    await act(async () => render(""));
    await act(async () => click("Review details"));
    expect(container.textContent).toContain("Correct these fields");
    expect(save).not.toHaveBeenCalled();
    await act(async () => render("Review source records"));
    await act(async () => click("Review details"));
    expect(container.textContent).toContain("Review your changes");
    await act(async () => {
      click("Confirm and save");
      click("Confirm and save");
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("returns changed inputs to validation and retains values after a failed save", async () => {
    const save = vi
      .fn()
      .mockRejectedValue(new Error("Version changed; refresh"));
    const render = (title: string) =>
      root.render(
        <ValidatedWorkflowForm
          saving={false}
          onSubmit={save}
          validation={{ schema, input: { title } }}
          description="Confirm."
        >
          <span>{title}</span>
        </ValidatedWorkflowForm>,
      );
    await act(async () => render("Original"));
    await act(async () => click("Review details"));
    await act(async () => render("Updated"));
    expect(container.textContent).toContain("1 of 2");
    await act(async () => click("Review details"));
    await act(async () => click("Confirm and save"));
    expect(container.textContent).toContain("Version changed; refresh");
    expect(container.textContent).toContain("Updated");
  });
  it("discards old reads after a newer request and after a scope change", async () => {
    const controls: Array<{ commit: (apply: () => void) => void }> = [];
    const changes = vi.fn();
    function Probe({ scope }: { scope: string }) {
      const { begin } = useWorkflowRequest(scope);
      return <button onClick={() => controls.push(begin())}>Start</button>;
    }
    await act(async () => root.render(<Probe scope="overview" />));
    await act(async () => {
      click("Start");
      click("Start");
    });
    controls[0].commit(() => changes("old"));
    controls[1].commit(() => changes("current"));
    expect(changes.mock.calls).toEqual([["current"]]);
    await act(async () => root.render(<Probe scope="setup" />));
    controls[1].commit(() => changes("wrong scope"));
    expect(changes).toHaveBeenCalledTimes(1);
    await act(async () => click("Start"));
    await act(async () => root.unmount());
    controls[2].commit(() => changes("unmounted"));
    expect(changes).toHaveBeenCalledTimes(1);
  });
  it("rejects pending work after a company change even if the access token is unchanged", async () => {
    persistAuthSession(
      { accessToken: "same-token", refreshToken: "refresh" },
      {
        id: 1,
        companyId: 10,
        fullName: "Employee",
        email: "employee@example.test",
      },
    );
    let pending:
      | ReturnType<ReturnType<typeof useWorkflowRequest>["begin"]>
      | undefined;
    const changes = vi.fn();
    function Probe() {
      const { begin } = useWorkflowRequest("overview");
      return (
        <button
          onClick={() => {
            pending = begin();
          }}
        >
          Start
        </button>
      );
    }
    await act(async () => root.render(<Probe />));
    await act(async () => click("Start"));
    await act(async () =>
      persistAuthUser({
        id: 1,
        companyId: 20,
        fullName: "Employee",
        email: "employee@example.test",
      }),
    );
    pending?.commit(() => changes("wrong company"));
    expect(changes).not.toHaveBeenCalled();
    await act(async () => persistAuthSession(null, null));
  });
});
