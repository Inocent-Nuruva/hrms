import { useRouter } from "next/router";
import { LoginFlow } from "@/components/auth/LoginFlow";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
import { ErrorAlertOverlay } from "@/components/error-alert-overlay";
import { SuccessAlertOverlay } from "@/components/success-alert-overlay";
import { BorderBeam } from "@/components/ui/border-beam";
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

      {/* Theme-aware page background */}
      <div className="pointer-events-none fixed inset-0 bg-background" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Theme toggle — available before login */}
      <div className="fixed right-3 top-3 z-20 md:right-4 md:top-4">
        <ThemeTogglerButton
          variant="outline"
          size="icon-sm"
          modes={["light", "dark", "system"]}
          className="border-border bg-card/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-muted"
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-3 md:p-4 lg:p-6" style={{ zIndex: 1 }}>
        <div className="w-full max-w-[860px] animate-card-entrance">
          {/* Desktop / Tablet — padding-gap shell so the beam always shows */}
          <div className="relative hidden overflow-hidden rounded-2xl p-[2px] shadow-sm md:block dark:shadow-none">
            {/* White → soft indigo: white reads on blue left, indigo on light right */}
            <BorderBeam
              duration={5}
              colorFrom="#ffffff"
              colorTo="#a5b4fc"
            />

            <div className="relative z-10 grid min-h-[420px] grid-cols-5 overflow-hidden rounded-[14px] bg-card text-card-foreground">
              {/* Brand panel — brand colors stay constant in both themes */}
              <div className="relative col-span-3 flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#303194] to-[#252882] p-8 text-white lg:p-10">
                <div className="relative z-10">
                  <div className="mb-6">
                    <span className="text-sm font-semibold tracking-tight">Alliance HRMS</span>
                  </div>

                  <h1
                    className="mb-3 text-2xl font-semibold leading-tight tracking-tighter animate-fade-up lg:text-3xl"
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
              <div className="col-span-2 flex items-center bg-background p-4 lg:p-5 dark:bg-card">
                <div className="mx-auto w-full max-w-[240px]">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Sign in
                    </h2>
                  </div>

                  <LoginFlow defaultEmail={prefillEmail} onSuccess={handleSuccess} />
                </div>
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
                className="h-7 w-auto dark:brightness-0 dark:invert"
              />
            </div>

            <div className="mb-3 text-center">
              <h1
                className="text-lg font-semibold tracking-tighter text-foreground animate-fade-up"
                style={{ animationDelay: "80ms" }}
              >
                Welcome back
              </h1>
            </div>

            <div className="relative overflow-hidden rounded-xl p-[2px] shadow-sm dark:shadow-none">
              <BorderBeam duration={5} colorFrom="#ffffff" colorTo="#a5b4fc" />
              <div className="relative z-10 rounded-[10px] bg-card p-4 text-card-foreground">
                <LoginFlow defaultEmail={prefillEmail} onSuccess={handleSuccess} />
              </div>
            </div>

            <p className="mt-6 text-center text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} Alliance Insurance Corporation Ltd
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
