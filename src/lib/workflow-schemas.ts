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
