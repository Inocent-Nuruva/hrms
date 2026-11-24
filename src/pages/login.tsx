import { useRouter } from "next/router";
import { Card } from "@fluentui/react-components";
import { LoginFlow } from "@/components/auth/LoginFlow";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
import { Toaster } from "@/components/ui/sonner";

export default function LoginPage() {
  const router = useRouter();
  const prefillEmail =
    typeof router.query.email === "string" ? router.query.email : "";
  const nextPath = typeof router.query.next === "string" ? router.query.next : "";

  const handleSuccess = (redirectUrl: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("hrms:unread-reminder-shown");
      window.location.assign(redirectUrl);
      return;
    }
    void router.push(redirectUrl);
  };

  return (
    <>
      <Toaster position="top-right" />

      {/* Theme-aware page background */}
      <div className="pointer-events-none fixed inset-0 bg-background" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Theme toggle — available before login */}
      <div className="fixed right-3 top-3 z-20 md:right-4 md:top-4">
        <ThemeTogglerButton
          variant="ghost"
          size="icon-sm"
          modes={["light", "dark", "system"]}
          className="!border-0 !bg-transparent text-foreground !shadow-none hover:!bg-transparent"
        />
      </div>

      <div
        className="relative flex min-h-screen items-center justify-center p-3 md:p-4 lg:p-6"
        style={{ zIndex: 1 }}
      >
        <div className="w-full max-w-[860px] animate-card-entrance">
          {/*
            One LoginFlow for all breakpoints. Previously mobile + desktop each
            mounted their own form; OTP "Back to sign in" only updated the hidden
            instance on some mobile browsers / resize paths.
          */}
          <Card
            appearance="filled"
            className="w-full overflow-hidden shadow-lg"
            style={{ padding: 0 }}
          >
            <div className="overflow-hidden text-card-foreground md:grid md:min-h-[460px] md:grid-cols-2">
              {/* Brand panel — desktop/tablet only */}
              <div
                className="relative hidden flex-col justify-center overflow-hidden p-8 text-white md:flex lg:p-10"
                style={{ backgroundColor: "var(--colorBrandBackground)" }}
              >
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

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_0.9px,transparent_1px)] bg-[length:5px_5px] opacity-25" />
              </div>

              {/* Form panel — single LoginFlow */}
              <div className="flex items-center bg-background px-6 py-8 md:px-8 dark:bg-card">
                <div className="mx-auto w-full max-w-[320px]">
                  <div className="mb-4 md:hidden">
                    <div className="mb-3 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/alliance-logo.png"
                        alt="Alliance Insurance"
                        className="h-7 w-auto dark:brightness-0 dark:invert"
                      />
                    </div>
                    <h1 className="text-center text-lg font-semibold tracking-tighter text-foreground">
                      Welcome back
                    </h1>
                  </div>

                  <div className="mb-4 hidden md:block">
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Sign in
                    </h2>
                  </div>

                  <LoginFlow defaultEmail={prefillEmail} nextPath={nextPath} onSuccess={handleSuccess} />
                </div>
              </div>
            </div>
          </Card>

          <p className="mt-6 text-center text-[10px] text-muted-foreground md:hidden">
            © {new Date().getFullYear()} Alliance Insurance Corporation Ltd
          </p>
        </div>
      </div>
    </>
  );
}
