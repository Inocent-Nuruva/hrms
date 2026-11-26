"use client";

import * as React from "react";
import { Button, Dropdown, Input, Option, Popover, PopoverSurface, PopoverTrigger, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Tab, TabList } from "@fluentui/react-components";
import { Calendar20Regular, CalendarLtr20Regular, ChevronLeft20Regular, ChevronRight20Regular, Grid20Regular, TableSimple20Regular } from "@fluentui/react-icons";
import { FluentSearchBox } from "@/components/common/fluent-search-box";
import { kpiApi, type KpiPeriod } from "@/lib/kpi-api";
import { KpiLoading } from "./kpi-page-elements";
import { monthEndPosition, monthNumber, monthPosition, monthStart, periodDate, periodDateLabel, periodDateRange, periodDayCount } from "./reporting-period-dates";
import styles from "./reporting-periods-workspace.module.css";

type PeriodView = "table" | "cards" | "timeline";
const VIEW_KEY = "hrms.kpi.reporting-periods.view";
const MONTH_WIDTH = 156;

function frequencyLabel(frequency: string) {
  return frequency.replace("semiannual", "Twice a year").replace("annual", "Yearly").replace(/^./, (letter) => letter.toUpperCase());
}

function PeriodTimezoneAction({ period, token, onUpdated }: { period: KpiPeriod; token: string; onUpdated: (period: KpiPeriod) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [timezone, setTimezone] = React.useState(period.timezone ?? "Africa/Dar_es_Salaam");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { if (!editing) setTimezone(period.timezone ?? "Africa/Dar_es_Salaam"); }, [period.timezone, editing]);

  async function save() {
    try { new Intl.DateTimeFormat("en", { timeZone: timezone.trim() }); }
    catch { setError("Enter a valid IANA time zone."); return; }
    setBusy(true);
    setError("");
    try {
      onUpdated(await kpiApi.setPeriodTimezone(token, period.id, timezone.trim()));
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save time zone.");
    } finally { setBusy(false); }
  }

  return <div className={styles.timezoneAction}>
    {!editing ? <>
      <span className={period.timezone ? styles.timezone : styles.unconfigured}>{period.timezone ?? "Not configured"}</span>
      <Button type="button" appearance="subtle" size="small" onClick={() => setEditing(true)} aria-label={`${period.timezone ? "Change" : "Configure"} time zone for ${period.label}`} className={styles.actionButton}>{period.timezone ? "Change" : "Configure"}</Button>
    </> : <div className={styles.timezoneEditor}>
      <Input aria-label={`Time zone for ${period.label}`} value={timezone} onChange={(_, data) => setTimezone(data.value)} />
      <div className={styles.editorActions}><Button type="button" appearance="primary" size="small" disabled={busy} onClick={() => void save()}>Save</Button><Button type="button" appearance="subtle" size="small" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>Cancel</Button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>}
  </div>;
}

function PeriodFacts({ period }: { period: KpiPeriod }) {
  const duration = periodDayCount(period.startDate, period.endDate);
  return <dl className={styles.facts}>
    <div><dt>Frequency</dt><dd>{frequencyLabel(period.frequency)}</dd></div>
    <div><dt>Start date</dt><dd>{periodDateLabel(period.startDate)}</dd></div>
    <div><dt>End date</dt><dd>{periodDateLabel(period.endDate)}</dd></div>
    <div><dt>Duration</dt><dd>{duration === null ? "Unavailable" : `${duration} days`}</dd></div>
  </dl>;
}

function PeriodTable({ periods, token, onUpdated }: { periods: KpiPeriod[]; token: string; onUpdated: (period: KpiPeriod) => void }) {
  return <div className={styles.tableWrap}><Table aria-label="Reporting periods" size="small" className={styles.table}>
    <TableHeader><TableRow><TableHeaderCell>Period name</TableHeaderCell><TableHeaderCell>Frequency</TableHeaderCell><TableHeaderCell>Date range</TableHeaderCell><TableHeaderCell>Time zone</TableHeaderCell></TableRow></TableHeader>
    <TableBody>{periods.map((period) => <TableRow key={period.id}>
      <TableCell><div className={styles.nameCell}><Calendar20Regular aria-hidden="true" /><span>{period.label}</span></div></TableCell>
      <TableCell>{frequencyLabel(period.frequency)}</TableCell>
      <TableCell><span className="whitespace-nowrap">{periodDateRange(period.startDate, period.endDate)}</span></TableCell>
      <TableCell><PeriodTimezoneAction period={period} token={token} onUpdated={onUpdated} /></TableCell>
    </TableRow>)}</TableBody>
  </Table></div>;
}

function DateEndpoint({ date, label }: { date: string; label: string }) {
  const parsed = periodDate(date);
  if (!parsed) return <span>{date}</span>;
  return <div className={styles.dateEndpoint} aria-label={`${label}: ${periodDateLabel(date)}`}>
    <span>{label}</span><strong>{parsed.getUTCDate()}</strong><small>{new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(parsed)}</small>
  </div>;
}

function PeriodCard({ period, token, onUpdated }: { period: KpiPeriod; token: string; onUpdated: (period: KpiPeriod) => void }) {
  return <article className={styles.card}>
    <div className={styles.cardTop}><Calendar20Regular aria-hidden="true" /><span>{frequencyLabel(period.frequency)}</span></div>
    <h3>{period.label}</h3>
    <div className={styles.datePanel}><DateEndpoint date={period.startDate} label="Start" /><span className={styles.connector} aria-hidden="true" /><DateEndpoint date={period.endDate} label="End" /></div>
    <div className={styles.cardFooter}><PeriodTimezoneAction period={period} token={token} onUpdated={onUpdated} /></div>
  </article>;
}

function PeriodCards({ periods, token, onUpdated }: { periods: KpiPeriod[]; token: string; onUpdated: (period: KpiPeriod) => void }) {
  return <div className={styles.cards}>{periods.map((period) => <PeriodCard key={period.id} period={period} token={token} onUpdated={onUpdated} />)}</div>;
}

function PeriodTimeline({ periods, token, onUpdated }: { periods: KpiPeriod[]; token: string; onUpdated: (period: KpiPeriod) => void }) {
  const starts = periods.map((period) => periodDate(period.startDate)).filter((date): date is Date => date !== null);
  const ends = periods.map((period) => periodDate(period.endDate)).filter((date): date is Date => date !== null);
  const firstMonth = starts.length ? Math.min(...starts.map(monthNumber)) : monthNumber(new Date());
  const lastMonth = ends.length ? Math.max(...ends.map(monthNumber)) : firstMonth;
  const [startMonth, setStartMonth] = React.useState(firstMonth);
  const [months, setMonths] = React.useState<3 | 6 | 12 | 24>(3);
  React.useEffect(() => { setStartMonth(firstMonth); }, [firstMonth]);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const todayX = monthPosition(todayUtc, startMonth) * MONTH_WIDTH;
  const todayVisible = todayX >= 0 && todayX < months * MONTH_WIDTH;
  const width = months * MONTH_WIDTH;
  const monthLabels = Array.from({ length: months }, (_, index) => monthStart(startMonth + index));
  const windowLabel = `${new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(monthLabels[0])} – ${new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(monthLabels.at(-1)!)}`;

  return <section aria-label="Reporting periods timeline" className={styles.timelineSection}>
    <div className={styles.timelineTools}>
      <div><strong>Calendar timeline</strong><p>{windowLabel}</p></div>
      <div className={styles.timelineControls}>
        <Button aria-label="Previous calendar window" icon={<ChevronLeft20Regular />} appearance="subtle" onClick={() => setStartMonth((month) => month - months)} />
        <Button aria-label="Next calendar window" icon={<ChevronRight20Regular />} appearance="subtle" onClick={() => setStartMonth((month) => month + months)} />
        <Dropdown aria-label="Timeline range" value={`${months} months`} selectedOptions={[String(months)]} onOptionSelect={(_, data) => setMonths(Number(data.optionValue) as 3 | 6 | 12 | 24)} className={styles.rangeSelect}>
          {[3, 6, 12, 24].map((value) => <Option key={value} value={String(value)} text={`${value} months`}>{value} months</Option>)}
        </Dropdown>
        <Button appearance="subtle" size="small" onClick={() => { setStartMonth(firstMonth); setMonths(lastMonth - firstMonth + 1 <= 3 ? 3 : lastMonth - firstMonth + 1 <= 6 ? 6 : lastMonth - firstMonth + 1 <= 12 ? 12 : 24); }}>{lastMonth - firstMonth + 1 > 24 ? "Start of periods" : "Fit periods"}</Button>
      </div>
    </div>
    <div className={styles.timelineScroll}>
      <div className={styles.timelineBody} style={{ width: `calc(15rem + ${width}px)` }}>
        <div className={styles.timelineRow}>
          <div className={styles.stickyName}>Reporting period</div>
          <div className={styles.timelineTrack} style={{ width }}>
            {monthLabels.map((month, index) => <div key={month.toISOString()} className={styles.monthHeader} style={{ left: index * MONTH_WIDTH, width: MONTH_WIDTH }}><strong>{new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(month)}</strong><span>1</span><span>15</span></div>)}
            {todayVisible && <span className={styles.todayMarker} style={{ left: todayX }} title={`Today: ${periodDateLabel(todayUtc.toISOString().slice(0, 10))}`} />}
          </div>
        </div>
        {periods.map((period) => {
          const start = periodDate(period.startDate);
          const end = periodDate(period.endDate);
          const left = start ? Math.max(0, monthPosition(start, startMonth) * MONTH_WIDTH) : 0;
          const right = end ? Math.min(width, monthEndPosition(end, startMonth) * MONTH_WIDTH) : 0;
          const visible = !!start && !!end && right > left;
          return <div className={styles.timelineRow} key={period.id}>
            <div className={styles.stickyName}><span className={styles.timelineName}>{period.label}</span><small>{periodDateRange(period.startDate, period.endDate)}</small></div>
            <div className={styles.timelineTrack} style={{ width }}>
              {monthLabels.map((month, index) => <span key={month.toISOString()} className={styles.monthGrid} style={{ left: index * MONTH_WIDTH }} aria-hidden="true" />)}
              {todayVisible && <span className={styles.todayMarker} style={{ left: todayX }} aria-hidden="true" />}
              {visible ? <Popover positioning="below-start" withArrow>
                <PopoverTrigger disableButtonEnhancement><button type="button" className={`${styles.periodBar} ${period.timezone ? "" : styles.unconfiguredBar}`} style={{ left, width: Math.max(4, right - left) }} aria-label={`${period.label}, ${periodDateRange(period.startDate, period.endDate)}, time zone ${period.timezone ?? "not configured"}. Inspect period`} title={period.label}>{right - left >= 80 && <span>{period.label}</span>}</button></PopoverTrigger>
                <PopoverSurface className={styles.periodPopover}><h3>{period.label}</h3><PeriodFacts period={period} /><PeriodTimezoneAction period={period} token={token} onUpdated={onUpdated} /></PopoverSurface>
              </Popover> : <span className={styles.outsideWindow}>Outside shown range</span>}
            </div>
          </div>;
        })}
      </div>
    </div>
    <p className={styles.timelineHint}>Bars show inclusive reporting dates. Select a bar for period details and its time zone action.{todayVisible ? " The vertical line marks today." : ""}</p>
  </section>;
}

export function ReportingPeriodsWorkspace({ periods, loading, error, token, onUpdated }: { periods: KpiPeriod[]; loading: boolean; error: string; token: string; onUpdated: (period: KpiPeriod) => void }) {
  const [view, setView] = React.useState<PeriodView>("table");
  const [search, setSearch] = React.useState("");
  const [timezoneFilter, setTimezoneFilter] = React.useState("all");
  const [frequencyFilter, setFrequencyFilter] = React.useState("all");
  React.useEffect(() => { try { const saved = window.localStorage.getItem(VIEW_KEY); if (saved === "table" || saved === "cards" || saved === "timeline") setView(saved); } catch { /* Storage may be disabled. */ } }, []);
  function changeView(next: PeriodView) { setView(next); try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* Keep the in-memory choice. */ } }
  const frequencies = [...new Set(periods.map((period) => period.frequency))].sort();
  const query = search.trim().toLocaleLowerCase();
  const filtered = periods.filter((period) =>
    (!query || period.label.toLocaleLowerCase().includes(query)) &&
    (timezoneFilter === "all" || (timezoneFilter === "configured" ? !!period.timezone : !period.timezone)) &&
    (frequencyFilter === "all" || period.frequency === frequencyFilter));

  return <section aria-label="Reporting periods" className={styles.workspace}>
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <FluentSearchBox aria-label="Search reporting periods" placeholder="Search period name" value={search} onChange={(_, data) => setSearch(data.value)} className={styles.search} />
        <Dropdown aria-label="Filter time zone configuration" value={{ all: "All time zones", configured: "Configured", unconfigured: "Not configured" }[timezoneFilter]} selectedOptions={[timezoneFilter]} onOptionSelect={(_, data) => setTimezoneFilter(data.optionValue ?? "all")} className={styles.filter}>
          <Option value="all">All time zones</Option><Option value="configured">Configured</Option><Option value="unconfigured">Not configured</Option>
        </Dropdown>
        <Dropdown aria-label="Filter frequency" value={frequencyFilter === "all" ? "All frequencies" : frequencyLabel(frequencyFilter)} selectedOptions={[frequencyFilter]} onOptionSelect={(_, data) => setFrequencyFilter(data.optionValue ?? "all")} className={styles.filter}>
          <Option value="all">All frequencies</Option>{frequencies.map((frequency) => <Option key={frequency} value={frequency}>{frequencyLabel(frequency)}</Option>)}
        </Dropdown>
      </div>
      <TabList aria-label="Reporting period view" size="small" selectedValue={view} onTabSelect={(_, data) => changeView(data.value as PeriodView)} className={styles.viewSwitcher}>
        <Tab icon={<TableSimple20Regular />} value="table">Table</Tab><Tab icon={<Grid20Regular />} value="cards">Cards</Tab><Tab icon={<CalendarLtr20Regular />} value="timeline">Timeline</Tab>
      </TabList>
    </div>
    {!loading && !error && <p className={styles.count} aria-live="polite">Showing {filtered.length} of {periods.length} reporting periods</p>}
    {loading ? <KpiLoading label="Loading reporting periods…" /> : error && periods.length === 0 ? <p role="alert" className={styles.message}>Unable to load reporting periods. {error}</p> : periods.length === 0 ? <p className={styles.message}>No reporting periods configured.</p> : filtered.length === 0 ? <p className={styles.message}>No reporting periods match your search and filters.</p> : view === "table" ? <PeriodTable periods={filtered} token={token} onUpdated={onUpdated} /> : view === "cards" ? <PeriodCards periods={filtered} token={token} onUpdated={onUpdated} /> : <PeriodTimeline periods={filtered} token={token} onUpdated={onUpdated} />}
  </section>;
}
