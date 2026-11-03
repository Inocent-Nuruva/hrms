"use client"
import * as React from "react"
import {
  Badge,
  Button,
  Checkbox,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Tab,
  TabList,
} from "@fluentui/react-components"
import {
  Add24Regular,
  ArrowLeft24Regular,
  DocumentBulletList24Regular,
  ArrowDownload24Regular,
} from "@fluentui/react-icons"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { hasPermission } from "@/lib/dashboard-permissions"
import {
  formsRequest,
  identityNotice,
  type FeedbackForm,
  type FeedbackRound,
  type Page,
  type Results,
} from "@/lib/forms-feedback"
import { FormBuilder } from "./builder"
import { QuestionFields } from "./question-fields"
const date = (value: string) => new Date(value).toLocaleString()
export function FormsFeedbackWorkspace() {
  const actor = useDashboardActor()
  const manage = hasPermission(actor.permissionLabels, "forms_feedback:manage")
  const [area, setArea] = React.useState("mine")
  const [filter, setFilter] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [forms, setForms] = React.useState<FeedbackForm[]>([])
  const [rounds, setRounds] = React.useState<FeedbackRound[]>([])
  const [selectedForm, setSelectedForm] = React.useState<FeedbackForm | null>(
    null,
  )
  const [builder, setBuilder] = React.useState<FeedbackForm | "new" | null>(
    null,
  )
  const [selected, setSelected] = React.useState<FeedbackRound | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({})
  const [confirmed, setConfirmed] = React.useState(false)
  const [results, setResults] = React.useState<Results | null>(null)
  const [resultsTab, setResultsTab] = React.useState("summary")
  const [resultsPage, setResultsPage] = React.useState(1)
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    if (!actor.ready || builder || selected || results) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const path =
          area === "manage" && manage
            ? `hr/forms-feedback${selectedForm ? `/${selectedForm.id}/rounds` : ""}`
            : "employee/forms-feedback"
        const response = await formsRequest<Page<FeedbackForm | FeedbackRound>>(
          `${path}?page=${page}&limit=20&status=${filter}`,
        )
        if (!active) return
        setTotal(response.total)
        if (area === "manage" && !selectedForm)
          setForms(response.rows as FeedbackForm[])
        else setRounds(response.rows as FeedbackRound[])
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load forms")
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [
    actor.ready,
    area,
    filter,
    manage,
    selectedForm,
    page,
    builder,
    selected,
    results,
    revision,
  ])
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }
  async function openResults(roundId: string, nextPage = 1) {
    await run(async () => {
      const data = await formsRequest<Results>(
        `hr/forms-feedback/rounds/${roundId}/results?page=${nextPage}&limit=20`,
      )
      setResults(data)
      setResultsPage(nextPage)
    })
  }
  async function exportResults() {
    if (!results || results.withheld) return
    await run(async () => {
      const all: Results["rows"] = []
      for (let p = 1; ; p++) {
        const data = await formsRequest<Results>(
          `hr/forms-feedback/rounds/${results.round.id}/results?page=${p}&limit=100`,
        )
        if (data.withheld) throw new Error("Results are not available")
        all.push(...data.rows)
        if (all.length >= data.total || !data.rows.length) break
      }
      const csv = (v: unknown) => {
        let value = Array.isArray(v) ? v.join("; ") : String(v ?? "")
        if (/^[=+@\-\t\r]/.test(value)) value = `'${value}`
        return `"${value.replaceAll('"', '""')}"`
      }
      const identified = results.round.definition.responseMode === "identified"
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
      ]
      const url = URL.createObjectURL(
        new Blob([rows.map((row) => row.map(csv).join(",")).join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
      )
      const link = document.createElement("a")
      link.href = url
      link.download = "form-results.csv"
      link.click()
      URL.revokeObjectURL(url)
    })
  }
  if (!actor.ready) return <Spinner label="Loading forms…" />
  return (
    <main className="flex flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DocumentBulletList24Regular className="text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Forms &amp; Feedback</h1>
            <p className="text-sm text-muted-foreground">
              Share feedback, answer polls and collect information.
            </p>
          </div>
        </div>
        {manage && !builder && (
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={() => {
              setBuilder("new")
              setSelected(null)
              setResults(null)
            }}
          >
            Create form
          </Button>
        )}
      </header>
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
      {builder ? (
        <FormBuilder
          initial={builder === "new" ? undefined : builder}
          onCancel={() => setBuilder(null)}
          onDone={() => {
            setBuilder(null)
            setArea("manage")
            setRevision((r) => r + 1)
            setNotice(
              "Form saved. Scheduled forms open automatically at the selected time.",
            )
          }}
        />
      ) : selected ? (
        <form
          className="flex max-w-3xl flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await formsRequest(
                `employee/forms-feedback/${selected.id}/submit`,
                "POST",
                { answers },
              )
              setSelected(null)
              setAnswers({})
              setConfirmed(false)
              setNotice("Thank you. Your response has been submitted.")
              setRevision((r) => r + 1)
            })
          }}
        >
          <Button
            appearance="subtle"
            icon={<ArrowLeft24Regular />}
            onClick={() => setSelected(null)}
          >
            Back to forms
          </Button>
          <h2 className="text-xl font-semibold">{selected.definition.title}</h2>
          <p>{selected.definition.description}</p>
          <Badge className="self-start" appearance="tint">
            {selected.definition.responseMode}
          </Badge>
          <MessageBar>
            <MessageBarBody>
              {identityNotice(selected.definition.responseMode)}
            </MessageBarBody>
          </MessageBar>
          <p className="text-sm text-muted-foreground">
            Closes {date(selected.closesAt)}
          </p>
          <QuestionFields
            disabled={busy}
            questions={selected.definition.questions}
            answers={answers}
            onChange={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
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
          <h2 className="text-xl font-semibold">
            {results.round.definition.title}
          </h2>
          <p>
            {results.total} submissions · {results.eligible} eligible ·{" "}
            {results.eligible
              ? Math.round((results.total / results.eligible) * 100)
              : 0}
            % participation
          </p>
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
                  <h3 className="font-semibold">Summary</h3>
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
                          <h4 className="font-medium">{q.label}</h4>
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
                  <h3 className="font-semibold">Responses</h3>
                  {results.rows.length === 0 && <p>No submissions yet.</p>}
                  {results.rows.map((r, index) => (
                    <article
                      key={index}
                      className="flex flex-col gap-3 border-b border-border py-4"
                    >
                      <h4 className="font-medium">
                        {r.employee
                          ? `${r.employee.name} · ${r.employee.employeeNo}`
                          : "Submission"}
                      </h4>
                      {results.round.definition.questions.map((q) => (
                        <div key={q.id}>
                          <p className="text-sm text-muted-foreground">
                            {q.label}
                          </p>
                          <p className="whitespace-pre-wrap break-words">
                            {Array.isArray(r.answers[q.id])
                              ? (r.answers[q.id] as unknown[]).join(", ")
                              : String(r.answers[q.id] ?? "—")}
                          </p>
                        </div>
                      ))}
                    </article>
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
        <>
          <TabList
            selectedValue={area}
            onTabSelect={(_, d) => {
              setArea(String(d.value))
              setFilter("all")
              setPage(1)
              setSelectedForm(null)
              setNotice("")
            }}
          >
            <Tab value="mine">My forms</Tab>
            {manage && <Tab value="manage">Manage forms</Tab>}
          </TabList>
          {!selectedForm && (
            <TabList
              selectedValue={filter}
              onTabSelect={(_, d) => {
                setFilter(String(d.value))
                setPage(1)
              }}
            >
              {(area === "manage"
                ? ["all", "draft", "scheduled", "open", "closed", "paused"]
                : ["all", "pending", "submitted"]
              ).map((value) => (
                <Tab key={value} value={value}>
                  {value === "pending"
                    ? "To complete"
                    : value.charAt(0).toUpperCase() + value.slice(1)}
                </Tab>
              ))}
            </TabList>
          )}
          {selectedForm && (
            <div className="flex items-center gap-3">
              <Button
                icon={<ArrowLeft24Regular />}
                onClick={() => {
                  setSelectedForm(null)
                  setPage(1)
                }}
              >
                All forms
              </Button>
              <h2 className="font-semibold">
                {selectedForm.definition.title} — rounds
              </h2>
            </div>
          )}
          {loading ? (
            <Spinner label="Loading forms…" />
          ) : area === "manage" && !selectedForm ? (
            <div className="flex flex-col">
              {forms.length === 0 && (
                <p className="py-8 text-muted-foreground">
                  No forms yet. Create a form to get started.
                </p>
              )}
              {forms.map((form) => (
                <article
                  key={form.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="font-semibold">{form.definition.title}</h2>
                    <div className="flex gap-2">
                      <Badge appearance="tint">
                        {form.displayStatus ?? form.status}
                      </Badge>
                      <Badge appearance="outline">
                        {form.definition.responseMode}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {form.roundCount} rounds ·{" "}
                      {form.definition.schedule.frequency}
                      {form.nextOpenAt
                        ? ` · Opens ${date(form.nextOpenAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        setSelectedForm(form)
                        setPage(1)
                      }}
                    >
                      View rounds
                    </Button>
                    {["draft", "paused"].includes(form.status) && (
                      <Button onClick={() => setBuilder(form)}>Edit</Button>
                    )}
                    {["draft", "paused", "scheduled"].includes(form.status) && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await formsRequest(
                              `hr/forms-feedback/${form.id}/${form.status === "scheduled" ? "pause" : "publish"}`,
                              "POST",
                            )
                            setRevision((r) => r + 1)
                          })
                        }
                      >
                        {form.status === "scheduled"
                          ? "Pause schedule"
                          : "Schedule"}
                      </Button>
                    )}
                    {(form.status !== "closed" ||
                      form.displayStatus === "open") && (
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Close this form and any open rounds?",
                            )
                          )
                            void run(async () => {
                              await formsRequest(
                                `hr/forms-feedback/${form.id}/close`,
                                "POST",
                              )
                              setRevision((r) => r + 1)
                            })
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {rounds.length === 0 && (
                <p className="py-8 text-muted-foreground">
                  No forms available yet.
                </p>
              )}
              {rounds.map((round) => {
                const closed = new Date(round.closesAt) <= new Date()
                return (
                  <article
                    key={round.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4"
                  >
                    <div className="flex flex-col gap-2">
                      <h2 className="font-semibold">
                        {round.definition.title}
                      </h2>
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
                      <p className="text-sm text-muted-foreground">
                        Closes {date(round.closesAt)} ·{" "}
                        {round.definition.questions.length} questions
                      </p>
                    </div>
                    {area === "manage" ? (
                      <Button
                        disabled={busy}
                        onClick={() => void openResults(round.id)}
                      >
                        View results
                      </Button>
                    ) : (
                      <Button
                        disabled={!!round.submitted || closed}
                        onClick={() => {
                          setSelected(round)
                          setAnswers({})
                          setConfirmed(false)
                          setNotice("")
                        }}
                      >
                        Complete form
                      </Button>
                    )}
                  </article>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button
              disabled={loading || page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} · {total} total
            </span>
            <Button
              disabled={loading || page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
