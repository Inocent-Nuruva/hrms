"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DashboardIdentitySummary } from "@/components/dashboard/dashboard-identity"
import { SharedDashboardHeroBackground } from "@/components/dashboard/welcome-card-background"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  listPlatformNotificationChannelSettings,
  listPlatformNotificationMailLogs,
  listPlatformSmsLogs,
  listPlatformSmsRegistry,
  listResourcePage,
  probePlatformCompaniesList,
  type AdminRecord,
} from "@/lib/admin-api"
import { hasPermission } from "@/lib/dashboard-permissions"
import {
  confirmPlatformRoute,
  forgetForbiddenRoute,
  rememberForbiddenRoute,
} from "@/lib/forbidden-routes"
import { readStoredSessionTokens } from "@/lib/session-client"
import { cn } from "@/lib/utils"

type ServiceKey = "companies" | "governance" | "notifications" | "sms"

type PlatformSummary = {
  companies: number | null
  roles: number | null
  permissions: number | null
  notificationChannels: number | null
  failedMail: number | null
  smsRegistry: number | null
  failedSms: number | null
  errors: Partial<Record<ServiceKey, string>>
  checkedAt: Date | null
}

const EMPTY_SUMMARY: PlatformSummary = {
  companies: null,
  roles: null,
  permissions: null,
  notificationChannels: null,
  failedMail: null,
  smsRegistry: null,
  failedSms: null,
  errors: {},
  checkedAt: null,
}

function errorMessage(value: unknown) {
  if (value instanceof Error && value.message.trim()) return value.message.trim()
  return "The platform API did not accept this request."
}

function readStatus(row: AdminRecord) {
  const value = row.status ?? row.delivery_status ?? row.deliveryStatus
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

function failedCount(rows: AdminRecord[]) {
  return rows.filter((row) => readStatus(row) === "FAILED").length
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  loading,
  error,
}: {
  label: string
  value: number | null
  detail: string
  icon: React.ComponentType<{ className?: string }>
  loading: boolean
  error?: string
}) {
  return (
    <div className="min-w-0 border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <div className="mt-3 min-h-9">
            {loading ? (
              <div className="h-8 w-16 animate-pulse bg-muted" />
            ) : (
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {error ? "—" : (value ?? 0).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
      <p className={cn("mt-2 truncate text-xs", error ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {error ? "API access unavailable" : detail}
      </p>
    </div>
  )
}

function ServiceRow({
  title,
  description,
  error,
  loading,
}: {
  title: string
  description: string
  error?: string
  loading?: boolean
}) {
  const healthy = !error
  return (
    <div className="flex items-start gap-3 border-t border-border px-4 py-3 first:border-t-0">
      {loading ? (
        <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      ) : healthy ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", healthy ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
            {loading ? "Checking" : healthy ? "Available" : "Needs API access"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {loading ? "Checking the live platform endpoint…" : error || description}
        </p>
      </div>
    </div>
  )
}

function OperationsCard({
  title,
  description,
  href,
  icon: Icon,
  enabled,
  unavailable,
}: {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  enabled: boolean
  unavailable?: boolean
}) {
  const content = (
    <div className="group flex h-full min-h-36 flex-col border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        {enabled && !unavailable ? (
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : null}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      {!enabled || unavailable ? (
        <p className="mt-auto pt-3 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          {unavailable ? "Waiting for API access" : "Permission not granted"}
        </p>
      ) : null}
    </div>
  )

  return enabled && !unavailable ? <Link href={href}>{content}</Link> : content
}

export function PlatformAdminDashboard() {
  const actor = useDashboardActor()
  const [summary, setSummary] = React.useState<PlatformSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)

  React.useEffect(() => {
    const token = readStoredSessionTokens().accessToken.trim()
    if (!actor.ready || actor.scope !== "platform" || !token) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    const load = async () => {
      const [companies, roles, permissions, notificationChannels, mailLogs, smsRegistry, smsLogs] =
        await Promise.allSettled([
          probePlatformCompaniesList(token),
          listResourcePage("roles", token, { page: 1, limit: 100 }, { cacheTtlMs: 0 }),
          listResourcePage("permissions", token, { page: 1, limit: 100 }, { cacheTtlMs: 0 }),
          listPlatformNotificationChannelSettings(token),
          listPlatformNotificationMailLogs(token, { page: 1, limit: 20, status: "FAILED" }, { cacheTtlMs: 0 }),
          listPlatformSmsRegistry(token),
          listPlatformSmsLogs(token, { page: 1, limit: 100, status: "FAILED" }),
        ])

      if (!active) return

      const errors: PlatformSummary["errors"] = {}
      if (companies.status === "rejected") errors.companies = errorMessage(companies.reason)
      if (roles.status === "rejected" || permissions.status === "rejected") {
        errors.governance = errorMessage(roles.status === "rejected" ? roles.reason : permissions.status === "rejected" ? permissions.reason : null)
      }
      if (notificationChannels.status === "rejected" || mailLogs.status === "rejected") {
        errors.notifications = errorMessage(notificationChannels.status === "rejected" ? notificationChannels.reason : mailLogs.status === "rejected" ? mailLogs.reason : null)
      }
      if (smsRegistry.status === "rejected" || smsLogs.status === "rejected") {
        errors.sms = errorMessage(smsRegistry.status === "rejected" ? smsRegistry.reason : smsLogs.status === "rejected" ? smsLogs.reason : null)
      }

      setSummary({
        companies: companies.status === "fulfilled" ? companies.value.length : null,
        roles: roles.status === "fulfilled" ? roles.value.total : null,
        permissions: permissions.status === "fulfilled" ? permissions.value.total : null,
        notificationChannels: notificationChannels.status === "fulfilled" ? notificationChannels.value.length : null,
        failedMail: mailLogs.status === "fulfilled" ? mailLogs.value.total : null,
        smsRegistry: smsRegistry.status === "fulfilled" ? smsRegistry.value.length : null,
        failedSms: smsLogs.status === "fulfilled" ? failedCount(smsLogs.value) : null,
        errors,
        checkedAt: new Date(),
      })
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [actor.ready, actor.scope, refreshKey])

  const canCompanies = hasPermission(actor.permissionLabels, {
    permissions: ["companies:read", "companies:read"],
    mode: "any",
  })
  const canRoles = hasPermission(actor.permissionLabels, "roles:read")
  const canPermissions = hasPermission(actor.permissionLabels, "permissions:read")
  const canNotifications = hasPermission(actor.permissionLabels, {
    permissions: ["notifications:settings-read", "notifications:mail-logs-read"],
    mode: "any",
  })
  const canSms = hasPermission(actor.permissionLabels, {
    permissions: ["sms:settings-read", "sms:logs-read"],
    mode: "any",
  })
  const errorCount = Object.keys(summary.errors).length

  React.useEffect(() => {
    if (!summary.checkedAt) return

    if (summary.errors.companies) {
      rememberForbiddenRoute("/dashboard/companies")
    } else {
      confirmPlatformRoute("/dashboard/companies")
    }

    for (const route of ["/dashboard/roles", "/dashboard/permissions"]) {
      if (summary.errors.governance) rememberForbiddenRoute(route)
      else forgetForbiddenRoute(route)
    }
    if (summary.errors.notifications) {
      rememberForbiddenRoute("/dashboard/operations/notifications")
    } else {
      forgetForbiddenRoute("/dashboard/operations/notifications")
    }
    if (summary.errors.sms) rememberForbiddenRoute("/dashboard/sms/platform")
    else confirmPlatformRoute("/dashboard/sms/platform")
  }, [summary.checkedAt, summary.errors])

  return (
    <div className="w-full pb-6">
      <section className="relative isolate overflow-hidden border-b border-primary/20 bg-card px-4 py-5 text-foreground md:px-6 md:py-6">
        <SharedDashboardHeroBackground />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <DashboardIdentitySummary className="mb-4" tone="default" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Platform administration</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Platform Control Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage tenant companies, platform access governance, and shared communication services.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-border bg-background/75 px-3 py-1.5 text-xs font-medium">Platform scope</span>
            <span className="border border-border bg-background/75 px-3 py-1.5 text-xs font-medium">
              {actor.permissionLabels.length} permissions
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="border-white/40 bg-white !text-primary shadow-none hover:bg-white/90 hover:!text-primary [&_svg]:!text-primary before:bg-white/80"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <div className="space-y-5 px-3 pt-5 sm:px-4 md:px-6">
        {errorCount > 0 ? (
          <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Some platform services are not authorizing this session</p>
              <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200/80">
                The dashboard remains available, but affected controls are disabled until the API accepts the platform token.
              </p>
            </div>
          </div>
        ) : null}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Platform snapshot</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Operational overview</h2>
            </div>
            {summary.checkedAt ? (
              <p className="hidden text-xs text-muted-foreground sm:block">Checked {summary.checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Companies" value={summary.companies} detail="Registered tenants" icon={Building2} loading={loading} error={summary.errors.companies} />
            <MetricCard label="Roles" value={summary.roles} detail={`${summary.permissions ?? 0} permission definitions`} icon={ShieldCheck} loading={loading} error={summary.errors.governance} />
            <MetricCard label="Mail failures" value={summary.failedMail} detail={`${summary.notificationChannels ?? 0} global channels`} icon={Mail} loading={loading} error={summary.errors.notifications} />
            <MetricCard label="SMS failures" value={summary.failedSms} detail={`${summary.smsRegistry ?? 0} registry events`} icon={MessageSquareText} loading={loading} error={summary.errors.sms} />
          </div>
        </section>

        <section>
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Administration</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Platform operations</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OperationsCard title="Tenant companies" description="Create, review, activate, or suspend companies and their first administrators." href="/dashboard/companies" icon={Building2} enabled={canCompanies} unavailable={loading || Boolean(summary.errors.companies)} />
            <OperationsCard title="Roles" description="Maintain reusable access roles and inspect their permission assignments." href="/dashboard/roles" icon={ShieldCheck} enabled={canRoles} unavailable={loading || Boolean(summary.errors.governance)} />
            <OperationsCard title="Permissions" description="Review the platform permission catalog used across role policies." href="/dashboard/permissions" icon={KeyRound} enabled={canPermissions} unavailable={loading || Boolean(summary.errors.governance)} />
            <OperationsCard title="Delivery services" description="Monitor platform mail and SMS configuration, registries, failures, and retries." href="/dashboard/operations/notifications" icon={Activity} enabled={canNotifications || canSms} unavailable={loading || Boolean(summary.errors.notifications && summary.errors.sms)} />
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Service health</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Platform API readiness</h2>
            </div>
            <ServiceRow title="Tenant registry" description="Company registry is responding." error={summary.errors.companies} loading={loading} />
            <ServiceRow title="Access governance" description="Role and permission catalogs are responding." error={summary.errors.governance} loading={loading} />
            <ServiceRow title="Notification delivery" description="Platform notification settings and mail logs are responding." error={summary.errors.notifications} loading={loading} />
            <ServiceRow title="SMS infrastructure" description="Platform SMS settings and logs are responding." error={summary.errors.sms} loading={loading} />
          </div>

          <div className="border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current authority</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Platform administrator</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Navigation and actions are derived from the permission list returned by login. Platform scope never falls through to company HR screens.
            </p>
            <div className="mt-4 space-y-2">
              {[
                ["Company administration", canCompanies],
                ["Role governance", canRoles],
                ["Permission catalog", canPermissions],
                ["Notification operations", canNotifications],
                ["SMS operations", canSms],
              ].map(([label, granted]) => (
                <div key={String(label)} className="flex items-center justify-between border-t border-border pt-2 text-xs first:border-t-0 first:pt-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={granted ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-muted-foreground"}>
                    {granted ? "Granted" : "Not granted"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
