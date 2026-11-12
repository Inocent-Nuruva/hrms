"use client";

import { tokens } from "@fluentui/react-components";

export type PerformanceIllustrationKind = "setup" | "review" | "approved" | "history";

/** Decorative SVG drawn from Fluent theme tokens; the adjacent text carries its meaning. */
export function PersonalPerformanceIllustration({ kind, className }: { kind: PerformanceIllustrationKind; className?: string }) {
  const ink = tokens.colorBrandForeground1;
  const quiet = tokens.colorNeutralForeground3;
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 176 144" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="88" cy="72" r="67" fill={tokens.colorBrandBackground2} opacity="0.68" />
    <circle cx="27" cy="33" r="5" fill={tokens.colorBrandForeground2} opacity="0.35" />
    <circle cx="151" cy="112" r="4" fill={tokens.colorBrandForeground2} opacity="0.35" />
    <rect x="48" y="22" width="81" height="101" rx="11" fill={tokens.colorNeutralBackground1} stroke={tokens.colorNeutralStroke2} strokeWidth="2" />
    <rect x="69" y="17" width="39" height="13" rx="6" fill={tokens.colorNeutralBackground2} stroke={tokens.colorNeutralStroke2} strokeWidth="2" />
    <path d="M65 51h46M65 64h37M65 77h42" stroke={quiet} strokeWidth="3" strokeLinecap="round" opacity="0.65" />
    {kind === "setup" && <><circle cx="108" cy="99" r="20" fill={tokens.colorNeutralBackground1} stroke={ink} strokeWidth="3" /><path d="M108 89v11l7 5" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}
    {kind === "review" && <><circle cx="108" cy="99" r="20" fill={tokens.colorNeutralBackground1} stroke={ink} strokeWidth="3" /><path d="M98 99h20m-8-8 8 8-8 8" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}
    {kind === "approved" && <><circle cx="108" cy="99" r="20" fill={tokens.colorNeutralBackground1} stroke={tokens.colorPaletteGreenForeground1} strokeWidth="3" /><path d="m98 99 7 7 13-15" stroke={tokens.colorPaletteGreenForeground1} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}
    {kind === "history" && <><circle cx="108" cy="99" r="20" fill={tokens.colorNeutralBackground1} stroke={ink} strokeWidth="3" /><path d="M108 88v12l-8 5M92 92l-3-5-5 4" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}
  </svg>;
}
