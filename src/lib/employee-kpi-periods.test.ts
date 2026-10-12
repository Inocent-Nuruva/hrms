import { describe, expect, it } from "vitest";

import {
  canProposeEmployeeKpis,
  collectEmployeeKpiPeriods,
  firstWritableEmployeeKpiPeriod,
  periodRecordFromEmployeeRow,
} from "./employee-kpi-periods";

describe("employee KPI periods", () => {
  it("prefers the nested performance period id, not the assignment id", () => {
    expect(
      periodRecordFromEmployeeRow({
        id: 91,
        status: "SELF_REVIEW_PENDING",
        performancePeriod: {
          id: 3,
          name: "Q1 2026",
          status: "OPEN",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        id: 3,
        name: "Q1 2026",
        status: "OPEN",
      }),
    );
  });

  it("falls back to performancePeriodId without using assignment or KPI titles", () => {
    expect(
      periodRecordFromEmployeeRow({
        id: 91,
        status: "OPEN",
        performancePeriodId: 3,
        period_name: "Q1 2026",
        period_status: "OPEN",
      }),
    ).toEqual({
      id: 3,
      name: "Q1 2026",
      status: "OPEN",
    });

    expect(
      periodRecordFromEmployeeRow({
        id: 7,
        title: "Acquire customers",
        performance_period_id: 3,
      }),
    ).toEqual({
      id: 3,
      name: "",
      status: "",
    });
  });

  it("collects unique periods from assignments first, then KPI rows", () => {
    const periods = collectEmployeeKpiPeriods([
      {
        id: 91,
        performancePeriod: { id: 3, name: "Q1 2026", status: "OPEN" },
      },
      {
        id: 7,
        title: "Acquire customers",
        performance_period_id: 3,
      },
      {
        id: 8,
        performance_period: { id: 4, name: "Q2 2026", status: "CLOSED" },
      },
    ]);

    expect(periods).toEqual([
      expect.objectContaining({ id: 3, name: "Q1 2026", status: "OPEN" }),
      expect.objectContaining({ id: 4, name: "Q2 2026", status: "CLOSED" }),
    ]);
  });

  it("allows proposals only while a period is explicitly open", () => {
    expect(canProposeEmployeeKpis({ id: 3, status: "OPEN" })).toBe(true);
    expect(canProposeEmployeeKpis({ id: 3, status: "DRAFT" })).toBe(false);
    expect(canProposeEmployeeKpis({ id: 3, status: "" })).toBe(false);
    expect(canProposeEmployeeKpis({ id: 3 })).toBe(false);
    expect(canProposeEmployeeKpis({ id: 4, status: "CLOSED" })).toBe(false);
    expect(canProposeEmployeeKpis({ id: 4, status: "LOCKED" })).toBe(false);
    expect(canProposeEmployeeKpis({})).toBe(false);
    expect(
      firstWritableEmployeeKpiPeriod([
        { id: 4, name: "Q2", status: "LOCKED" },
        { id: 3, name: "Q1", status: "OPEN" },
      ]),
    ).toEqual(expect.objectContaining({ id: 3 }));
  });
});
