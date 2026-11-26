"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@fluentui/react-components";
import { ArrowUpRight20Regular, ChartMultiple24Regular, CheckmarkCircle16Regular, ClipboardTask20Regular } from "@fluentui/react-icons";
import type { Scorecard } from "@/lib/scorecard-api";
import { KpiStatusBadge } from "./kpi-page-elements";
import { scorecardDisplay, type ScorecardCollectionView } from "./scorecard-collection-model";
import styles from "./scorecard-collection.module.css";

const SEGMENTS = Array.from({ length: 40 }, (_, index) => index);

function ScoreRing({ progress }: { progress: number }) {
  return <span className={`relative grid size-[52px] shrink-0 place-items-center ${styles.ring}`} aria-hidden="true">
    <svg viewBox="0 0 80 80" className="absolute inset-0 size-full">
      {SEGMENTS.map((index) => <line
        key={index}
        x1="40" y1="3" x2="40" y2="11"
        transform={`rotate(${index * 9} 40 40)`}
        className={index < Math.round(progress / 100 * SEGMENTS.length) ? styles.ringActive : styles.ringInactive}
        strokeWidth="2.6" strokeLinecap="round"
      />)}
    </svg>
    <ChartMultiple24Regular className="relative size-4" />
  </span>;
}

export function ScorecardPreviewCard({ scorecard }: { scorecard: Scorecard }) {
  const display = scorecardDisplay(scorecard);
  return <Link
    href={`/dashboard/me/scorecards/${scorecard.id}`}
    aria-label={`View ${display.name} scorecard`}
    data-scorecard-card
    className={styles.card}
  >
    <article className="flex h-full min-w-0 flex-col gap-2.5 p-3.5 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={styles.iconTile}><ClipboardTask20Regular aria-hidden="true" /></span>
          <span className="min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{display.periodName}</span>
        </div>
        <KpiStatusBadge status={display.status} />
      </div>

      <div className="min-w-0">
        <h3 className="break-words text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{display.name}</h3>
        {display.secondaryLabel && <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{display.secondaryLabel}</p>}
      </div>

      <div className={styles.performance} data-scorecard-performance>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-xs">{display.scoreLabel}</p><p data-scorecard-score className={`mt-0.5 ${styles.score}`}>{display.scoreText}</p></div>
          {scorecard.currentVersion.mode === "weighted" && <ScoreRing progress={display.scoreProgress} />}
        </div>
        <div className={`mt-2 ${styles.track}`} aria-hidden="true"><div data-scorecard-progress className={styles.fill} style={{ width: `${display.scoreProgress}%` }} /></div>
      </div>

      <dl className="grid grid-cols-2 gap-3 py-0.5">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{display.completenessLabel}</dt><dd className="mt-0.5 flex items-center gap-1 text-lg font-semibold leading-tight tabular-nums text-foreground">{display.completenessText}{display.isComplete && <CheckmarkCircle16Regular aria-label="Complete" className="shrink-0 text-[var(--success)]" />}</dd><div className={`mt-1.5 ${styles.track}`} aria-hidden="true"><div className={`${styles.fill} ${styles.successFill}`} style={{ width: `${display.completenessProgress}%` }} /></div></div>
        <div className="min-w-0 border-l border-border pl-3"><dt className="text-xs text-muted-foreground">KPIs included</dt><dd className="mt-0.5 text-lg font-semibold leading-tight tabular-nums text-foreground">{display.kpiCount}</dd></div>
      </dl>

      <div className={`mt-auto flex min-w-0 items-center justify-between gap-2 pt-2.5 text-xs ${styles.footer}`}>
        <span className="min-w-0 text-muted-foreground">#{String(scorecard.id).padStart(3, "0")} · V{scorecard.currentVersion.version}</span>
        <span className={`inline-flex shrink-0 items-center gap-1 font-semibold ${styles.action}`}>View scorecard <ArrowUpRight20Regular aria-hidden="true" className="size-4" /></span>
      </div>
    </article>
  </Link>;
}

export function ScorecardListRow({ scorecard }: { scorecard: Scorecard }) {
  const router = useRouter();
  const display = scorecardDisplay(scorecard);
  const href = `/dashboard/me/scorecards/${scorecard.id}`;
  return <TableRow
    data-scorecard-list-row
    tabIndex={0}
    aria-label={`Open ${display.name}`}
    className="cursor-pointer even:bg-muted/15 hover:bg-primary/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    onClick={() => router.push(href)}
    onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        router.push(href);
      }
    }}
  >
    <TableCell className="max-w-64 break-words py-4 font-semibold">
      <Link href={href} onClick={(event) => event.stopPropagation()} className={styles.tableLink}>{display.name}</Link>
      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">#{String(scorecard.id).padStart(3, "0")} · V{scorecard.currentVersion.version}</span>
    </TableCell>
    <TableCell className="max-w-72 break-words py-4">{display.periodName}</TableCell>
    <TableCell className="py-4 font-semibold tabular-nums">{display.scoreText}</TableCell>
    <TableCell className="py-4 tabular-nums">{display.completenessText}</TableCell>
    <TableCell className="py-4 tabular-nums">{display.kpiCount}</TableCell>
    <TableCell className="py-4"><KpiStatusBadge status={display.status} /></TableCell>
  </TableRow>;
}

export function ScorecardCollection({ scorecards, view, label }: { scorecards: Scorecard[]; view: ScorecardCollectionView; label: string }) {
  return <section aria-label={label} data-scorecard-collection className={styles.collection}>
    {view === "grid"
      ? <div className={styles.grid} data-scorecard-grid>{scorecards.map((scorecard) => <ScorecardPreviewCard key={scorecard.id} scorecard={scorecard} />)}</div>
      : <div className="overflow-x-auto border border-border bg-card">
        <Table aria-label={label} size="small" className="w-full min-w-[720px] text-sm">
          <TableHeader className="bg-muted/40"><TableRow>
            <TableHeaderCell>Scorecard</TableHeaderCell>
            <TableHeaderCell>Reporting period</TableHeaderCell>
            <TableHeaderCell>Approved score</TableHeaderCell>
            <TableHeaderCell>Data status</TableHeaderCell>
            <TableHeaderCell>KPIs</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow></TableHeader>
          <TableBody>{scorecards.map((scorecard) => <ScorecardListRow key={scorecard.id} scorecard={scorecard} />)}</TableBody>
        </Table>
      </div>}
  </section>;
}
