"use client";

import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Text } from "@fluentui/react-components";
import type { AdminRecord } from "@/lib/admin-api";
import styles from "./kpi-record-details.module.css";

function value(row: AdminRecord | undefined, key: string): unknown {
  return row?.[key] ?? row?.[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
}
function display(input: unknown): string {
  if (input === undefined || input === null || input === "") return "Not set";
  if (typeof input === "boolean") return input ? "Yes" : "No";
  if (typeof input === "object") return "Not set";
  const text = String(input);
  return /^[A-Z][A-Z_]+$/.test(text)
    ? text.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
    : text;
}
function Fields({ row, fields }: { row: AdminRecord | undefined; fields: [string, string][] }) {
  return <dl className={styles.fields}>{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{display(value(row, key))}</dd></div>)}</dl>;
}
function VersionDetails({ row }: { row: AdminRecord }) {
  return <div className={styles.sections}>
    {value(row, "description") ? <p className={styles.description}>{display(value(row, "description"))}</p> : null}
    <section><Text as="h3" weight="semibold">Measurement and scoring</Text><Fields row={row} fields={[["measurementUnit", "Unit"], ["measurementDirection", "What counts as improvement"], ["scoringFormula", "Scoring method"], ["defaultTargetValue", "Default target"], ["frequency", "How often"], ["dataSourceType", "Where results come from"]]} /></section>
    <section><Text as="h3" weight="semibold">Review requirements</Text><Fields row={row} fields={[["approvalAuthority", "Reviewed by"], ["manualEntryAllowed", "Manual entry allowed"], ["evidenceRequired", "Supporting evidence required"]]} /></section>
  </div>;
}
export function KpiRecordDetails({ row }: { row: AdminRecord }) {
  const raw = row.versions ?? row.Versions;
  const versions = (Array.isArray(raw) ? raw : []).filter((item): item is AdminRecord => !!item && typeof item === "object" && !Array.isArray(item));
  const currentId = value(row, "currentVersionId");
  const current = versions.find((version) => String(version.id) === String(currentId)) ?? [...versions].sort((a, b) => Number(value(b, "versionNumber") ?? 0) - Number(value(a, "versionNumber") ?? 0))[0];
  const older = versions.filter((version) => version !== current);
  return <div className={styles.sections}>
    <section><Text as="h3" weight="semibold">KPI overview</Text><Fields row={row} fields={[["code", "Code"], ["category", "Category"], ["status", "Status"]]} /></section>
    {current ? <section className={styles.current}><Text as="h3" weight="semibold">Current settings · Version {display(value(current, "versionNumber"))}</Text><VersionDetails row={current} /></section> : <Text>No measurement settings are available yet.</Text>}
    <section><Text as="h3" weight="semibold">Version history</Text><p className={styles.description}>Each version saves the KPI’s measurement and scoring rules. Existing reviews keep the version they were created with.</p>
      {older.length ? <Accordion collapsible multiple>{older.map((version, index) => <AccordionItem key={String(version.id ?? index)} value={String(version.id ?? index)}><AccordionHeader>Version {display(value(version, "versionNumber"))}</AccordionHeader><AccordionPanel><VersionDetails row={version} /></AccordionPanel></AccordionItem>)}</Accordion> : <Text>No earlier versions.</Text>}
    </section>
  </div>;
}
