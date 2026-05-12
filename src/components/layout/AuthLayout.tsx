import type { ReactNode } from "react";
import Head from "next/head";
import { Logo } from "@/components/common/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <>
      <Head>
        <title>{title} | ESS Onboarding Portal</title>
      </Head>
      <div className="auth-shell">
        <section className="auth-brand-panel">
          <Logo />
          <h1 className="auth-brand-title">Employee Self-Service Onboarding Portal</h1>
          <p className="auth-brand-copy">
            Secure access for new employee onboarding, profile completion, and HR workflow updates.
          </p>
        </section>

        <main className="auth-content">
          <div className="auth-content-inner">
            <h2 className="page-title">{title}</h2>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
