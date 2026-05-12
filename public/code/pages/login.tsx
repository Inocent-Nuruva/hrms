// ─────────────────────────────────────────────────────────────────────────────
// pages/login.tsx   (Next.js App Router → app/login/page.tsx)
// OR  pages/login.tsx  (Next.js Pages Router)
//
// Main login page — uses <LoginFlow> inside a centered full-screen layout
// with the Alliance brand panel on the left (desktop) and form on the right.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { LoginFlow } from "@/components/auth/LoginFlow";

// ── Brand panel (left side, desktop only) ─────────────────────────────────────

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-center flex-1 relative overflow-hidden
                 bg-gradient-to-br from-[#303194] via-[#1a1b6a] to-[#0f1050]
                 px-14 py-16"
    >
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/[0.04]" />
      <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/[0.04]" />
      <div className="absolute top-1/3 right-4 h-28 w-28 rounded-full bg-[#ed4348]/10" />

      <div className="relative z-10">
        {/* Logo card */}
        <div className="mb-12 flex justify-center">
          <div className="rounded-2xl bg-white px-8 py-5 shadow-2xl inline-flex">
            <img
              src="/assets/alliance-logo.png"
              alt="Alliance Insurance"
              className="h-24 w-auto object-contain"
            />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-4xl font-extrabold leading-tight text-white">
          Welcome to your<br />onboarding journey
        </h2>

        {/* Footer */}
        <div className="mt-16 border-t border-white/10 pt-6">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Alliance Insurance Corporation Ltd · Tanzania
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const prefillEmail = searchParams.get("email") ?? "";

  const handleSuccess = (redirectUrl: string) => {
    router.push(redirectUrl);
  };

  return (
    <>
      {/* Sonner toast provider */}
      <Toaster position="top-right" richColors />

      {/* Full-screen layout */}
      <div className="relative min-h-screen overflow-hidden bg-[#f0f2f8]">

        {/* Background blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-36 h-[500px] w-[500px] rounded-full
                          bg-[#303194] opacity-[0.15] blur-[80px]" />
          <div className="absolute -bottom-24 -right-20 h-[400px] w-[400px] rounded-full
                          bg-[#ed4348] opacity-[0.12] blur-[80px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex min-h-screen items-center justify-center p-4 lg:p-8">

          {/* Split card (desktop) / single card (mobile) */}
          <div className="flex w-full max-w-[900px] overflow-hidden rounded-3xl shadow-2xl
                          lg:min-h-[580px]">

            {/* Left: brand panel */}
            <BrandPanel />

            {/* Right: login form */}
            <div className="flex flex-1 items-center justify-center
                            bg-white px-6 py-10 lg:max-w-[440px] lg:px-10">
              <div className="w-full">
                <LoginFlow
                  defaultEmail={prefillEmail}
                  onSuccess={handleSuccess}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
