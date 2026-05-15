import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { LoginFlow } from "@/components/auth/LoginFlow";
import { ErrorAlertOverlay } from "@/components/error-alert-overlay";
import { SuccessAlertOverlay } from "@/components/success-alert-overlay";
import { Toaster } from "@/components/ui/sonner";

const HEADING_WORDS = ["Welcome", "to", "your", "onboarding", "journey"];
const HEXAGON_TILE_SIZE = 72;
const HEXAGON_PATTERN = `
  radial-gradient(circle farthest-side at 0% 50%, rgba(48,49,148,0.85) 23.5%, transparent 0) calc(${HEXAGON_TILE_SIZE}px * 0.7) ${HEXAGON_TILE_SIZE}px,
  radial-gradient(circle farthest-side at 0% 50%, rgba(143,164,255,0.42) 24%, transparent 0) calc(${HEXAGON_TILE_SIZE}px * 0.6129) ${HEXAGON_TILE_SIZE}px,
  linear-gradient(rgba(48,49,148,0.85) 14%, transparent 0, transparent 85%, rgba(48,49,148,0.85) 0) 0 0,
  linear-gradient(150deg, rgba(48,49,148,0.85) 24%, rgba(143,164,255,0.42) 0, rgba(143,164,255,0.42) 26%, transparent 0, transparent 74%, rgba(143,164,255,0.42) 0, rgba(143,164,255,0.42) 76%, rgba(48,49,148,0.85) 0) 0 0,
  linear-gradient(30deg, rgba(48,49,148,0.85) 24%, rgba(143,164,255,0.42) 0, rgba(143,164,255,0.42) 26%, transparent 0, transparent 74%, rgba(143,164,255,0.42) 0, rgba(143,164,255,0.42) 76%, rgba(48,49,148,0.85) 0) 0 0,
  linear-gradient(90deg, rgba(143,164,255,0.42) 2%, rgba(48,49,148,0.85) 0, rgba(48,49,148,0.85) 98%, rgba(143,164,255,0.42) 0%) 0 0 rgba(48,49,148,0.85)
`;

function AnimatedHeading() {
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);

  useEffect(() => {
    const timers = HEADING_WORDS.map((_, i) =>
      setTimeout(() => setVisibleIndices((prev) => [...prev, i]), 200 + i * 140)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <h2 style={{ color: "white", fontSize: 32, fontWeight: 800, lineHeight: 1.3, margin: 0 }}>
      {HEADING_WORDS.map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            marginRight: 8,
            opacity: visibleIndices.includes(i) ? 1 : 0,
            transform: visibleIndices.includes(i) ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          {word}
        </span>
      ))}
    </h2>
  );
}

function BrandPanel() {
  return (
    <div
      className="animate-panel-entrance"
      style={{
        flex: 1,
        background: "linear-gradient(155deg, #303194 0%, #1a1b6a 60%, #0f1050 100%)",
        padding: "56px 48px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(155deg, #303194 0%, #1a1b6a 60%, #0f1050 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -120,
          backgroundImage: HEXAGON_PATTERN,
          backgroundSize: `${HEXAGON_TILE_SIZE * 1.333}px ${HEXAGON_TILE_SIZE * 2}px`,
          opacity: 0.34,
          transform: "rotate(-8deg)",
          animation: "spin 54s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -80,
          backgroundImage: HEXAGON_PATTERN,
          backgroundSize: `${HEXAGON_TILE_SIZE}px ${HEXAGON_TILE_SIZE * 1.5}px`,
          opacity: 0.14,
          animation: "floatBlob 12s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 36%, rgba(237,67,72,0.12) 100%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Logo in white card */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: "16px 24px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/alliance-logo.png"
              alt="Alliance Insurance"
              style={{ width: 100, height: "auto", display: "block" }}
            />
          </div>
        </div>

        <AnimatedHeading />

        <div style={{ marginTop: 48, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>
            © {new Date().getFullYear()} Alliance Insurance Corporation Ltd · Tanzania
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const prefillEmail =
    typeof router.query.email === "string" ? router.query.email : "";

  const handleSuccess = (redirectUrl: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(redirectUrl);
      return;
    }
    void router.push(redirectUrl);
  };

  return (
    <>
      <Toaster position="top-right" />
      <SuccessAlertOverlay />
      <ErrorAlertOverlay />

      {/* Animated background blobs */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <div
          className="bg-blob"
          style={{
            width: 500,
            height: 500,
            background: "#303194",
            top: -150,
            left: -100,
            animationDelay: "0s, 0s",
          }}
        />
        <div
          className="bg-blob"
          style={{
            width: 400,
            height: 400,
            background: "#ed4348",
            bottom: -100,
            right: -80,
            animationDelay: "-4s, 0.15s",
          }}
        />
        <div
          className="bg-blob"
          style={{
            width: 300,
            height: 300,
            background: "#303194",
            bottom: 100,
            left: 200,
            opacity: 0.1,
            animationDelay: "-8s, 0.3s",
          }}
        />
      </div>

      <div
        className="relative flex min-h-screen items-center justify-center"
        style={{ zIndex: 1, padding: 16 }}
      >
        {/* Desktop: split layout — brand panel + login card */}
        <div
          className="hidden md:flex w-full animate-card-entrance"
          style={{
            maxWidth: 960,
            minHeight: 600,
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}
        >
          <BrandPanel />
          <div
            style={{
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 32px",
              flex: "0 0 440px",
            }}
          >
            <div style={{ width: "100%" }}>
              <LoginFlow defaultEmail={prefillEmail} onSuccess={handleSuccess} />
            </div>
          </div>
        </div>

        {/* Mobile: only the login card */}
        <div
          className="flex md:hidden w-full animate-card-entrance"
          style={{ maxWidth: 440 }}
        >
          <LoginFlow defaultEmail={prefillEmail} onSuccess={handleSuccess} />
        </div>
      </div>
    </>
  );
}
