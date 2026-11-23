import { z } from "zod";
import { apiRequest } from "./api";

export const policySchema = z.object({
  access_seconds: z.number(),
  refresh_seconds: z.number(),
  absolute_seconds: z.number(),
  idle_seconds: z.number(),
  max_sessions: z.number(),
});
export type SessionPolicy = z.infer<typeof policySchema>;
const deadlines = z.object({
  session_id: z.string(),
  server_time: z.number(),
  idle_expires_at: z.number(),
  absolute_expires_at: z.number(),
  refresh_expires_at: z.number(),
});
export type SessionDeadlines = z.infer<typeof deadlines>;
const provider = z.object({
  issuer: z.string(),
  client_id: z.string(),
  company_code: z.string().optional(),
  configured: z.boolean(),
  enabled: z.boolean(),
  tested_at: z.string().nullable(),
  redirect_uri: z.string(),
});
const identities = z.object({
  available: z.boolean(),
  linked: z.boolean(),
  issuer: z.string().nullable(),
});
const managed = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      user_id: z.number(),
      company_id: z.number().nullable(),
      device_name: z.string(),
      last_activity_at: z.string(),
    }),
  ),
  total: z.number(),
  page: z.number(),
});
export type ProviderSettings = z.infer<typeof provider>;
export type ManagedSessions = z.infer<typeof managed>;

export const sessionManagement = {
  deadlines: (token: string, activity = false) =>
    apiRequest(
      activity ? "/api/auth/sessions/activity" : "/api/auth/session-policy",
      deadlines,
      { token, method: activity ? "POST" : "GET" },
    ),
  policy: (token: string) =>
    apiRequest("/api/auth/administration/policy", policySchema, { token }),
  update: (token: string, body: SessionPolicy) =>
    apiRequest("/api/auth/administration/policy", policySchema, {
      token,
      body,
      method: "PUT",
    }),
  managed: (token: string, page: number) =>
    apiRequest("/api/auth/administration/sessions?page=" + page, managed, {
      token,
    }),
  revoke: (token: string, id: string) =>
    apiRequest(
      "/api/auth/administration/sessions/" + encodeURIComponent(id),
      z.object({ revoked: z.boolean() }),
      { token, method: "DELETE" },
    ),
  provider: (token: string) =>
    apiRequest("/api/auth/sso/provider", provider, { token }),
  saveProvider: (
    token: string,
    body: { issuer: string; client_id: string; client_secret?: string },
  ) =>
    apiRequest("/api/auth/sso/provider", provider, {
      token,
      body,
      method: "PUT",
    }),
  enableProvider: (token: string, enabled: boolean) =>
    apiRequest("/api/auth/sso/provider/enabled", provider, {
      token,
      body: { enabled },
      method: "PUT",
    }),
  identity: (token: string) =>
    apiRequest("/api/auth/sso/identity", identities, { token }),
  unlink: (token: string, password: string) =>
    apiRequest("/api/auth/sso/unlink", z.object({ linked: z.boolean() }), {
      token,
      body: { password },
      method: "POST",
    }),
};
