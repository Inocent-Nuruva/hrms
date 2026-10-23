import { z } from "zod";

const text = (max: number) =>
  z.string().trim().min(1, "This field is required.").max(max);
const numberText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Number(value)), "Enter a finite number.");
const positiveId = numberText.refine(
  (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
  "Choose a valid record.",
);
const percent = numberText.refine(
  (value) => Number(value) >= 0 && Number(value) <= 100,
  "Enter a number from 0 to 100.",
);
const weight = numberText.refine(
  (value) =>
    /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) &&
    Number(value) > 0 &&
    Number(value) <= 100,
  "Weight must be greater than 0 and at most 100, with up to two decimals.",
);
export const workflowDate = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    "Choose a valid calendar date.",
  );
const optionalDate = z.union([workflowDate, z.literal("")]).optional();
const optionalNumber = z.union([numberText, z.literal("")]).optional();
const optionalPercent = z.union([percent, z.literal("")]).optional();
const optionalId = z.union([positiveId, z.literal("")]).optional();
const formObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).passthrough();

function dateRange<T extends z.ZodRawShape>(
  shape: T,
  from: string,
  to: string,
) {
  return formObject(shape).superRefine((input, context) => {
    const start = input[from];
    const end = input[to];
    if (
      typeof start === "string" &&
      typeof end === "string" &&
      start &&
      end &&
      end < start
    ) {
      context.addIssue({
        code: "custom",
        path: [to],
        message: "The end date must be on or after the start date.",
      });
    }
  });
}

export function weightsTotalExactly100(
  values: readonly string[],
  allowZero = false,
): boolean {
  return (
    values.length > 0 &&
    values.every(
      (value) =>
        weight.safeParse(value).success || (allowZero && value === "0"),
    ) &&
    values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0) ===
      10000
  );
}

export const activityTaskSchema = formObject({
  title: text(250),
  description: text(4000),
  activity_date: workflowDate,
  start_time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid start time."),
  end_time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid end time."),
  due_date: optionalDate,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  activity_category_id: optionalId,
  expected_result: z.string().max(4000).optional(),
  employee_kpi_id: optionalId,
  audience: z.enum(["employee", "self"]),
  employeeIds: z.array(positiveId).max(100),
  checklistItems: z.array(text(250)).max(100),
}).superRefine((input, context) => {
  if (input.end_time <= input.start_time)
    context.addIssue({
      code: "custom",
      path: ["end_time"],
      message: "End time must be later than start time.",
    });
  if (input.due_date && input.due_date < input.activity_date)
    context.addIssue({
      code: "custom",
      path: ["due_date"],
      message: "Due date cannot be before the activity day.",
    });
  if (input.audience === "employee" && !input.employeeIds.length)
    context.addIssue({
      code: "custom",
      path: ["employeeIds"],
      message: "Choose at least one employee.",
    });
});

export function activityFormSchema(mode: string) {
  if (mode === "report") return formObject({ activity_date: workflowDate });
  if (mode === "entry")
    return formObject({
      id: positiveId,
      activity_category_id: positiveId,
      title: text(250),
      description: text(4000),
      status: z
        .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "DEFERRED", "CANCELLED"])
        .optional(),
      outcome: z.string().max(4000).optional(),
      defer_reason: z.string().max(4000).optional(),
      planned_start_time: z.string().optional(),
      planned_end_time: z.string().optional(),
      requires_time: z.boolean().optional(),
      requires_outcome: z.boolean().optional(),
    }).superRefine((input, context) => {
      if (
        input.requires_time &&
        (!input.planned_start_time || !input.planned_end_time)
      )
        context.addIssue({
          code: "custom",
          path: ["planned_start_time"],
          message: "This category requires start and end times.",
        });
      if (input.planned_start_time || input.planned_end_time) {
        if (
          !input.planned_start_time ||
          !input.planned_end_time ||
          !Number.isFinite(Date.parse(input.planned_start_time)) ||
          !Number.isFinite(Date.parse(input.planned_end_time)) ||
          Date.parse(input.planned_end_time) <=
            Date.parse(input.planned_start_time)
        )
          context.addIssue({
            code: "custom",
            path: ["planned_end_time"],
            message: "Choose valid increasing start and end times.",
          });
      }
      if (
        input.status === "COMPLETED" &&
        input.requires_outcome &&
        !input.outcome?.trim()
      )
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "Describe the completed result for this category.",
        });
      if (input.status === "DEFERRED" && !input.defer_reason?.trim())
        context.addIssue({
          code: "custom",
          path: ["defer_reason"],
          message: "Explain why this activity is deferred.",
        });
    });
  if (mode === "submit")
    return formObject({
      id: positiveId,
      employee_summary: text(5000),
      overall_remarks: z.string().max(3000).optional(),
    });
  if (mode === "review")
    return formObject({
      id: positiveId,
      decision: z.enum(["APPROVE", "RETURN", "REJECT"]),
      comments: text(5000),
      rating: optionalPercent,
    });
  if (mode === "category")
    return formObject({
      code: text(80),
      name: text(180),
      description: z.string().optional(),
    });
  return dateRange(
    {
      effective_from: workflowDate,
      effective_to: optionalDate,
      minimum_activity_count: z
        .union([
          numberText.refine(
            (value) =>
              Number.isSafeInteger(Number(value)) && Number(value) >= 0,
            "Enter a nonnegative whole number.",
          ),
          z.literal(""),
        ])
        .optional(),
    },
    "effective_from",
    "effective_to",
  );
}

export function performanceFormSchema(mode: string): z.ZodType {
  const catalog = { code: text(80), name: text(180) };
  const version = {
    kpi_definition_version_id: positiveId,
    weight,
    target_value: optionalNumber,
  };
  if (mode === "year")
    return dateRange(
      {
        code: text(30),
        name: text(100),
        start_date: workflowDate,
        end_date: workflowDate,
        annual_aggregation_method: z
          .enum([
            "SIMPLE_MONTHLY_AVERAGE",
            "WEIGHTED_MONTHLY_AVERAGE",
            "QUARTERLY_ROLLUP",
            "ANNUAL_TARGET_ACHIEVEMENT",
            "MONTHLY_AVERAGE_WITH_ADJUSTMENTS",
          ])
          .or(z.literal(""))
          .optional(),
        aggregation_configuration_json: z.string().max(5000).optional(),
      },
      "start_date",
      "end_date",
    );
  if (mode === "period" || mode === "period-edit")
    return dateRange(
      {
        financial_year_id: positiveId,
        name: text(100),
        period_type: z.enum([
          "MONTHLY",
          "QUARTERLY",
          "HALF_YEARLY",
          "ANNUAL",
          "CUSTOM",
        ]),
        sequence_number: positiveId,
        start_date: workflowDate,
        end_date: workflowDate,
        goal_setting_deadline: workflowDate,
        mid_cycle_review_date: workflowDate,
        final_review_deadline: workflowDate,
      },
      "start_date",
      "end_date",
    ).superRefine((input, context) => {
      if (
        !(
          input.start_date <= input.goal_setting_deadline &&
          input.goal_setting_deadline < input.mid_cycle_review_date &&
          input.mid_cycle_review_date <= input.end_date &&
          input.end_date <= input.final_review_deadline
        )
      )
        context.addIssue({
          code: "custom",
          path: ["final_review_deadline"],
          message:
            "Dates must follow start → goal deadline → mid-cycle review → end → final deadline; goal deadline must precede mid-cycle review.",
        });
    });
  if (["kpi", "kpi-edit", "kpi-version"].includes(mode))
    return formObject({
      ...catalog,
      description: text(10000),
      measurement_unit: text(80),
      default_target_value: optionalNumber,
    });
  if (mode === "template")
    return formObject({
      ...catalog,
      ...version,
      applicable_role_ids: text(4000),
      additionalTemplateItems: z.array(
        z.object({ versionId: positiveId, weight, target: optionalNumber }),
      ),
    }).superRefine((input, context) => {
      const items = [
        { versionId: input.kpi_definition_version_id, weight: input.weight },
        ...input.additionalTemplateItems,
      ];
      if (!weightsTotalExactly100(items.map((item) => item.weight)))
        context.addIssue({
          code: "custom",
          path: ["weight"],
          message: "All KPI weights must total exactly 100%.",
        });
      if (new Set(items.map((item) => item.versionId)).size !== items.length)
        context.addIssue({
          code: "custom",
          path: ["additionalTemplateItems"],
          message: "Choose each KPI version only once.",
        });
      if (
        input.applicable_role_ids
          .split(",")
          .some((value) => !positiveId.safeParse(value.trim()).success)
      )
        context.addIssue({
          code: "custom",
          path: ["applicable_role_ids"],
          message: "Choose valid applicable roles.",
        });
    });
  if (mode === "rule")
    return formObject({
      kpi_definition_version_id: positiveId,
      priority: optionalNumber,
      weight_override: optionalPercent,
      target_override: optionalNumber,
      employee_id: optionalId,
      financial_year_id: optionalId,
    });
  if (mode === "competency")
    return formObject({
      code: text(80),
      name: text(180),
      item_code: text(60),
      item_name: text(180),
      item_weight: weight.refine(
        (value) => Number(value) === 100,
        "The single competency item must carry exactly 100% weight.",
      ),
      maximum_rating: z
        .union([
          numberText.refine(
            (value) => Number(value) > 0,
            "Maximum rating must be positive.",
          ),
          z.literal(""),
        ])
        .optional(),
    });
  if (mode === "scale")
    return formObject({
      code: text(60),
      name: text(150),
      band_code: text(40),
      band_label: text(100),
      minimum_score: optionalNumber,
      maximum_score: optionalNumber,
      band_min: optionalNumber,
      band_max: optionalNumber,
    }).superRefine((input, context) => {
      const low = Number(input.minimum_score || 0),
        high = Number(input.maximum_score || 100);
      const bandLow = Number(input.band_min || 0),
        bandHigh = Number(input.band_max || 100);
      if (low >= high || bandLow > bandHigh || bandLow < low || bandHigh > high)
        context.addIssue({
          code: "custom",
          path: ["band_max"],
          message:
            "The band must fit within the scale's increasing minimum and maximum.",
        });
    });
  if (mode === "plan" || mode === "generate-plan")
    return dateRange(
      {
        employee_id: positiveId,
        financial_year_id: positiveId,
        effective_from: workflowDate,
        effective_to: optionalDate,
        ...(mode === "plan"
          ? {
              ...version,
              weight: weight.refine(
                (value) => Number(value) === 100,
                "This single-item plan must total exactly 100%.",
              ),
            }
          : {}),
      },
      "effective_from",
      "effective_to",
    );
  if (mode === "development")
    return dateRange(
      {
        employee_id: positiveId,
        title: text(160),
        goal_title: text(180),
        start_date: optionalDate,
        target_completion_date: optionalDate,
        goal_target_date: optionalDate,
      },
      "start_date",
      "target_completion_date",
    );
  if (mode === "pip")
    return formObject({
      review_id: positiveId,
      summary: text(10000),
      objectives: text(10000),
      milestone_title: text(180),
      milestone_due: workflowDate,
    });
  if (mode === "approve")
    return formObject({
      period_assignment_id: positiveId,
      adjustment_score: optionalNumber,
    });
  if (mode === "workflow-action")
    return formObject({
      review_id: positiveId,
      decision: z.enum(["APPROVE", "RETURN", "REJECT", "SKIP"]),
      comment: z.string().max(4000).optional(),
      adjustment_score: optionalNumber,
    }).superRefine((input, context) => {
      if (input.decision !== "APPROVE" && !input.comment?.trim())
        context.addIssue({
          code: "custom",
          path: ["comment"],
          message: "Explain why the review is being returned, rejected, or skipped.",
        });
    });
  if (mode === "moderate" || mode === "reopen")
    return formObject({
      review_id: positiveId,
      reason: text(4000),
      final_score: optionalNumber,
    });
  if (mode === "feedback")
    return formObject({
      review_id: positiveId,
      rater_employee_ids: text(4000).refine(
        (value) =>
          value
            .split(/[\n,]+/)
            .every((id) => positiveId.safeParse(id.trim()).success),
        "Enter valid employee IDs.",
      ),
      due_date: optionalDate,
    });
  if (mode === "milestone")
    return formObject({ milestone_id: positiveId, comment: text(4000) });
  if (mode === "scorecard")
    return formObject({
      code: text(80),
      name: text(160),
      effective_from: optionalDate,
      effective_to: optionalDate,
      scorecardComponents: z
        .array(
          z
            .object({
              code: text(80),
              label: text(160),
              type: text(80),
              weight: percent,
              enabled: z.boolean(),
              required: z.boolean(),
            })
            .passthrough(),
        )
        .min(1),
    }).superRefine((input, context) => {
      if (
        !weightsTotalExactly100(
          input.scorecardComponents
            .filter((item) => item.enabled)
            .map((item) => item.weight),
          true,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["scorecardComponents"],
          message: "Enabled component weights must total exactly 100%.",
        });
      if (
        input.effective_from &&
        input.effective_to &&
        input.effective_to < input.effective_from
      )
        context.addIssue({
          code: "custom",
          path: ["effective_to"],
          message: "End date cannot precede start date.",
        });
    });
  if (mode === "workflow")
    return formObject({
      code: text(80),
      name: text(160),
      workflowSteps: z
        .array(
          z
            .object({
              code: text(80),
              label: text(160),
              sequenceNumber: positiveId,
              type: text(80),
            })
            .passthrough(),
        )
        .min(1),
    }).superRefine((input, context) => {
      if (
        new Set(input.workflowSteps.map((step) => Number(step.sequenceNumber)))
          .size !== input.workflowSteps.length
      )
        context.addIssue({
          code: "custom",
          path: ["workflowSteps"],
          message: "Each workflow step needs a unique sequence.",
        });
    });
  return z.never();
}

export function employeeKpiFormSchema(
  mode: string,
  manager: boolean,
): z.ZodType {
  if (mode === "review")
    return formObject({
      decision: z.enum(["APPROVE", "RETURN", "REJECT"]),
      comment: z.string().max(4000).optional(),
    }).superRefine((input, context) => {
      if (input.decision !== "APPROVE" && !input.comment?.trim())
        context.addIssue({
          code: "custom",
          path: ["comment"],
          message: "Explain your decision.",
        });
    });
  if (mode === "actual")
    return formObject({
      actual_value: numberText.refine(
        (value) => Number(value) >= 0,
        "Actual value must be nonnegative.",
      ),
    });
  return dateRange(
    {
      performance_period_id: positiveId,
      title: text(250),
      description: text(10000),
      measurement_type: z.enum([
        "PERCENTAGE",
        "NUMBER",
        "BOOLEAN",
        "RATING",
        "CURRENCY",
        "MANUAL",
      ]),
      due_date: workflowDate,
      start_date: optionalDate,
      weight,
      target_value: optionalNumber,
      ...(manager && mode === "create" ? { employee_id: positiveId } : {}),
    },
    "start_date",
    "due_date",
  ).superRefine((input, context) => {
    if (
      input.measurement_type !== "MANUAL" &&
      input.scoring_type !== "RATING_SCALE" &&
      !input.target_value
    )
      context.addIssue({
        code: "custom",
        path: ["target_value"],
        message: "This measurement type requires a target value.",
      });
    const start = input.period_start_date,
      end = input.period_end_date;
    if (
      typeof start === "string" &&
      typeof end === "string" &&
      (input.due_date < start ||
        input.due_date > end ||
        (input.start_date && input.start_date < start))
    )
      context.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "KPI dates must fall inside the selected performance period.",
      });
  });
}

export function performanceActionSchema(mode: string): z.ZodType {
  if (mode === "appeal") return formObject({ reason: text(4000) });
  if (mode === "feedback-360")
    return formObject({
      overall_score: percent,
      collaboration_score: optionalPercent,
      communication_score: optionalPercent,
      ownership_score: optionalPercent,
    });
  if (mode === "development-goal")
    return formObject({ progress_percent: optionalPercent });
  if (mode === "achievement" || mode === "validate")
    return formObject({ achievement_value: optionalNumber });
  return formObject({ comment: text(4000) });
}
