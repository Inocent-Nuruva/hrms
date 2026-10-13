"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  ProgressBar,
  Text,
} from "@fluentui/react-components";
import {
  Add20Regular,
  CheckmarkCircle20Filled,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Dismiss20Regular,
  PlayCircleSparkle20Regular,
} from "@fluentui/react-icons";
import {
  PERFORMANCE_SETUP_STEPS,
  getPerformanceSetupStep,
  setupStepComplete,
  type PerformanceSetupCounts,
  type PerformanceSetupStepKey,
} from "@/lib/performance-setup-wizard";
import styles from "./performance-guided-setup-dialog.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep: PerformanceSetupStepKey;
  counts: PerformanceSetupCounts;
  skipped: readonly PerformanceSetupStepKey[];
  loading: boolean;
  busy: boolean;
  canCreate: boolean;
  createBlocked: (step: PerformanceSetupStepKey) => string | null;
  configuredItems: (step: PerformanceSetupStepKey) => string[];
  onStepChange: (step: PerformanceSetupStepKey) => void;
  onCreate: (step: PerformanceSetupStepKey) => void;
  onSkip: (step: PerformanceSetupStepKey) => void;
};

export function PerformanceGuidedSetupDialog({
  open,
  onOpenChange,
  initialStep,
  counts,
  skipped,
  loading,
  busy,
  canCreate,
  createBlocked,
  configuredItems,
  onStepChange,
  onCreate,
  onSkip,
}: Props) {
  const [step, setStep] = React.useState<PerformanceSetupStepKey>(initialStep);

  React.useEffect(() => {
    if (open) setStep(initialStep);
  }, [initialStep, open]);

  const index = PERFORMANCE_SETUP_STEPS.findIndex((item) => item.key === step);
  const current = getPerformanceSetupStep(step);
  const done = setupStepComplete(step, counts, skipped);
  const blocked = createBlocked(step);
  const finished = PERFORMANCE_SETUP_STEPS.filter((item) =>
    setupStepComplete(item.key, counts, skipped),
  ).length;
  const next = PERFORMANCE_SETUP_STEPS[index + 1];
  const previous = PERFORMANCE_SETUP_STEPS[index - 1];
  const savedItems = configuredItems(step);
  const createLabel = done
    ? current.createLabel.replace(/^Create /, "Add another ")
    : current.createLabel;

  const chooseStep = (target: PerformanceSetupStepKey) => {
    setStep(target);
    onStepChange(target);
  };

  return (
    <Dialog open={open} onOpenChange={(_event, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <DialogTitle
            className={styles.title}
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss20Regular />}
                aria-label="Close guided performance setup"
                onClick={() => onOpenChange(false)}
              />
            }
          >
            <span className={styles.titleIcon} aria-hidden="true">
              <PlayCircleSparkle20Regular />
            </span>
            Guided performance setup
          </DialogTitle>
          <DialogContent className={styles.content}>
            <aside className={styles.sidebar} aria-label="Setup steps">
              <div className={styles.progress}>
                <Text weight="semibold">Your setup progress</Text>
                <Text size={200}>{finished} of 9 steps complete</Text>
                <ProgressBar max={9} value={finished} aria-label="Setup progress" />
              </div>
              <ol className={styles.stepList}>
                {PERFORMANCE_SETUP_STEPS.map((item, itemIndex) => {
                  const complete = setupStepComplete(item.key, counts, skipped);
                  const active = item.key === step;
                  return (
                    <li key={item.key}>
                      <Button
                        appearance="subtle"
                        className={styles.stepButton}
                        data-active={active ? "true" : undefined}
                        aria-current={active ? "step" : undefined}
                        onClick={() => chooseStep(item.key)}
                      >
                        <span className={styles.stepMarker} data-complete={complete ? "true" : undefined}>
                          {complete ? <CheckmarkCircle20Filled /> : itemIndex + 1}
                        </span>
                        <span className={styles.stepCopy}>
                          <span>{item.title}</span>
                          <small>{complete ? "Complete" : item.optional ? "Optional" : "Required"}</small>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </aside>
            <main className={styles.main}>
              <div className={styles.kicker}>Step {index + 1} of 9</div>
              <div className={styles.headingRow}>
                <div>
                  <h2>{current.title}</h2>
                  <p>{current.description}</p>
                </div>
                <Badge appearance={done ? "filled" : "tint"} color={done ? "success" : "brand"}>
                  {done ? "Complete" : current.optional ? "Optional" : "Required"}
                </Badge>
              </div>
              <section className={styles.guidance}>
                <Text as="h3" weight="semibold">What to do here</Text>
                <p>{current.guidance}</p>
              </section>
              <section className={styles.statusCard}>
                {loading ? (
                  <>
                    <Text weight="semibold">Checking saved records</Text>
                    <Text size={300}>Please wait while we load this step.</Text>
                  </>
                ) : done ? (
                  <>
                    <Text weight="semibold">Configured for this step</Text>
                    {savedItems.length ? (
                      <ul className={styles.savedItems}>
                        {savedItems.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : (
                      <Text size={300}>Saved records are ready to review in this step.</Text>
                    )}
                    <Text size={300}>You can review these records, continue, or add another one when your organisation needs it.</Text>
                  </>
                ) : blocked ? (
                  <>
                    <Text weight="semibold">Finish an earlier step first</Text>
                    <Text size={300}>{blocked}</Text>
                  </>
                ) : (
                  <>
                    <Text weight="semibold">Ready to create</Text>
                    <Text size={300}>Use the button below to open the form for this step. Your progress is saved as you go.</Text>
                  </>
                )}
              </section>
              <footer className={styles.footer}>
                <Button
                  appearance="secondary"
                  icon={<ChevronLeft20Regular />}
                  disabled={!previous || busy}
                  onClick={() => previous && chooseStep(previous.key)}
                >
                  Back
                </Button>
                <div className={styles.footerActions}>
                  {current.optional && !done && !loading ? (
                    <Button
                      appearance="secondary"
                      disabled={busy}
                      onClick={() => onSkip(step)}
                    >
                      Skip for now
                    </Button>
                  ) : null}
                  {done ? (
                    <>
                      <Button
                        appearance="secondary"
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                      >
                        View saved records
                      </Button>
                      <Button
                        appearance="secondary"
                        icon={<Add20Regular />}
                        disabled={busy || loading || !canCreate || Boolean(blocked)}
                        onClick={() => onCreate(step)}
                      >
                        {createLabel}
                      </Button>
                      {next ? (
                        <Button
                          appearance="primary"
                          icon={<ChevronRight20Regular />}
                          iconPosition="after"
                          disabled={busy}
                          onClick={() => chooseStep(next.key)}
                        >
                          Continue
                        </Button>
                      ) : (
                        <Button appearance="primary" onClick={() => onOpenChange(false)}>
                          Finish setup
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      appearance="primary"
                      icon={<Add20Regular />}
                      disabled={busy || loading || !canCreate || Boolean(blocked)}
                      onClick={() => onCreate(step)}
                    >
                      {current.createLabel}
                    </Button>
                  )}
                </div>
              </footer>
            </main>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
