import Head from "next/head";
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoginFlow } from "@/components/auth/LoginFlow";
import { useAuth } from "@/hooks/useAuth";
import { finishBrowserSso, securitySettingsPath } from "@/services/sso";
import { ROUTES } from "@/utils/constants";
import { markDashboardFromLogin } from "@/lib/dashboard-login-flag";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  return { props: {} };
};

export default function SingleSignOnCallback() {
  const { saveSession } = useAuth();
  const started = useRef(false);
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void finishBrowserSso()
      .then((result) => {
        if (result.purpose !== "login") {
          window.location.replace(securitySettingsPath);
          return;
        }
        const login = result.login;
        if (login.requiresOtp && login.tempToken) {
          setChallenge(login.tempToken);
          return;
        }
        if (!login.tokens || !login.user)
          throw new Error(
            login.message ?? "Company sign-in could not be completed.",
          );
        saveSession(login.tokens, login.user, login.dashboardType, login.scope);
        if (login.dashboardType !== "employee" && login.scope !== "platform")
          markDashboardFromLogin();
        window.location.replace(
          login.requiresPasswordChange || login.user.requiresPasswordChange
            ? ROUTES.changePassword + "?required=1&next=%2Fdashboard"
            : ROUTES.dashboard,
        );
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Company sign-in could not be completed.",
        ),
      );
  }, [saveSession]);
  return (
    <>
      <Head>
        <meta name="referrer" content="no-referrer" />
        <title>Company sign-in</title>
      </Head>
      <main className="mx-auto mt-20 max-w-md space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">Company sign-in</h1>
        {challenge ? (
          <LoginFlow initialChallenge={challenge} />
        ) : error ? (
          <>
            <p role="alert">{error}</p>
            <Link href="/login" className="underline">
              Return to sign in
            </Link>
          </>
        ) : (
          <p role="status">Verifying your identity…</p>
        )}
      </main>
    </>
  );
}
