"use client";

import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/services/api";
import {
  sessionManagement as api,
  type SessionPolicy,
  type ProviderSettings,
  type ManagedSessions,
} from "@/services/session-management";
import { startBrowserSso } from "@/services/sso";

const limits = {
  access_seconds: ["Access token lifetime (seconds)", 60, 3600],
  refresh_seconds: ["Refresh token lifetime (seconds)", 300, 7776000],
  absolute_seconds: ["Maximum session lifetime (seconds)", 3600, 7776000],
  idle_seconds: ["Inactivity timeout (seconds)", 300, 86400],
  max_sessions: ["Simultaneous sessions per account", 1, 50],
} as const;
const date = (value: string) => new Date(value).toLocaleString();
const eventPage = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      event_type: z.string(),
      outcome: z.string(),
      occurred_at: z.string(),
      reason: z.string().nullable(),
      target_user_id: z.number().nullable(),
      actor_name: z.string().nullable(),
    }),
  ),
  meta: z.object({ hasNextPage: z.boolean() }),
});
const events = (token: string, page: number) =>
  apiRequest(
    "/api/security-events?category=authentication&limit=10&page=" + page,
    eventPage,
    { token },
  );

function useRemote<T>(loader: () => Promise<T>) {
  const [value, set] = React.useState<T | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    setError("");
    void loader()
      .then((data) => {
        if (active) set(data);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Unable to load settings.");
      });
    return () => {
      active = false;
    };
  }, [loader]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  };
  return { value, set, error, busy, run };
}
function Message({ text }: { text: string }) {
  return text ? (
    <p role="alert" className="break-words text-sm text-destructive">
      {text}
    </p>
  ) : null;
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <details
      className="rounded-lg border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">{title}</summary>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </details>
  );
}
function Policy({ token }: { token: string }) {
  const state = useRemote(React.useCallback(() => api.policy(token), [token]));
  const [draft, setDraft] = React.useState<SessionPolicy | null>(null);
  const [saved, setSaved] = React.useState(false);
  const policy = draft ?? state.value;
  return (
    <>
      <Message text={state.error} />
      {policy && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void state.run(async () => {
              state.set(await api.update(token, policy));
              setDraft(null);
              setSaved(true);
            });
          }}
        >
          <p className="text-sm text-muted-foreground">
            These limits apply at the next sign-in. When an account reaches the
            device limit, signing in ends its oldest session.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(limits) as Array<keyof SessionPolicy>).map((k) => (
              <label key={k} className="text-sm">
                {limits[k][0]}
                <Input
                  type="number"
                  required
                  min={limits[k][1]}
                  max={limits[k][2]}
                  step={1}
                  value={Number.isNaN(policy[k]) ? "" : policy[k]}
                  onChange={(e) => {
                    setDraft({ ...policy, [k]: e.target.valueAsNumber });
                    setSaved(false);
                  }}
                />
              </label>
            ))}
          </div>
          <Button disabled={state.busy} type="submit">
            Save session policy
          </Button>
          {saved && <p role="status">Session policy saved.</p>}
        </form>
      )}
    </>
  );
}
function Provider({ token }: { token: string }) {
  const state = useRemote<ProviderSettings>(
    React.useCallback(() => api.provider(token), [token]),
  );
  const p = state.value;
  const [draft, setDraft] = React.useState<{
    issuer: string;
    client_id: string;
  } | null>(null);
  const [secret, setSecret] = React.useState("");
  const form = draft ?? p;
  return (
    <>
      <Message text={state.error} />
      {p && form && (
        <>
          {p.company_code && (
            <p>
              Company sign-in code <strong>{p.company_code}</strong>
            </p>
          )}
          <p className="text-sm">
            Register this web redirect URI with your provider{" "}
            <code className="block break-all select-all">{p.redirect_uri}</code>
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void state.run(async () => {
                state.set(
                  await api.saveProvider(token, {
                    issuer: form.issuer,
                    client_id: form.client_id,
                    ...(secret ? { client_secret: secret } : {}),
                  }),
                );
                setDraft(null);
                setSecret("");
              });
            }}
          >
            <label className="block text-sm">
              Issuer URL
              <Input
                type="url"
                required
                value={form.issuer}
                onChange={(e) => setDraft({ ...form, issuer: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Client ID
              <Input
                required
                value={form.client_id}
                onChange={(e) =>
                  setDraft({ ...form, client_id: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              Client secret
              <Input
                type="password"
                autoComplete="new-password"
                required={!p.configured}
                value={secret}
                placeholder={
                  p.configured
                    ? "Leave blank to keep the saved secret"
                    : undefined
                }
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Changing a registration pauses SSO until a new test succeeds and
              you enable it. Password sign-in stays available.
            </p>
            <Button type="submit" disabled={state.busy}>
              Save registration
            </Button>
          </form>
          {p.configured && (
            <>
              <p role="status">
                SSO {p.enabled ? "enabled" : "disabled"}.{" "}
                {p.tested_at
                  ? "Last successful test " + date(p.tested_at)
                  : "Registration awaits a sign-in test."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={state.busy || !!draft || !!secret}
                  onClick={() =>
                    void state.run(() => startBrowserSso("test", {}, token))
                  }
                >
                  Test provider sign-in
                </Button>
                <Button
                  variant="outline"
                  disabled={state.busy || (!p.enabled && !p.tested_at)}
                  onClick={() =>
                    void state.run(async () =>
                      state.set(await api.enableProvider(token, !p.enabled)),
                    )
                  }
                >
                  {p.enabled ? "Disable SSO" : "Enable SSO"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
function LinkIdentity({ token }: { token: string }) {
  const state = useRemote(
    React.useCallback(() => api.identity(token), [token]),
  );
  const [password, setPassword] = React.useState("");
  const link = state.value;
  return (
    <>
      <Message text={state.error} />
      {link && (
        <>
          <p className="text-sm">
            {link.linked
              ? "Linked to " + link.issuer
              : link.available
                ? "Link your existing HRMS account to your company identity."
                : "SSO is unavailable for this company account."}
          </p>
          {(link.linked || link.available) && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void state.run(async () => {
                  if (link.linked) {
                    await api.unlink(token, password);
                    state.set(await api.identity(token));
                  } else {
                    await startBrowserSso("link", { password }, token);
                  }
                  setPassword("");
                });
              }}
            >
              <label className="block text-sm">
                Current HRMS password
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button type="submit" variant="outline" disabled={state.busy}>
                {link.linked ? "Unlink identity" : "Link company identity"}
              </Button>
            </form>
          )}
        </>
      )}
    </>
  );
}
function Pager({
  page,
  setPage,
  more,
}: {
  page: number;
  setPage: (p: number) => void;
  more: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>Page {page}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={!more}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
function Sessions({ token }: { token: string }) {
  const [page, setPage] = React.useState(1);
  const [confirm, setConfirm] = React.useState("");
  const state = useRemote<ManagedSessions>(
    React.useCallback(() => api.managed(token, page), [token, page]),
  );
  const records = state.value;
  return (
    <>
      <Message text={state.error} />
      {records && (
        <>
          {!records.data.length && <p>No active sessions in this scope.</p>}
          <ul className="divide-y">
            {records.data.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <strong>{s.device_name}</strong>
                  <p>
                    User {s.user_id} ·{" "}
                    {s.company_id ? "Company " + s.company_id : "Platform"} ·{" "}
                    {date(s.last_activity_at)}
                  </p>
                </div>
                {confirm === s.id ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={state.busy}
                      onClick={() =>
                        void state.run(async () => {
                          await api.revoke(token, s.id);
                          setConfirm("");
                          state.set(await api.managed(token, page));
                        })
                      }
                    >
                      Confirm revocation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirm("")}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm(s.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            setPage={setPage}
            more={page * 25 < records.total}
          />
        </>
      )}
    </>
  );
}
function Events({ token }: { token: string }) {
  const [page, setPage] = React.useState(1);
  const state = useRemote(
    React.useCallback(() => events(token, page), [token, page]),
  );
  const records = state.value;
  return (
    <>
      <Message text={state.error} />
      {records && (
        <>
          {!records.data.length && (
            <p>No authentication events in this scope.</p>
          )}
          <ul className="divide-y">
            {records.data.map((e) => (
              <li key={e.id} className="py-2 text-sm">
                <strong>{e.event_type.replaceAll("_", " ")}</strong> ·{" "}
                {e.outcome}
                <p>
                  {date(e.occurred_at)}
                  {e.actor_name ? " · " + e.actor_name : ""}
                  {e.target_user_id ? " · User " + e.target_user_id : ""}
                </p>
                {e.reason && <p>{e.reason}</p>}
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            setPage={setPage}
            more={records.meta.hasNextPage}
          />
        </>
      )}
    </>
  );
}
export function AuthenticationSettings({
  token,
  platform,
  manage,
  audit,
}: {
  token: string;
  platform: boolean;
  manage: boolean;
  audit: boolean;
}) {
  return (
    <section
      aria-label="Authentication and session management"
      className="space-y-2 text-sm"
    >
      <h3 className="font-semibold">Authentication and session management</h3>
      {!platform && (
        <Section title="My company sign-in">
          <LinkIdentity token={token} />
        </Section>
      )}
      {platform && (
        <Section title="Session policy">
          <Policy token={token} />
        </Section>
      )}
      {manage && !platform && (
        <Section title="Company identity provider">
          <Provider token={token} />
        </Section>
      )}
      {manage && (
        <Section title="Manage active sessions">
          <Sessions token={token} />
        </Section>
      )}
      {audit && (
        <Section title="Authentication events">
          <Events token={token} />
        </Section>
      )}
    </section>
  );
}
