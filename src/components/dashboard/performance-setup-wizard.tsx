"use client";

import { useId, type ReactNode } from "react";
import {
  Add20Regular,
  Checkmark20Filled,
} from "@fluentui/react-icons";
import {
  Badge,
  Button,
  Card,
  CardFooter,
  ProgressBar,
  Link,
  Tab,
  TabList,
  Title3,
} from "@fluentui/react-components";
import { FluentNotice } from "@/components/dashboard/fluent-notice";
import styles from "./performance-setup-wizard.module.css";
import {
  PERFORMANCE_SETUP_STEPS,
  getPerformanceSetupStep,
  setupStepComplete,
  type PerformanceSetupCounts,
  type PerformanceSetupStepKey,
} from "@/lib/performance-setup-wizard";

type PerformanceSetupWizardProps = {
  step: PerformanceSetupStepKey;
  counts: PerformanceSetupCounts;
  skipped: readonly PerformanceSetupStepKey[];
  loading: boolean;
  busy: boolean;
  canCreate: boolean;
  createBlocked?: string | null;
  savedStep?: PerformanceSetupStepKey | null;
  onStepChange: (step: PerformanceSetupStepKey) => void;
  onCreate: () => void;
  onSkip: (step: PerformanceSetupStepKey) => void;
  error?: string | null;
  onRetry: () => void;
  children: ReactNode;
  headerActions?: ReactNode;
};

export function PerformanceSetupWizard({
  step,
  counts,
  skipped,
  loading,
  busy,
  canCreate,
  createBlocked,
  savedStep,
  onStepChange,
  onCreate,
  onSkip,
  children,
  error,
  onRetry,
  headerActions,
}: PerformanceSetupWizardProps) {
  const headingId = useId();
  const current = getPerformanceSetupStep(step);
  const index = PERFORMANCE_SETUP_STEPS.findIndex((item) => item.key === step);
  const complete = setupStepComplete(step, counts, skipped);
  const configured = (counts[step] ?? 0) > 0;
  const checked = counts[step] !== undefined;
  const finished = PERFORMANCE_SETUP_STEPS.filter((item) =>
    setupStepComplete(item.key, counts, skipped),
  ).length;
  const next = PERFORMANCE_SETUP_STEPS[index + 1];
  const previous = PERFORMANCE_SETUP_STEPS[index - 1];
  const disabled = loading || busy;
  const canContinue = !disabled && !error && checked && complete;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Title3 as="h2" id={headingId} className="sr-only">
            Performance setup wizard
          </Title3>
          <span role="status" className="text-sm text-muted-foreground">
            {finished} / 9 complete
          </span>
        </div>
        <ProgressBar
          max={9}
          value={finished}
          aria-label="Performance setup progress"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <nav aria-label="Performance setup steps" className={styles.tabNav}>
          <TabList
            appearance="subtle"
            aria-label="Performance setup steps"
            className={styles.tabList}
            selectedValue={step}
            size="small"
            onTabSelect={(_event, data) =>
              onStepChange(data.value as PerformanceSetupStepKey)
            }
          >
            {PERFORMANCE_SETUP_STEPS.map((item, stepIndex) => {
              const done = setupStepComplete(item.key, counts, skipped);
              const active = item.key === step;
              const status = done
                ? skipped.includes(item.key) && !(counts[item.key] ?? 0)
                  ? "Skipped"
                  : "Complete"
                : item.optional
                  ? "Optional"
                  : "Required";
              return (
                <Tab
                  key={item.key}
                  aria-label={`${item.title}, ${status}`}
                  aria-current={active ? "step" : undefined}
                  className={styles.tab}
                  disabled={disabled}
                  title={item.title}
                  value={item.key}
                >
                  <span
                    aria-hidden="true"
                    className={styles.tabNumber}
                    data-state={active ? "active" : done ? "done" : "pending"}
                  >
                    {done ? <Checkmark20Filled /> : stepIndex + 1}
                  </span>
                  <span className={styles.tabTitle}>{item.title}</span>
                </Tab>
              );
            })}
          </TabList>
        </nav>
        <Card size="small" className={styles.contentCard}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Title3 as="h3">{current.title}</Title3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge appearance="outline">Step {index + 1} of 9</Badge>
                <Badge appearance="tint">
                  {current.optional ? "Optional" : "Required"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {!checked || loading
                    ? "Checking saved records…"
                    : configured
                      ? `${counts[step]} saved`
                      : "No records yet."}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {headerActions}
              <Button
                appearance="primary"
                type="button"
                disabled={
                  disabled ||
                  !canCreate ||
                  Boolean(createBlocked) ||
                  Boolean(error)
                }
                onClick={onCreate}
              >
                <Add20Regular />
                {step === "years" && configured
                  ? "Create another financial year"
                  : current.createLabel}
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {savedStep === step && configured ? (
              <FluentNotice>
                <strong>{current.title} saved</strong>
                <div>Continue or add another record.</div>
              </FluentNotice>
            ) : null}
            {!canCreate ? (
              <FluentNotice>
                <strong>Creation is limited</strong>
                <div>
                  You can review saved setup records. Ask your administrator for
                  permission to create performance configuration.
                </div>
              </FluentNotice>
            ) : createBlocked ? (
              <FluentNotice>
                <strong>Complete the prerequisite first</strong>
                <div>{createBlocked}</div>
              </FluentNotice>
            ) : null}
            {error ? (
              <FluentNotice intent="error">
                <strong>This step could not be loaded</strong>
                <div>
                  {error}
                  <div className="mt-3">
                    <Button
                      type="button"
                      appearance="outline"
                      onClick={onRetry}
                    >
                      Retry this step
                    </Button>
                  </div>
                </div>
              </FluentNotice>
            ) : (
              children
            )}
          </div>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              appearance="outline"
              disabled={disabled || !previous}
              onClick={() => {
                if (previous) onStepChange(previous.key);
              }}
            >
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {current.optional && !configured && !loading ? (
                <Button
                  type="button"
                  appearance="outline"
                  disabled={disabled}
                  onClick={() => onSkip(step)}
                >
                  Skip this optional step
                </Button>
              ) : null}
              {next ? (
                <Button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => onStepChange(next.key)}
                >
                  Next: {next.title}
                </Button>
              ) : (
                <Button
                  disabled={disabled || Boolean(error) || finished !== 9}
                  as={!disabled && !error && finished === 9 ? "a" : "button"}
                  href={
                    !disabled && !error && finished === 9
                      ? "/dashboard/performance/plans"
                      : undefined
                  }
                >
                  Finish setup and open employee plans
                </Button>
              )}
            </div>
            {!complete && checked && !loading && !current.optional ? (
              <p className="w-full text-sm text-muted-foreground">
                Create or reuse at least one {current.title.toLowerCase()}{" "}
                record before continuing.
              </p>
            ) : null}
            {!next && finished !== 9 ? (
              <p className="w-full text-sm text-muted-foreground">
                Review the steps above: each required step needs a saved record,
                and optional steps can be configured or skipped.
              </p>
            ) : null}
            {!next && finished === 9 ? (
              <Link href="/dashboard/performance/overview">
                View performance overview
              </Link>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
