import type { ReactNode } from "react";
import Link from "next/link";
import Head from "next/head";
import { Button } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { buildDashboardResetPasswordHref } from "@/utils/constants";

interface DashboardLayoutProps {
  title: string;
  onLogout?: () => void;
  children: ReactNode;
}

export function DashboardLayout({ title, onLogout, children }: DashboardLayoutProps) {
  return (
    <>
      <Head>
        <title>{title} | ESS Onboarding Portal</title>
      </Head>
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <Logo compact />
          <nav className="dashboard-nav" aria-label="Main navigation">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/me/onboarding">Onboarding</Link>
            <Link href={buildDashboardResetPasswordHref()}>Security</Link>
          </nav>
          {onLogout ? (
            <Button type="button" variant="secondary" size="sm" onClick={onLogout}>
              Logout
            </Button>
          ) : null}
        </header>

        <main className="dashboard-content">
          <h1 className="page-title">{title}</h1>
          {children}
        </main>
      </div>
    </>
  );
}
