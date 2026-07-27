"use client";

import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type SecurityScanLoaderProps = {
  className?: string;
  label?: string;
};

/**
 * Compact security-scan animation for post-login access checks.
 */
export function SecurityScanLoader({ className, label = "Scanning access" }: SecurityScanLoaderProps) {
  return (
    <div
      className={cn("relative flex flex-col items-center gap-3", className)}
      role="img"
      aria-label={label}
    >
      <div className="security-scan relative h-[72px] w-[72px]">
        {/* Outer pulse ring */}
        <span className="security-scan__pulse absolute inset-0 rounded-2xl border border-primary/30" />
        <span className="security-scan__pulse security-scan__pulse--delayed absolute inset-[-4px] rounded-[18px] border border-primary/15" />

        {/* Frame */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 via-background to-primary/5 shadow-[inset_0_0_0_1px_rgba(48,49,148,0.08)] dark:from-primary/20 dark:via-card dark:to-primary/10">
          {/* Soft grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in srgb, var(--primary) 28%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--primary) 28%, transparent) 1px, transparent 1px)",
              backgroundSize: "10px 10px",
            }}
          />

          {/* Corner brackets */}
          <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l-2 border-t-2 border-primary/70" />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 border-r-2 border-t-2 border-primary/70" />
          <span className="absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b-2 border-l-2 border-primary/70" />
          <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-2 border-r-2 border-primary/70" />

          {/* Shield */}
          <div className="absolute inset-0 z-[1] flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-primary security-scan__shield" strokeWidth={1.75} />
          </div>

          {/* Moving scan bar */}
          <span className="security-scan__beam pointer-events-none absolute inset-x-1 z-[2] h-3 rounded-full" />
        </div>
      </div>
    </div>
  );
}
