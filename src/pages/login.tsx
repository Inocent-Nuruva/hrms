import { useRouter } from "next/router";
import { LoginFlow } from "@/components/auth/LoginFlow";
import { ErrorAlertOverlay } from "@/components/error-alert-overlay";
import { SuccessAlertOverlay } from "@/components/success-alert-overlay";
import { Toaster } from "@/components/ui/sonner";


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

      {/* Subtle background */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      <div className="relative flex min-h-screen items-center justify-center p-3 md:p-4 lg:p-6" style={{ zIndex: 1 }}>
        <div className="w-full max-w-[860px] animate-card-entrance">
          {/* Desktop / Tablet split layout */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm min-h-[420px]">
            {/* Brand panel */}
            <div className="md:col-span-3 flex flex-col justify-center p-8 lg:p-10 bg-gradient-to-br from-[#303194] to-[#252882] text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="mb-6">
                  <span className="text-sm font-semibold tracking-tight">Alliance HRMS</span>
                </div>

                <h1
                  className="text-2xl lg:text-3xl font-semibold tracking-tighter leading-tight mb-3 animate-fade-up"
                  style={{ animationDelay: "140ms" }}
                >
                  Welcome back.
                </h1>

                <div className="mt-8 text-xs text-white/60">
                  © {new Date().getFullYear()} Alliance Insurance Corporation Ltd
                </div>
              </div>

              {/* Decorative subtle pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#fff_0.8px,transparent_1px)] bg-[length:5px_5px] opacity-10" />
            </div>

            {/* Form panel */}
            <div className="md:col-span-2 p-4 lg:p-5 flex items-center bg-background">
              <div className="w-full max-w-[240px] mx-auto">
                <div className="mb-4">
                  <h2 className="text-base font-semibold tracking-tight">Sign in</h2>
                </div>

                <LoginFlow defaultEmail={prefillEmail} onSuccess={handleSuccess} />
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="md:hidden">
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/alliance-logo.png"
                alt="Alliance Insurance"
                className="h-7 w-auto"
              />
            </div>

            <div className="mb-3 text-center">
              <h1
                className="text-lg font-semibold tracking-tighter animate-fade-up"
                style={{ animationDelay: "80ms" }}
              >
                Welcome back
              </h1>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <LoginFlow defaultEmail={prefillEmail} onSuccess={handleSuccess} />
            </div>

            <p className="mt-6 text-center text-[10px] text-muted-foreground/70">
              © {new Date().getFullYear()} Alliance Insurance Corporation Ltd
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
