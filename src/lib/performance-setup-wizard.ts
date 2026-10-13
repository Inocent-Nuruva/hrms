import { z } from "zod";

export const PerformanceSetupStepSchema = z.enum([
  "years",
  "periods",
  "kpis",
  "templates",
  "rules",
  "competencies",
  "scales",
  "scorecards",
  "workflows",
]);
export type PerformanceSetupStepKey = z.infer<
  typeof PerformanceSetupStepSchema
>;
export type PerformanceSetupCreateMode =
  | "year"
  | "period"
  | "kpi"
  | "template"
  | "rule"
  | "competency"
  | "scale"
  | "scorecard"
  | "workflow";
export type PerformanceSetupCounts = Partial<
  Record<PerformanceSetupStepKey, number>
>;
export type PerformanceSetupStep = {
  key: PerformanceSetupStepKey;
  title: string;
  createMode: PerformanceSetupCreateMode;
  createLabel: string;
  description: string;
  guidance: string;
  optional: boolean;
};

export const PERFORMANCE_SETUP_STEPS: readonly PerformanceSetupStep[] = [
  {
    key: "years",
    title: "Financial years",
    createMode: "year",
    createLabel: "Create financial year",
    description:
      "Manage financial years for past, current, and upcoming performance cycles.",
    guidance:
      "Create as many financial years as your company needs, each with its own code and dates. Reuse an existing year or add the next one; each year can have its own review periods.",
    optional: false,
  },
  {
    key: "periods",
    title: "Review periods",
    createMode: "period",
    createLabel: "Create review period",
    description:
      "Set the review cycle and its goal-setting, mid-cycle, and final-review dates.",
    guidance:
      "Select a financial year to filter records and preselect it for new periods. Keep periods inside the year’s dates. Generate periods from Financial years, then activate them here. Assign plans creates review assignments from active plans. Sync system KPIs updates assignment values from attendance, leave, activities, and field visits.",
    optional: false,
  },
  {
    key: "kpis",
    title: "KPI definitions",
    createMode: "kpi",
    createLabel: "Create KPI definition",
    description:
      "Describe what employees will be measured on and how it is scored.",
    guidance:
      "Add a clear KPI name, measurement unit, target, and data source. Each definition creates a version that templates and employee plans can use.",
    optional: false,
  },
  {
    key: "templates",
    title: "KPI templates",
    createMode: "template",
    createLabel: "Create KPI template",
    description:
      "Group KPI versions into a reusable set for the roles that use them.",
    guidance:
      "Choose applicable roles and KPI versions. Their weights must total exactly 100%. Skip this step if you will assign employee plans directly.",
    optional: true,
  },
  {
    key: "rules",
    title: "Assignment rules",
    createMode: "rule",
    createLabel: "Create assignment rule",
    description:
      "Choose which KPI definitions apply to employees automatically.",
    guidance:
      "Match a KPI version to the employee, role-related organization filters, or review cycle. Skip this step if you will use templates or manually assigned plans.",
    optional: true,
  },
  {
    key: "competencies",
    title: "Competencies",
    createMode: "competency",
    createLabel: "Create competency template",
    description:
      "Define the behaviors and skills managers will assess alongside KPI results.",
    guidance:
      "Create the competency template and its item weights. The current single-item form requires 100% weight. Skip this step if your scorecard does not use competencies.",
    optional: true,
  },
  {
    key: "scales",
    title: "Rating scales",
    createMode: "scale",
    createLabel: "Create rating scale",
    description: "Turn numeric scores into understandable performance ratings.",
    guidance:
      "Choose the score range and rating bands. A band must fit inside the scale; review the scale before using it to interpret employee results.",
    optional: false,
  },
  {
    key: "scorecards",
    title: "Scorecards",
    createMode: "scorecard",
    createLabel: "Create scorecard",
    description:
      "Decide how KPIs, activities, attendance, and other assessments contribute to the final result.",
    guidance:
      "Enable the components you use and make their weights total exactly 100%. Select a default scorecard and its effective dates when needed.",
    optional: false,
  },
  {
    key: "workflows",
    title: "Approval workflow",
    createMode: "workflow",
    createLabel: "Create approval workflow",
    description:
      "Define who approves a review and in which order before HR publishes the result.",
    guidance:
      "Add uniquely ordered approval steps and select who can finalize the review. Finish setup once the workflow is saved, then continue to employee plans.",
    optional: false,
  },
];

export function getPerformanceSetupStep(
  key: PerformanceSetupStepKey,
): PerformanceSetupStep {
  const step = PERFORMANCE_SETUP_STEPS.find((item) => item.key === key);
  if (!step) throw new Error(`Unknown performance setup step: ${key}`);
  return step;
}

export function setupStepComplete(
  key: PerformanceSetupStepKey,
  counts: PerformanceSetupCounts,
  skipped: readonly PerformanceSetupStepKey[],
): boolean {
  return (
    (counts[key] ?? 0) > 0 ||
    (getPerformanceSetupStep(key).optional && skipped.includes(key))
  );
}
