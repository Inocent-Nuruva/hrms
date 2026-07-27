"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  /**
   * Kept for Magic UI API compatibility (unused in this implementation).
   */
  size?: number;
  /**
   * The duration of the border beam (seconds).
   */
  duration?: number;
  /**
   * The delay of the border beam (seconds).
   */
  delay?: number;
  /**
   * The color of the border beam from.
   */
  colorFrom?: string;
  /**
   * The color of the border beam to.
   */
  colorTo?: string;
  /**
   * The class name of the border beam.
   */
  className?: string;
  /**
   * The style of the border beam.
   */
  style?: CSSProperties;
  /**
   * Whether to reverse the animation direction.
   */
  reverse?: boolean;
  /**
   * Kept for Magic UI API compatibility (unused in this implementation).
   */
  initialOffset?: number;
  /**
   * Kept for API compatibility — control gap via parent `p-[Npx]` instead.
   */
  borderWidth?: number;
}

/**
 * Animated light that travels around a container border.
 *
 * Parent must use a padding-gap shell so the beam shows through:
 * ```tsx
 * <div className="relative overflow-hidden rounded-2xl p-[2px]">
 *   <BorderBeam colorFrom="#fff" colorTo="#c7d2fe" />
 *   <div className="relative z-10 rounded-[14px] bg-card">…</div>
 * </div>
 * ```
 */
export const BorderBeam = ({
  className,
  delay = 0,
  duration = 6,
  colorFrom = "#ffffff",
  colorTo = "#c7d2fe",
  style,
  reverse = false,
}: BorderBeamProps) => {
  return (
    <div
      aria-hidden
      className={cn(
        "border-beam pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]",
        className
      )}
      style={style}
    >
      <div
        className="border-beam__glow absolute left-1/2 top-1/2 aspect-square w-[200%]"
        style={{
          // Tight, opaque arc so the beam reads clearly on blue and light panels.
          background: `conic-gradient(from 0deg, transparent 0 68%, ${colorFrom} 74%, ${colorTo} 82%, transparent 90% 100%)`,
          animation: `border-beam-spin ${duration}s linear infinite ${reverse ? "reverse" : "normal"}`,
          animationDelay: delay ? `-${delay}s` : undefined,
          // Soft glow so white is readable on brand blue.
          filter: `drop-shadow(0 0 6px ${colorFrom})`,
        }}
      />
    </div>
  );
};
