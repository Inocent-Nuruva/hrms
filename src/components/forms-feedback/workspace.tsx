"use client";
import * as React from "react";
import {
  Badge,
  Text,
  Card,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowLeft24Regular,
  Dismiss24Regular,
  DocumentBulletList24Regular,
  ArrowDownload24Regular,
} from "@fluentui/react-icons";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { hasPermission } from "@/lib/dashboard-permissions";
import {
  formsRequest,
  identityNotice,
  type FeedbackForm,
  type FeedbackRound,
  type Page,
  type Results,
} from "@/lib/forms-feedback";
import { FormBuilder } from "./builder";
import { QuestionFields } from "./question-fields";
const date = (value: string) => new Date(value).toLocaleString();

function audienceLabel(form: FeedbackForm) {
  const audience = form.definition.audience;
  if (!audience || audience.type === "all") return "All employees";
  const count = audience.ids?.length ?? 0;
  const unit = audience.type === "branches" ? "branch" : "department";
  return `${count} ${count === 1 ? unit : `${unit}s`}`;
}

function scheduleLabel(form: FeedbackForm) {
  const frequency = form.definition.schedule?.frequency ?? "once";
  if (frequency === "once") return "Once";
  return `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}`;
}

export function FormsFeedbackWorkspace() {
  const actor = useDashboardActor();
  const manage = hasPermission(actor.permissionLabels, "forms_feedback:manage");
  const [area, setArea] = React.useState("mine");
  const [filter, setFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [forms, setForms] = React.useState<FeedbackForm[]>([]);
  const [rounds, setRounds] = React.useState<FeedbackRound[]>([]);
  const [selectedForm, setSelectedForm] = React.useState<FeedbackForm | null>(
    null,
  );
  const [builder, setBuilder] = React.useState<FeedbackForm | "new" | null>(
    null,
  );
  const [selected, setSelected] = React.useState<FeedbackRound | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [confirmed, setConfirmed] = React.useState(false);
  const [results, setResults] = React.useState<Results | null>(null);
  const [resultsTab, setResultsTab] = React.useState("summary");
  const [resultsPage, setResultsPage] = React.useState(1);
  const [pendingClose, setPendingClose] = React.useState<FeedbackForm | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const listPageSize = manage ? 10 : 20;
  React.useEffect(() => {
    if (!actor.ready || builder || selected || results) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const path =
          area === "manage" && manage
            ? `hr/forms-feedback${selectedForm ? `/${selectedForm.id}/rounds` : ""}`
            : "employee/forms-feedback";
        const response = await formsRequest<Page<FeedbackForm | FeedbackRound>>(
          `${path}?page=${page}&limit=${listPageSize}&status=${filter}`,
        );
        if (!active) return;
        setTotal(response.total);
        if (area === "manage" && !selectedForm) {
          const formRows = response.rows as FeedbackForm[];
          const enrichedForms = await Promise.all(
            formRows.map(async (form) => {
              if (typeof form.submittedCount === "number") return form;
              const roundPage = await formsRequest<Page<FeedbackRound>>(
                `hr/forms-feedback/${form.id}/rounds?page=1&limit=100&status=all`,
              );
              return {
                ...form,
                submittedCount: roundPage.rows.reduce(
                  (sum, round) =>
                    sum +
                    (typeof round.submitted === "number"
                      ? round.submitted
                      : round.submitted
                        ? 1
                        : 0),
                  0,
                ),
              };
            }),
          );
          if (active) setForms(enrichedForms);
        } else setRounds(response.rows as FeedbackRound[]);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load forms");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    actor.ready,
    area,
    filter,
    listPageSize,
    manage,
    selectedForm,
    page,
    builder,
    selected,
    results,
    revision,
  ]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  async function openResults(roundId: string, nextPage = 1) {
    await run(async () => {
      const data = await formsRequest<Results>(
        `hr/forms-feedback/rounds/${roundId}/results?page=${nextPage}&limit=20`,
      );
      setResults(data);
      setResultsPage(nextPage);
    });
  }
  async function exportResults() {
    if (!results || results.withheld) return;
    await run(async () => {
      const all: Results["rows"] = [];
      for (let p = 1; ; p++) {
        const data = await formsRequest<Results>(
          `hr/forms-feedback/rounds/${results.round.id}/results?page=${p}&limit=100`,
        );
        if (data.withheld) throw new Error("Results are not available");
        all.push(...data.rows);
        if (all.length >= data.total || !data.rows.length) break;
      }
      const csv = (v: unknown) => {
        let value = Array.isArray(v) ? v.join("; ") : String(v ?? "");
        if (/^[=+@\-\t\r]/.test(value)) value = `'${value}`;
        return `"${value.replaceAll('"', '""')}"`;
      };
      const identified = results.round.definition.responseMode === "identified";
      const rows = [
        [
          ...(identified ? ["Employee", "Employee no."] : []),
          ...results.round.definition.questions.map((q) => q.label),
        ],
        ...all.map((r) => [
          ...(identified
            ? [r.employee?.name ?? "", r.employee?.employeeNo ?? ""]
            : []),
          ...results.round.definition.questions.map((q) => r.answers[q.id]),
        ]),
      ];
      const url = URL.createObjectURL(
        new Blob([rows.map((row) => row.map(csv).join(",")).join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "form-results.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
  }
  if (!actor.ready) return <Spinner label="Loading forms…" />;
  return (
    <main className="-mx-3 min-h-full w-[calc(100%+1.5rem)] bg-slate-50/60 sm:-mx-4 sm:w-[calc(100%+2rem)]">
      <div className="flex w-full flex-col">
        <div className="relative overflow-hidden border-y border-border bg-primary shadow-sm">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-r from-primary via-primary to-primary/90"
          >
            <div className="finance-hero-drift absolute -right-16 -top-24 size-80 rounded-full border-[42px] border-primary-foreground/[0.12]" />
            <div className="finance-hero-orbit absolute right-16 top-[calc(50%-4.5rem)] size-36 rounded-full border border-primary-foreground/15" />
            <div className="finance-hero-band absolute bottom-0 right-28 h-32 w-56 bg-primary-foreground/[0.08]" />
            <div className="finance-hero-line absolute left-[46%] top-5 h-24 w-px bg-primary-foreground/15" />
            <div className="finance-hero-dot absolute left-[49%] top-9 size-2 rounded-full bg-primary-foreground/25" />
            <div className="finance-hero-dot finance-hero-dot-delayed absolute left-[51%] top-16 size-1.5 rounded-full bg-primary-foreground/20" />
          </div>
          <header className="relative flex min-h-28 flex-wrap items-center justify-between gap-5 px-5 py-5 text-primary-foreground sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <DocumentBulletList24Regular className="size-9 shrink-0 text-primary-foreground/90" />
              <h1 className="text-xl font-semibold tracking-tight text-primary-foreground sm:text-2xl">
                Forms &amp; Feedback
              </h1>
            </div>
            {manage && !builder ? (
              <Button
                appearance="outline"
                aria-label="Create form"
                className="!border-white/40 !bg-white/10 !text-white shadow-none backdrop-blur-sm hover:!border-white/60 hover:!bg-white/20 hover:!text-white"
                icon={<Add24Regular />}
                onClick={() => {
                  setBuilder("new");
                  setSelected(null);
                  setResults(null);
                }}
              >
                Create campaign
              </Button>
            ) : null}
          </header>
        </div>
        <Dialog
          open={pendingClose !== null}
          onOpenChange={(_, data) => {
            if (!data.open && !busy) setPendingClose(null);
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Close form?</DialogTitle>
              <DialogContent>
                <Text as="p" className="block">
                  Close {pendingClose?.definition.title} and all its open
                  rounds? Employees will no longer be able to submit responses.
                  Existing results will remain available.
                </Text>
                {error && (
                  <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                )}
              </DialogContent>
              <DialogActions>
                <Button disabled={busy} onClick={() => setPendingClose(null)}>
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  disabled={busy}
                  onClick={() => {
                    if (!pendingClose) return;
                    void run(async () => {
                      await formsRequest(
                        `hr/forms-feedback/${pendingClose.id}/close`,
                        "POST",
                      );
                      setPendingClose(null);
                      setRevision((value) => value + 1);
                    });
                  }}
                >
                  {busy ? "Closing…" : "Close form"}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
        <Dialog
          open={builder !== null}
          onOpenChange={(_, data) => {
            if (!data.open) setBuilder(null);
          }}
        >
          <DialogSurface data-size="wide" className="!max-h-[92dvh] !p-0">
            <DialogBody className="!gap-0 overflow-hidden">
              <DialogTitle
                className="border-b border-border px-5 py-4"
                action={
                  <Button
                    appearance="subtle"
                    aria-label="Close campaign wizard"
                    icon={<Dismiss24Regular />}
                    onClick={() => setBuilder(null)}
                  />
                }
              >
                {builder === "new"
                  ? "Create campaign"
                  : "Edit campaign schedule"}
              </DialogTitle>
              <DialogContent className="!max-h-[calc(92dvh-4.25rem)] overflow-y-auto !px-5 !py-4 sm:!px-6">
                {builder ? (
                  <FormBuilder
                    initial={builder === "new" ? undefined : builder}
                    onDone={() => {
                      setBuilder(null);
                      setArea("manage");
                      setRevision((r) => r + 1);
                      setNotice(
                        "Form saved. Scheduled forms open automatically at the selected time.",
                      );
                    }}
                  />
                ) : null}
              </DialogContent>
            </DialogBody>
          </DialogSurface>
        </Dialog>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        {notice && (
          <MessageBar intent="success">
            <MessageBarBody>{notice}</MessageBarBody>
          </MessageBar>
        )}
        {selected ? (
          <form
            className="flex max-w-3xl flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await formsRequest(
                  `employee/forms-feedback/${selected.id}/submit`,
                  "POST",
                  { answers },
                );
                setSelected(null);
                setAnswers({});
                setConfirmed(false);
                setNotice("Thank you. Your response has been submitted.");
                setRevision((r) => r + 1);
              });
            }}
          >
            <Button
              appearance="subtle"
              icon={<ArrowLeft24Regular />}
              onClick={() => setSelected(null)}
            >
              Back to forms
            </Button>
            <Text
              as="h2"
              size={500}
              weight="semibold"
              className="block text-xl font-semibold"
            >
              {selected.definition.title}
            </Text>
            <Text as="p" className="block">
              {selected.definition.description}
            </Text>
            <Badge className="self-start" appearance="tint">
              {selected.definition.responseMode}
            </Badge>
            <MessageBar>
              <MessageBarBody>
                {identityNotice(selected.definition.responseMode)}
              </MessageBarBody>
            </MessageBar>
            <Text as="p" className="block text-sm text-muted-foreground">
              Closes {date(selected.closesAt)}
            </Text>
            <QuestionFields
              disabled={busy}
              questions={selected.definition.questions}
              answers={answers}
              onChange={(id, value) =>
                setAnswers((a) => ({ ...a, [id]: value }))
              }
            />
            <Checkbox
              checked={confirmed}
              onChange={(_, d) => setConfirmed(d.checked === true)}
              label="I have reviewed my answers and understand the response identity setting."
            />
            <Button
              type="submit"
              appearance="primary"
              disabled={!confirmed || busy}
            >
              {busy ? "Submitting…" : "Submit response"}
            </Button>
          </form>
        ) : results ? (
          <section className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <Button
                icon={<ArrowLeft24Regular />}
                onClick={() => setResults(null)}
              >
                Back to rounds
              </Button>
              <Button
                icon={<ArrowDownload24Regular />}
                disabled={busy || results.withheld}
                onClick={() => void exportResults()}
              >
                Export results
              </Button>
            </div>
            <Text
              as="h2"
              size={500}
              weight="semibold"
              className="block text-xl font-semibold"
            >
              {results.round.definition.title}
            </Text>
            <Text as="p" className="block">
              {results.total} submissions · {results.eligible} eligible ·{" "}
              {results.eligible
                ? Math.round((results.total / results.eligible) * 100)
                : 0}
              % participation
            </Text>
            <Badge className="self-start" appearance="tint">
              {results.round.definition.responseMode}
            </Badge>
            {results.withheld ? (
              <MessageBar>
                <MessageBarBody>
                  Anonymous answers are available after this round closes and at
                  least five employees respond.
                </MessageBarBody>
              </MessageBar>
            ) : (
              <>
                <TabList
                  selectedValue={resultsTab}
                  onTabSelect={(_, d) => setResultsTab(String(d.value))}
                >
                  <Tab value="summary">Summary</Tab>
                  <Tab value="responses">Responses</Tab>
                </TabList>
                {resultsTab === "summary" ? (
                  <>
                    <Text
                      as="h3"
                      size={400}
                      weight="semibold"
                      className="block font-semibold"
                    >
                      Summary
                    </Text>
                    <div className="grid gap-4 md:grid-cols-2">
                      {results.round.definition.questions
                        .filter((q) =>
                          [
                            "single_choice",
                            "multiple_choice",
                            "yes_no",
                            "rating",
                          ].includes(q.type),
                        )
                        .map((q) => (
                          <section
                            key={q.id}
                            className="flex flex-col gap-2 border-b border-border pb-4"
                          >
                            <Text
                              as="h4"
                              size={300}
                              weight="semibold"
                              className="font-medium"
                            >
                              {q.label}
                            </Text>
                            {results.summary
                              .filter((s) => s.question === q.id)
                              .map((s, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span>
                                      {Array.isArray(s.answer)
                                        ? s.answer.join(", ")
                                        : String(s.answer)}
                                    </span>
                                    <Badge appearance="tint">{s.count}</Badge>
                                  </div>
                                  <ProgressBar
                                    aria-label={`${q.label}: ${String(s.answer)}`}
                                    value={
                                      results.total
                                        ? Number(s.count) / results.total
                                        : 0
                                    }
                                  />
                                </div>
                              ))}
                          </section>
                        ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Text
                      as="h3"
                      size={400}
                      weight="semibold"
                      className="block font-semibold"
                    >
                      Responses
                    </Text>
                    {results.rows.length === 0 && (
                      <Text as="p" className="block">
                        No submissions yet.
                      </Text>
                    )}
                    {results.rows.map((r, index) => (
                      <Card
                        role="group"
                        appearance="subtle"
                        key={index}
                        className="flex flex-col gap-3 border-b border-border py-4"
                      >
                        <Text
                          as="h4"
                          size={300}
                          weight="semibold"
                          className="font-medium"
                        >
                          {r.employee
                            ? `${r.employee.name} · ${r.employee.employeeNo}`
                            : "Submission"}
                        </Text>
                        {results.round.definition.questions.map((q) => (
                          <div key={q.id}>
                            <Text
                              as="p"
                              className="block text-sm text-muted-foreground"
                            >
                              {q.label}
                            </Text>
                            <Text
                              as="p"
                              className="block whitespace-pre-wrap break-words"
                            >
                              {Array.isArray(r.answers[q.id])
                                ? (r.answers[q.id] as unknown[]).join(", ")
                                : String(r.answers[q.id] ?? "—")}
                            </Text>
                          </div>
                        ))}
                      </Card>
                    ))}
                    <div className="flex gap-3">
                      <Button
                        disabled={busy || resultsPage === 1}
                        onClick={() =>
                          void openResults(results.round.id, resultsPage - 1)
                        }
                      >
                        Previous
                      </Button>
                      <span>Page {resultsPage}</span>
                      <Button
                        disabled={busy || resultsPage * 20 >= results.total}
                        onClick={() =>
                          void openResults(results.round.id, resultsPage + 1)
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        ) : (
          <section className="w-full overflow-hidden rounded-none border-y border-slate-200 bg-white shadow-sm">
            {manage ? (
              <>
                <div className="border-b border-slate-200 px-4 pt-2 sm:px-5">
                  <TabList
                    selectedValue={area}
                    onTabSelect={(_, data) => {
                      setArea(String(data.value));
                      setFilter("all");
                      setPage(1);
                      setSelectedForm(null);
                    }}
                  >
                    <Tab value="mine">My forms</Tab>
                    <Tab value="manage">Manage forms</Tab>
                  </TabList>
                </div>
                {area === "manage" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 sm:px-5">
                    <h2 className="font-semibold text-slate-950">Campaigns</h2>
                    {!selectedForm ? (
                      <TabList
                        size="small"
                        selectedValue={filter}
                        onTabSelect={(_, d) => {
                          setFilter(String(d.value));
                          setPage(1);
                        }}
                      >
                        {[
                          "all",
                          "draft",
                          "scheduled",
                          "open",
                          "closed",
                          "paused",
                        ].map((value) => (
                          <Tab key={value} value={value}>
                            {value.charAt(0).toUpperCase() + value.slice(1)}
                          </Tab>
                        ))}
                      </TabList>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="border-b border-slate-200 px-4 pt-2 sm:px-5">
                <TabList selectedValue="mine">
                  <Tab value="mine">My forms</Tab>
                </TabList>
              </div>
            )}
            {!manage && !selectedForm && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2 sm:px-5">
                <Text as="p" className="text-sm font-medium text-slate-600">
                  Forms assigned to you
                </Text>
                <TabList
                  size="small"
                  selectedValue={filter}
                  onTabSelect={(_, d) => {
                    setFilter(String(d.value));
                    setPage(1);
                  }}
                >
                  {["all", "pending", "submitted"].map((value) => (
                    <Tab key={value} value={value}>
                      {value === "pending"
                        ? "To complete"
                        : value.charAt(0).toUpperCase() + value.slice(1)}
                    </Tab>
                  ))}
                </TabList>
              </div>
            )}
            {selectedForm && (
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                <Button
                  icon={<ArrowLeft24Regular />}
                  onClick={() => {
                    setSelectedForm(null);
                    setPage(1);
                  }}
                >
                  All forms
                </Button>
                <Text
                  as="h2"
                  size={500}
                  weight="semibold"
                  className="block font-semibold"
                >
                  Campaign results — {selectedForm.definition.title}
                </Text>
              </div>
            )}
            {loading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Spinner label="Loading forms…" />
              </div>
            ) : area === "manage" && !selectedForm ? (
              <div className="max-w-full overflow-x-auto">
                <Table
                  aria-label="Feedback campaigns"
                  size="small"
                  className="min-w-[720px]"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Campaign</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell className="hidden lg:table-cell">
                        Audience
                      </TableHeaderCell>
                      <TableHeaderCell className="hidden xl:table-cell">
                        Schedule
                      </TableHeaderCell>
                      <TableHeaderCell>Responses</TableHeaderCell>
                      <TableHeaderCell className="sticky right-0 z-10 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                        Actions
                      </TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="py-10 text-center">
                            <p className="font-medium text-slate-800">
                              No campaigns yet
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Create your first campaign to start collecting
                              feedback.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      forms.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell>
                            <div className="min-w-32 max-w-56 py-1">
                              <p className="truncate font-medium text-slate-900">
                                {form.definition.title}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {form.definition.description ||
                                  form.definition.responseMode}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge appearance="tint">
                              {form.displayStatus ?? form.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {audienceLabel(form)}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <div>{scheduleLabel(form)}</div>
                            {form.nextOpenAt ? (
                              <div className="text-xs text-slate-500">
                                Next: {date(form.nextOpenAt)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{form.submittedCount ?? 0}</TableCell>
                          <TableCell className="sticky right-0 z-10 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                            <div className="flex min-w-max items-center gap-1">
                              <Button
                                size="small"
                                appearance={
                                  form.roundCount > 0 ? "primary" : "subtle"
                                }
                                disabled={form.roundCount === 0}
                                onClick={() => {
                                  setSelectedForm(form);
                                  setPage(1);
                                }}
                              >
                                Results
                              </Button>
                              {["draft", "paused"].includes(form.status) ? (
                                <Button
                                  size="small"
                                  onClick={() => setBuilder(form)}
                                >
                                  Edit
                                </Button>
                              ) : null}
                              {["draft", "paused", "scheduled"].includes(
                                form.status,
                              ) ? (
                                <Button
                                  size="small"
                                  disabled={busy}
                                  onClick={() =>
                                    void run(async () => {
                                      await formsRequest(
                                        `hr/forms-feedback/${form.id}/${form.status === "scheduled" ? "pause" : "publish"}`,
                                        "POST",
                                      );
                                      setRevision((r) => r + 1);
                                    })
                                  }
                                >
                                  {form.status === "scheduled"
                                    ? "Pause"
                                    : "Send"}
                                </Button>
                              ) : null}
                              {form.status !== "closed" ||
                              form.displayStatus === "open" ? (
                                <Button
                                  size="small"
                                  appearance="subtle"
                                  disabled={busy}
                                  onClick={() => {
                                    setError("");
                                    setPendingClose(form);
                                  }}
                                >
                                  Close
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid gap-3 p-4 sm:p-5">
                {rounds.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                    <Text as="p" className="block font-medium text-slate-800">
                      No campaign rounds have been sent
                    </Text>
                    <Text
                      as="p"
                      className="mt-1 block text-sm text-muted-foreground"
                    >
                      Send or schedule this campaign to start collecting
                      responses.
                    </Text>
                  </div>
                )}
                {rounds.map((round) => {
                  const closed = new Date(round.closesAt) <= new Date();
                  return (
                    <Card
                      role="group"
                      appearance="filled"
                      key={round.id}
                      orientation="horizontal"
                      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-none transition-shadow hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-2">
                        <Text
                          as="h2"
                          size={500}
                          weight="semibold"
                          className="block font-semibold"
                        >
                          {round.definition.title}
                        </Text>
                        <div className="flex gap-2">
                          <Badge appearance="tint">
                            {area === "mine" && round.submitted
                              ? "Submitted"
                              : closed
                                ? "Closed"
                                : "Open"}
                          </Badge>
                          <Badge appearance="outline">
                            {round.definition.responseMode}
                          </Badge>
                        </div>
                        <Text
                          as="p"
                          className="block text-sm text-muted-foreground"
                        >
                          Sent {date(round.opensAt)} · Closes{" "}
                          {date(round.closesAt)}
                          {typeof round.eligible === "number"
                            ? ` · ${round.eligible} recipients`
                            : ""}{" "}
                          · {round.definition.questions.length}{" "}
                          {round.definition.questions.length === 1
                            ? "question"
                            : "questions"}
                        </Text>
                      </div>
                      {area === "manage" ? (
                        <Button
                          appearance="primary"
                          disabled={busy}
                          onClick={() => void openResults(round.id)}
                        >
                          Open results summary
                        </Button>
                      ) : (
                        <Button
                          disabled={!!round.submitted || closed}
                          onClick={() => {
                            setSelected(round);
                            setAnswers({});
                            setConfirmed(false);
                            setNotice("");
                          }}
                        >
                          Complete form
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5">
              <Text as="span" className="text-sm text-slate-600">
                {total === 0
                  ? "No results"
                  : `${total} ${total === 1 ? "form" : "forms"}`}
              </Text>
              <div className="flex items-center gap-3">
                <Button
                  disabled={loading || page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  disabled={loading || page * listPageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
