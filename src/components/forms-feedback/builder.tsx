"use client";
import { FeedbackDropdown } from "./feedback-dropdown";
import { TimeInput } from "@/components/ui/time-input";
import { DateInput } from "@/components/ui/date-input";
import * as React from "react";
import {
  Badge,
  Text,
  Card,
  Divider,
  Button,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Switch,
  Tab,
  TabList,
  Textarea,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
  Delete24Regular,
} from "@fluentui/react-icons";
import {
  formsRequest,
  identityNotice,
  newDefinition,
  type FeedbackForm,
  type FormDefinition,
  type Question,
} from "@/lib/forms-feedback";
import { listBranches, listDepartments } from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { QuestionFields } from "./question-fields";
export function FormBuilder({
  initial,
  onDone,
}: {
  initial?: FeedbackForm;
  onDone: () => void;
}) {
  const [definition, setDefinition] = React.useState<FormDefinition>(
    () => initial?.definition ?? newDefinition(),
  );
  const [step, setStep] = React.useState(0);
  const [furthestStep, setFurthestStep] = React.useState(initial ? 3 : 0);
  const [library, setLibrary] = React.useState<Question[]>([]);
  const [audienceOptions, setAudienceOptions] = React.useState<
    { id: number; name: string }[]
  >([]);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<Record<string, unknown>>({});
  const [savedId, setSavedId] = React.useState(initial?.id);
  const steps = [
    {
      label: "Details & audience",
      description: "Name the campaign and choose who will receive it.",
    },
    {
      label: "Questions",
      description: "Build the questions employees will answer.",
    },
    {
      label: "Schedule",
      description: "Choose when the campaign opens, closes, and repeats.",
    },
    {
      label: "Review & send",
      description: "Check the employee experience before publishing.",
    },
  ];
  React.useEffect(() => {
    let live = true;
    formsRequest<Question[]>("hr/forms-feedback/suggestions")
      .then((rows) => {
        if (live) setLibrary(rows);
      })
      .catch(() => {
        if (live)
          setError(
            "Question suggestions could not load. You can still add questions manually.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  React.useEffect(() => {
    if (definition.audience.type === "all") return;
    let live = true;
    const token = readStoredSessionTokens().accessToken;
    const load =
      definition.audience.type === "branches" ? listBranches : listDepartments;
    load(token, { page: 1, limit: 500 })
      .then((result) => {
        if (live)
          setAudienceOptions(
            result.rows.map((r) => ({
              id: Number(r.id),
              name: String(
                r.name ?? r.branch_name ?? r.department_name ?? r.id,
              ),
            })),
          );
      })
      .catch(() => {
        if (live) setError("Could not load audience options.");
      });
    return () => {
      live = false;
    };
  }, [definition.audience.type]);
  const patch = (value: Partial<FormDefinition>) =>
    setDefinition((d) => ({ ...d, ...value }));
  const schedule = (value: Partial<FormDefinition["schedule"]>) =>
    setDefinition((d) => ({ ...d, schedule: { ...d.schedule, ...value } }));
  const editQuestion = (id: string, value: Partial<Question>) =>
    patch({
      questions: definition.questions.map((q) =>
        q.id === id ? { ...q, ...value } : q,
      ),
    });
  function addQuestion(question?: Question) {
    const id = `q_${Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16).padStart(8, "0")).join("")}`;
    setDefinition((current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          label: "",
          type: "short_text",
          required: false,
          ...question,
          id,
        },
      ],
    }));
    setError("");
  }

  function move(index: number, direction: number) {
    const questions = [...definition.questions];
    [questions[index], questions[index + direction]] = [
      questions[index + direction],
      questions[index],
    ];
    patch({ questions });
  }
  function continueToNextStep() {
    setError("");
    if (step === 0) {
      if (!definition.title.trim()) {
        setError("Enter a campaign title before continuing.");
        return;
      }
      if (
        definition.audience.type !== "all" &&
        definition.audience.ids.length === 0
      ) {
        setError("Select at least one audience before continuing.");
        return;
      }
    }
    if (step === 1) {
      if (definition.questions.length === 0) {
        setError("Add at least one question before continuing.");
        return;
      }
      if (definition.questions.some((question) => !question.label.trim())) {
        setError("Give every question a label before continuing.");
        return;
      }
    }
    const nextStep = Math.min(step + 1, steps.length - 1);
    setStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep));
  }
  async function save(publish: boolean) {
    if (publish && definition.questions.length === 0) {
      setStep(1);
      setError(
        "Add at least one question before publishing. Choose a suggestion or select Add question.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = await formsRequest<FeedbackForm>(
        `hr/forms-feedback${savedId ? `/${savedId}` : ""}`,
        savedId ? "PUT" : "POST",
        definition,
      );
      setSavedId(form.id);
      if (publish)
        await formsRequest(`hr/forms-feedback/${form.id}/publish`, "POST");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save form");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex min-h-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            {steps[step].label}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {steps[step].description}
          </p>
        </div>
        <Badge appearance="tint" color="brand">
          {Math.round(((step + 1) / steps.length) * 100)}% complete
        </Badge>
      </div>
      <TabList
        selectedValue={step}
        onTabSelect={(_, d) => setStep(Number(d.value))}
      >
        {steps.map(({ label }, i) => (
          <Tab key={label} value={i} disabled={i > furthestStep}>
            {i + 1}. {label}
          </Tab>
        ))}
      </TabList>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {step === 0 && (
        <div className="flex max-w-3xl flex-col gap-5">
          <Field label="Title" required>
            <Input
              value={definition.title}
              maxLength={200}
              onChange={(_, d) => patch({ title: d.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={definition.description}
              maxLength={2000}
              onChange={(_, d) => patch({ description: d.value })}
            />
          </Field>
          <Field label="Form type">
            <FeedbackDropdown
              value={definition.kind}
              onChange={(_, d) =>
                patch({ kind: d.value as FormDefinition["kind"] })
              }
            >
              <Option value="survey">Survey</Option>
              <Option value="poll">Poll</Option>
              <Option value="data_collection">Data collection</Option>
            </FeedbackDropdown>
          </Field>
          <Field label="Response identity" hint="Locked when published">
            <FeedbackDropdown
              disabled={!!initial?.publishedMode}
              value={definition.responseMode}
              onChange={(_, d) =>
                patch({
                  responseMode: d.value as FormDefinition["responseMode"],
                })
              }
            >
              <Option value="anonymous">Anonymous</Option>
              <Option value="identified">Identified</Option>
            </FeedbackDropdown>
          </Field>
          <MessageBar>
            <MessageBarBody>
              {identityNotice(definition.responseMode)}{" "}
              {definition.responseMode === "anonymous" &&
                "HR can view anonymous answers after closing, with at least five responses."}
            </MessageBarBody>
          </MessageBar>
          <Switch
            checked={definition.satisfaction}
            onChange={(_, d) => patch({ satisfaction: d.checked })}
            label="Include rating answers in employee satisfaction metrics"
          />
          <Field label="Audience">
            <FeedbackDropdown
              value={definition.audience.type}
              onChange={(_, d) =>
                patch({
                  audience: {
                    type: d.value as FormDefinition["audience"]["type"],
                    ids: [],
                  },
                })
              }
            >
              <Option value="all">All active employees</Option>
              <Option value="branches">Selected branches</Option>
              <Option value="departments">Selected departments</Option>
            </FeedbackDropdown>
          </Field>
          {definition.audience.type !== "all" && (
            <Field label="Select audience" required>
              <div className="flex max-h-64 flex-col overflow-auto">
                {audienceOptions.map((o) => (
                  <Checkbox
                    key={o.id}
                    label={o.name}
                    checked={definition.audience.ids.includes(o.id)}
                    onChange={(_, d) =>
                      patch({
                        audience: {
                          ...definition.audience,
                          ids: d.checked
                            ? [...definition.audience.ids, o.id]
                            : definition.audience.ids.filter(
                                (id) => id !== o.id,
                              ),
                        },
                      })
                    }
                  />
                ))}
              </div>
            </Field>
          )}
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-5">
            {definition.questions.map((q, index) => (
              <Card
                appearance="subtle"
                key={q.id}
                className="flex flex-col gap-3 border-b border-border pb-5"
              >
                <div className="flex items-center gap-2">
                  <Badge appearance="tint">{index + 1}</Badge>
                  <Button
                    appearance="subtle"
                    aria-label="Move question up"
                    icon={<ArrowUp24Regular />}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <Button
                    appearance="subtle"
                    aria-label="Move question down"
                    icon={<ArrowDown24Regular />}
                    disabled={index === definition.questions.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <Button
                    appearance="subtle"
                    aria-label="Remove question"
                    icon={<Delete24Regular />}
                    onClick={() =>
                      patch({
                        questions: definition.questions.filter(
                          (item) => item.id !== q.id,
                        ),
                      })
                    }
                  />
                </div>
                <Field label="Question" required>
                  <Input
                    value={q.label}
                    maxLength={500}
                    onChange={(_, d) => editQuestion(q.id, { label: d.value })}
                  />
                </Field>
                <Field label="Answer type">
                  <FeedbackDropdown
                    value={q.type}
                    onChange={(_, d) =>
                      editQuestion(q.id, {
                        type: d.value as Question["type"],
                        options: ["single_choice", "multiple_choice"].includes(
                          d.value,
                        )
                          ? ["Option A", "Option B"]
                          : undefined,
                      })
                    }
                  >
                    {[
                      "short_text",
                      "long_text",
                      "single_choice",
                      "multiple_choice",
                      "yes_no",
                      "rating",
                      "number",
                      "date",
                    ].map((type) => (
                      <Option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </Option>
                    ))}
                  </FeedbackDropdown>
                </Field>
                {["single_choice", "multiple_choice"].includes(q.type) && (
                  <Field label="Options — one per line">
                    <Textarea
                      value={q.options?.join("\n") ?? ""}
                      onChange={(_, d) =>
                        editQuestion(q.id, { options: d.value.split("\n") })
                      }
                    />
                  </Field>
                )}
                {q.type === "rating" && (
                  <Field label="Category">
                    <FeedbackDropdown
                      value={q.category ?? ""}
                      onChange={(_, d) =>
                        editQuestion(q.id, { category: d.value })
                      }
                    >
                      <Option value="">General</Option>
                      {[
                        "compensation",
                        "work_culture",
                        "work_life_balance",
                        "career_growth",
                        "management_support",
                      ].map((c) => (
                        <Option key={c} value={c}>
                          {c.replaceAll("_", " ")}
                        </Option>
                      ))}
                    </FeedbackDropdown>
                  </Field>
                )}
                <Switch
                  label="Required"
                  checked={q.required}
                  onChange={(_, d) =>
                    editQuestion(q.id, { required: d.checked })
                  }
                />
              </Card>
            ))}
            <Button
              icon={<Add24Regular />}
              disabled={definition.questions.length >= 50}
              onClick={() => addQuestion()}
            >
              Add question
            </Button>
          </div>
          <aside className="flex flex-col gap-3">
            <Text
              as="h3"
              size={400}
              weight="semibold"
              className="block font-semibold"
            >
              Suggested questions
            </Text>
            <Text as="p" className="block text-sm text-muted-foreground">
              Add a suggestion, then edit it to fit your form.
            </Text>
            {library.map((q) => (
              <Button
                key={q.id}
                appearance="subtle"
                disabled={definition.questions.length >= 50}
                onClick={() => addQuestion(q)}
              >
                {q.label}
              </Button>
            ))}
          </aside>
        </div>
      )}
      {step === 2 && (
        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <Field label="Repeat">
            <FeedbackDropdown
              value={definition.schedule.frequency}
              onChange={(_, d) =>
                schedule({
                  frequency: d.value as FormDefinition["schedule"]["frequency"],
                })
              }
            >
              <Option value="once">Once</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="monthly">Monthly</Option>
            </FeedbackDropdown>
          </Field>
          <Field label="Timezone">
            <Input
              value={definition.schedule.timezone}
              onChange={(_, d) => schedule({ timezone: d.value })}
            />
          </Field>
          <Field label="Start date">
            <DateInput
              value={definition.schedule.startDate}
              onValueChange={(value) => schedule({ startDate: value })}
            />
          </Field>
          <Field
            label="Opening time"
            hint="For the first opening, if today’s time has passed, the form opens on the next schedule check."
          >
            <TimeInput
              aria-label="Opening time"
              value={definition.schedule.time}
              onChange={(event) => schedule({ time: event.target.value })}
            />
          </Field>
          {definition.schedule.frequency === "monthly" && (
            <>
              <Field label="Day of month">
                <SpinButton
                  min={1}
                  max={31}
                  value={definition.schedule.dayOfMonth ?? 23}
                  displayValue={String(definition.schedule.dayOfMonth ?? 23)}
                  onChange={(_, d) =>
                    schedule({ dayOfMonth: d.value ?? Number(d.displayValue) })
                  }
                />
              </Field>
              <Switch
                label="Use last day in shorter months"
                checked={definition.schedule.useLastDay ?? false}
                onChange={(_, d) => schedule({ useLastDay: d.checked })}
              />
            </>
          )}
          <Field label="Days open">
            <SpinButton
              min={1}
              max={90}
              value={definition.schedule.openDays ?? null}
              displayValue={String(definition.schedule.openDays)}
              onChange={(_, d) =>
                schedule({ openDays: d.value ?? Number(d.displayValue) })
              }
            />
          </Field>
          <Field label="Remind every N days (optional)">
            <SpinButton
              min={1}
              max={30}
              value={definition.schedule.reminderDays ?? null}
              displayValue={String(definition.schedule.reminderDays ?? "")}
              onChange={(_, d) =>
                schedule({
                  reminderDays:
                    d.value ??
                    (d.displayValue?.trim()
                      ? Number(d.displayValue)
                      : undefined),
                })
              }
            />
          </Field>
          {definition.schedule.frequency !== "once" && (
            <>
              <Field label="End date (optional)">
                <DateInput
                  value={definition.schedule.endDate ?? ""}
                  onValueChange={(value) =>
                    schedule({ endDate: value || undefined })
                  }
                />
              </Field>
              <Field label="Maximum rounds (optional)">
                <SpinButton
                  min={1}
                  max={120}
                  value={definition.schedule.occurrences ?? null}
                  displayValue={String(definition.schedule.occurrences ?? "")}
                  onChange={(_, d) =>
                    schedule({
                      occurrences:
                        d.value ??
                        (d.displayValue?.trim()
                          ? Number(d.displayValue)
                          : undefined),
                    })
                  }
                />
              </Field>
            </>
          )}
          <Button
            onClick={() => {
              const now = new Date();
              now.setMinutes(now.getMinutes() + 1);
              const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: definition.schedule.timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).formatToParts(now);
              const p = (key: string) =>
                parts.find((x) => x.type === key)?.value;
              schedule({
                frequency: "once",
                startDate: `${p("year")}-${p("month")}-${p("day")}`,
                time: `${p("hour")}:${p("minute")}`,
              });
            }}
          >
            Set to open in one minute
          </Button>
        </div>
      )}
      {step === 3 && (
        <div className="flex max-w-3xl flex-col gap-5">
          <Text
            as="h3"
            size={400}
            weight="semibold"
            className="block text-xl font-semibold"
          >
            {definition.title || "Untitled form"}
          </Text>
          <Text as="p" className="block">
            {definition.description}
          </Text>
          <Badge className="self-start" appearance="tint">
            {definition.responseMode}
          </Badge>
          <MessageBar>
            <MessageBarBody>
              {identityNotice(definition.responseMode)}
            </MessageBarBody>
          </MessageBar>
          <QuestionFields
            questions={definition.questions}
            answers={preview}
            onChange={(id, value) => setPreview((a) => ({ ...a, [id]: value }))}
          />
        </div>
      )}
      <Divider />
      <footer className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-3 border-t border-border bg-background px-5 py-4 sm:-mx-6 sm:px-6">
        <Button
          disabled={busy || step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        <Button disabled={busy} onClick={() => void save(false)}>
          Save draft
        </Button>
        {step < 3 ? (
          <Button appearance="primary" onClick={continueToNextStep}>
            Continue
          </Button>
        ) : (
          <Button
            appearance="primary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            {busy ? "Saving…" : "Send / schedule campaign"}
          </Button>
        )}
      </footer>
    </section>
  );
}
