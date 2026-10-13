import { describe, expect, it } from "vitest";
import { collectKpiCategories, resolveKpiCategory } from "./kpi-categories";

describe("KPI category selection", () => {
  it("offers existing categories once despite case and spacing differences", () => {
    expect(
      collectKpiCategories([
        " Sales ",
        "sales",
        "",
        "Customer   service",
        "Quality",
      ]),
    ).toEqual(["Customer service", "Quality", "Sales"]);
  });
  it("reuses the existing category label when the user types different capitalization", () => {
    expect(resolveKpiCategory(" SALES ", ["Sales", "Quality"])).toBe("Sales");
  });
  it("allows a new category and keeps the optional empty value", () => {
    expect(resolveKpiCategory(" Customer   care ", ["Sales"])).toBe(
      "Customer care",
    );
    expect(resolveKpiCategory("  ", ["Sales"])).toBe("");
  });
});
