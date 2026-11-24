"use client"

import { useDashboardHeroBackground } from "@/hooks/use-dashboard-hero-background"

export type WelcomeBackground = "aurora" | "geometric" | "glow" | "plain"

/** The account's dashboard choice is shared by page heroes and welcome cards. */
export function SharedDashboardHeroBackground() {
  const [background] = useDashboardHeroBackground()
  return <WelcomeCardBackground background={background} />
}

export function WelcomeCardBackground({ background }: { background: WelcomeBackground }) {
  if (background === "plain") return null

  return (
    background === "aurora" ? <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 isolate overflow-hidden rounded-none dark:opacity-100"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/images/manager-welcome-aurora.png')",
                // Crop the rounded frame baked into the source image.
                backgroundSize: "112% 120%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: "grayscale(1)",
                mixBlendMode: "luminosity",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/25 via-background/10 to-background/30 dark:from-background/90 dark:via-background/75 dark:to-background/85" />
          </div> : background === "glow" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
              style={{
                background: "radial-gradient(ellipse at 85% 15%, color-mix(in srgb, var(--primary) 35%, transparent), transparent 55%), radial-gradient(ellipse at 55% 110%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%)",
              }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)", backgroundSize: "20px 20px", maskImage: "linear-gradient(to right, transparent 25%, black)" }} />
            </div>
          ) : (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-primary">
              <div className="absolute -right-12 -top-16 size-56 rounded-full border-[28px] border-current opacity-[0.06]" />
              <div className="absolute right-6 top-8 size-28 rounded-full border border-current opacity-[0.12]" />
              <div className="absolute -bottom-10 right-20 h-40 w-20 rotate-[25deg] bg-current opacity-[0.035]" />
              <div className="absolute left-[55%] top-8 h-20 w-px rotate-[38deg] bg-current opacity-[0.12]" />
              <div className="absolute left-[58%] top-10 size-1.5 rounded-full bg-current opacity-[0.15]" />
              <div className="absolute left-[62%] top-16 size-1 rounded-full bg-current opacity-[0.12]" />
            </div>
          )
  )
}
