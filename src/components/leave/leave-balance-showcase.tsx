"use client";

import * as React from "react";
import { Tab, TabList } from "@fluentui/react-components";
import {
  Calendar20Regular,
  ChevronDown20Regular,
  Grid20Regular,
  HeartPulse20Regular,
  People20Regular,
  PersonHeart20Regular,
  TextBulletListLtr20Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import styles from "./leave-balance-showcase.module.css";

export type LeaveBalanceItem = {
  key: string;
  name: string;
  fiscalYear: string;
  entitlement: number | null;
  accrued: number | null;
  used: number | null;
  pending: number | null;
  available: number | null;
  carriedForward: number | null;
  expired: number | null;
  creditDate: string | null;
  accrualNote?: string;
  notices?: string[];
};

function formatDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function LeaveIcon({ name }: { name: string }) {
  if (/sick|medical/i.test(name)) return <HeartPulse20Regular aria-hidden="true" />;
  if (/maternity|pregnan|parent/i.test(name)) return <PersonHeart20Regular aria-hidden="true" />;
  if (/paternity|family/i.test(name)) return <People20Regular aria-hidden="true" />;
  return <Calendar20Regular aria-hidden="true" />;
}

function BalanceMetrics({ item }: { item: LeaveBalanceItem }) {
  return <dl className={styles.metrics}>
    <div><dt>Accrued</dt><dd>{formatDays(item.accrued)}</dd></div>
    <div><dt>Used</dt><dd>{formatDays(item.used)}</dd></div>
    <div><dt>Pending</dt><dd>{formatDays(item.pending)}</dd></div>
  </dl>;
}

function BalanceFootnote({ item }: { item: LeaveBalanceItem }) {
  const date = item.creditDate ? new Date(item.creditDate) : null;
  const creditText = date && !Number.isNaN(date.valueOf()) ? `Credited ${new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date)}` : null;
  if (!creditText && !item.accrualNote && !item.notices?.length) return null;
  return <div className={styles.footnotes}>
    {(item.accrualNote || creditText) && <p className={styles.footnote}><Calendar20Regular aria-hidden="true" /> {item.accrualNote ?? creditText}</p>}
    {item.notices?.map((notice) => <p key={notice} className={styles.notice}>{notice}</p>)}
  </div>;
}

function BalanceCard({ item }: { item: LeaveBalanceItem }) {
  const negative = item.available !== null && item.available < 0;
  return <article className={styles.balanceCard}>
    <div className={styles.cardHeading}><span className={styles.icon}><LeaveIcon name={item.name} /></span><h3>{item.name}</h3></div>
    <div className={`${styles.availablePanel} ${negative ? styles.negativePanel : ""}`}>
      <span>Available balance</span>
      <strong>{formatDays(item.available)}<small> days</small></strong>
      <span className={negative ? styles.negativeText : ""}>{negative ? "Negative balance" : item.entitlement === null ? "Entitlement unavailable" : `${formatDays(item.entitlement)} days entitlement`}</span>
    </div>
    <BalanceMetrics item={item} />
    <BalanceFootnote item={item} />
  </article>;
}

export function LeaveBalanceShowcase({ items, fiscalYear, title = "My leave balance", description = "Your leave entitlement, usage and availability.", ariaLabel = "My leave balances", actions, headingIcon }: { items: LeaveBalanceItem[]; fiscalYear: string; title?: string; description?: string; ariaLabel?: string; actions?: React.ReactNode; /** Compact profile-style heading (icon tile, small title), used on the employee profile. */ headingIcon?: React.ReactNode }) {
  const [view, setView] = React.useState<"summary" | "cards">("summary");
  const featured = items.find((item) => /annual|vacation/i.test(item.name)) ?? items[0];
  const others = items.filter((item) => item.key !== featured.key);
  const negative = featured.available !== null && featured.available < 0;

  return <section className={styles.showcase} aria-label={ariaLabel}>
    <div className={styles.heading}>
      {headingIcon ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{headingIcon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="!text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      ) : <div><h2>{title}</h2><p>{description}</p></div>}
      <div className={styles.headingControls}>
        <span className={styles.year}>FY {fiscalYear}</span>
        <TabList size="small" aria-label="Leave balance view" selectedValue={view} onTabSelect={(_, data) => setView(data.value as "summary" | "cards")}>
          <Tab value="summary" aria-label="Summary" title="Summary" icon={<TextBulletListLtr20Regular aria-hidden="true" />} />
          <Tab value="cards" aria-label="Cards" title="Cards" icon={<Grid20Regular aria-hidden="true" />} />
        </TabList>
        {actions}
      </div>
    </div>

    {view === "summary" ? <div className={styles.summary}>
      <article className={styles.featured}>
        <div className={styles.featuredHeading}><span className={styles.icon}><LeaveIcon name={featured.name} /></span><div><h3>{featured.name}</h3><p>{featured.entitlement === null ? "Entitlement unavailable" : `${formatDays(featured.entitlement)} days entitlement`}</p></div>{negative && <Warning20Regular className={styles.warningIcon} aria-label="Negative balance" />}</div>
        <div className={styles.featuredValue}><span>Available balance</span><strong className={negative ? styles.negativeText : ""}>{formatDays(featured.available)}<small> days</small></strong>{negative && <span className={styles.negativeText}>Negative leave balance</span>}</div>
        <dl className={styles.featuredMetrics}>
          <div><dt>Entitlement</dt><dd>{formatDays(featured.entitlement)}</dd></div>
          <div><dt>Accrued</dt><dd>{formatDays(featured.accrued)}</dd></div>
          <div><dt>Used</dt><dd>{formatDays(featured.used)}</dd></div>
          <div><dt>Pending</dt><dd>{formatDays(featured.pending)}</dd></div>
        </dl>
        <BalanceFootnote item={featured} />
      </article>
      {others.length > 0 && <div className={styles.otherBalances}>
        <div className={styles.otherHeading}><h3>Other leave balances</h3><span>{others.length} leave {others.length === 1 ? "type" : "types"}</span></div>
        {others.map((item) => <details key={item.key} className={styles.accordion}>
          <summary><span className={styles.icon}><LeaveIcon name={item.name} /></span><span className={styles.accordionName}><strong>{item.name}</strong><small>{item.entitlement === null ? "Entitlement unavailable" : `${formatDays(item.entitlement)} days entitlement`}</small></span><span className={styles.accordionValue}><strong>{formatDays(item.available)}</strong><small>Available</small></span><ChevronDown20Regular className={styles.chevron} aria-hidden="true" /></summary>
          <div className={styles.accordionContent}><BalanceMetrics item={item} /><div className={styles.extraMetrics}><span>Carried over: {formatDays(item.carriedForward)}</span><span>Expired: {formatDays(item.expired)}</span></div><BalanceFootnote item={item} /></div>
        </details>)}
      </div>}
    </div> : <div className={styles.cardGrid}>{items.map((item) => <BalanceCard key={item.key} item={item} />)}</div>}
  </section>;
}
