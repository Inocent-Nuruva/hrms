// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEvidencePicker } from "./activity-evidence-picker";
import { ApiError } from "@/lib/request-json";
import { persistAuthSession } from "@/lib/auth-session-store";

const api = vi.hoisted(() => ({
  listMyDocuments: vi.fn(),
  addMyActivityEvidence: vi.fn(),
}));
vi.mock("@/lib/admin-api", () => api);
vi.mock("@/components/ui/fluent-select", () => ({
  FluentSelect: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      aria-label="Supporting document"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listMyDocuments.mockReset();
  api.addMyActivityEvidence.mockReset();
  persistAuthSession(null, null);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  if (!button) throw new Error(`Missing button ${label}`);
  button.click();
}

describe("activity evidence workflow", () => {
  it("distinguishes permission failure from having no documents", async () => {
    api.listMyDocuments.mockRejectedValue(new ApiError("Forbidden", 403));
    await act(async () =>
      root.render(<ActivityEvidencePicker entryId="10" onAttached={vi.fn()} />),
    );
    await act(async () => click("Attach evidence"));
    expect(container.textContent).toContain("required module permissions");
    expect(container.textContent).not.toContain("You have no documents");
  });
  it("attaches only a listed document, refreshes, and clears the completed selection", async () => {
    api.listMyDocuments.mockResolvedValue([{ id: 4, title: "Visit receipt" }]);
    api.addMyActivityEvidence.mockResolvedValue({ id: 5 });
    const refresh = vi.fn().mockResolvedValue(undefined);
    await act(async () =>
      root.render(<ActivityEvidencePicker entryId="10" onAttached={refresh} />),
    );
    await act(async () => click("Attach evidence"));
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "4";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => click("Attach selected document"));
    expect(api.addMyActivityEvidence).toHaveBeenCalledWith("", "10", {
      document_id: 4,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Evidence attached");
    expect(container.querySelector("select")!.value).toBe("");
  });
});
