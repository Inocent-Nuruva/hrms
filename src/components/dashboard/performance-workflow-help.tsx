"use client";

import { useId, useState, type CSSProperties } from "react";
import { PERFORMANCE_SETUP_STEPS } from "@/lib/performance-setup-wizard";
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Button,
  TeachingPopover,
  TeachingPopoverTrigger,
  TeachingPopoverSurface,
  TeachingPopoverHeader,
  TeachingPopoverBody,
  TeachingPopoverTitle,
  TeachingPopoverFooter,
} from "@fluentui/react-components";
import { Info20Regular } from "@fluentui/react-icons";
import styles from "./performance-workflow-help.module.css";

const workflowSteps = [
  "Set up a financial year and its review periods.",
  "Define KPIs, templates, rating scales, scorecards, and approval workflow.",
  "Assign employee plans with KPI weights totaling exactly 100%.",
  "Employees submit self reviews, then managers submit their review.",
  "HR reviews and calibrates eligible scores before approval and publication.",
] as const;

function WorkflowPreview() {
  const titleId = useId();
  return (
    <svg
      viewBox="0 0 440 254"
      role="img"
      aria-labelledby={titleId}
      className={styles.preview}
    >
      <title id={titleId}>
        Performance setup preview:{" "}
        {PERFORMANCE_SETUP_STEPS.map((step) => step.title).join(", ")}.
      </title>
      <rect
        x="14"
        y="14"
        width="412"
        height="226"
        rx="10"
        fill="white"
        stroke="#c7dff6"
      />
      <path d="M14 45H426" stroke="#e1eaf4" />
      {[28, 40, 52].map((x) => (
        <circle key={x} cx={x} cy="30" r="3" fill="#a9c7e8" />
      ))}
      <text x="68" y="34" fill="#344c65" fontSize="12" fontWeight="600">
        Performance setup · 9 steps
      </text>
      {PERFORMANCE_SETUP_STEPS.map((step, index) => {
        const x = 25 + (index % 3) * 132;
        const y = 58 + Math.floor(index / 3) * 56;
        return (
          <g key={step.key}>
            <rect
              x={x}
              y={y}
              width="126"
              height="48"
              rx="5"
              fill="#eff6ff"
              stroke="#dceafa"
            />
            <rect
              x={x}
              y={y}
              width="126"
              height="48"
              rx="5"
              fill="#0f6cbd"
              opacity="0"
              className={styles.highlight}
              style={{ "--step-delay": `${index * 2}s` } as CSSProperties}
            />
            <text
              x={x + 8}
              y={y + 17}
              fill="#164d80"
              fontSize="11"
              fontWeight="600"
            >
              {index + 1}. {step.title}
            </text>
            <text x={x + 8} y={y + 35} fill="#526c87" fontSize="10">
              {step.optional ? "Optional" : "Required"}
            </text>
          </g>
        );
      })}
      <text x="25" y="226" fill="#526c87" fontSize="10">
        Create each record, then continue. Optional steps can be skipped.
      </text>
    </svg>
  );
}

export function PerformanceWorkflowHelp({
  periodActions = false,
}: {
  periodActions?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TeachingPopover
      open={open}
      onOpenChange={(_event, data) => setOpen(data.open)}
      positioning="below-end"
      withArrow
    >
      <TeachingPopoverTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          icon={<Info20Regular />}
          aria-label={
            periodActions
              ? "Learn about review period actions"
              : "Learn about the performance workflow"
          }
          title={
            periodActions ? "Review period actions" : "Performance workflow"
          }
        />
      </TeachingPopoverTrigger>
      <TeachingPopoverSurface
        style={{
          width: "min(440px, calc(100vw - 32px))",
          maxHeight: "min(720px, calc(100dvh - 32px))",
          overflowY: "auto",
        }}
      >
        <TeachingPopoverHeader
          dismissButton={{
            "aria-label": "Close workflow guide",
            onClick: () => setOpen(false),
          }}
        >
          How it works
        </TeachingPopoverHeader>
        <TeachingPopoverBody
          media={periodActions ? undefined : <WorkflowPreview />}
          mediaLength="medium"
        >
          <TeachingPopoverTitle>
            {periodActions ? "Review period actions" : "Performance workflow"}
          </TeachingPopoverTitle>
          {periodActions ? (
            <div className="mt-2 flex flex-col gap-3">
              <p>Use these actions for the selected period:</p>
              <dl className="flex flex-col gap-3">
                <div>
                  <dt className="font-semibold">Prepare reviews</dt>
                  <dd>
                    Creates review assignments from employees’ active
                    performance plans for this period. Create or activate the
                    employee plans first. “No active plans” means there is
                    nothing eligible to assign.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Update KPI values</dt>
                  <dd>
                    Updates eligible KPI values using attendance, leave,
                    activities, and field visits already recorded in the system.
                    Prepare reviews first so there are review records to update.
                    Manual KPIs still need manual input.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Close period</dt>
                  <dd>
                    Closes the period and sets it to Locked. Finish assignments,
                    data synchronization, and review work before locking. This
                    does not approve or publish reviews. Reopening requires the
                    appropriate permission and a reason.
                  </dd>
                </div>
              </dl>
              <p>
                <strong>Recommended order:</strong> Activate → Prepare reviews →
                Update KPI values → Complete reviews → Close period.
              </p>
            </div>
          ) : (
            <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
              {workflowSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          <Accordion collapsible>
            <AccordionItem value="setup-tips">
              <AccordionHeader>Setup tips</AccordionHeader>
              <AccordionPanel>
                <ol className="flex list-decimal flex-col gap-3 pl-5">
                  {PERFORMANCE_SETUP_STEPS.map((step) => (
                    <li key={step.key}>
                      <strong>{step.title}</strong>
                      <div>{step.guidance}</div>
                    </li>
                  ))}
                </ol>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </TeachingPopoverBody>
        <TeachingPopoverFooter
          primary={{ children: "Got it", onClick: () => setOpen(false) }}
        />
      </TeachingPopoverSurface>
    </TeachingPopover>
  );
}
