"use client";
import { z } from "zod";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import {
  readStorage,
  subscribeStorage,
  writeStorageBatch,
} from "@/lib/local-storage-store";

export const SESSION_STORAGE_KEY = "hrms.auth.session.v1";
export const ACCESS_TOKEN_STORAGE_KEY = "hrms.admin.accessToken";
export const AuthTokensSchema = z.object({
  accessToken: z.string().trim().min(1),
  refreshToken: z.string(),
});
export const AuthUserSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().positive()]),
    employeeId: z.string().optional(),
    employeeLinked: z.boolean().optional(),
    fullName: z.string(),
    email: z.string(),
    role: z.string().optional(),
    roles: z.array(z.string()).optional(),
    scope: z.enum(["platform", "company"]).optional(),
    dashboardType: z.enum(["admin", "employee"]).optional(),
    companyId: z.number().int().positive().optional(),
    companyName: z.string().optional(),
    availableCompanies: z.array(z.object({ id: z.number().int().positive(), name: z.string() })).optional(),
    requiresPasswordChange: z.boolean().optional(),
    permissions: z.array(z.string()).optional(),
    accessContextResolved: z.boolean().optional(),
  })
  .passthrough();
const StoredSession = z.object({
  tokens: AuthTokensSchema.nullable(),
  user: AuthUserSchema.nullable(),
  credentialVersion: z.string(),
});
export type SessionSnapshot = z.output<typeof StoredSession> & {
  subject: string | null;
  companyId: number | null;
};
const EMPTY: SessionSnapshot = Object.freeze({
  tokens: null,
  user: null,
  credentialVersion: "",
  subject: null,
  companyId: null,
});
const listeners = new Set<() => void>();
let cached = EMPTY;
let cachedKey: string | undefined;
let cachedWindow: Window | undefined;
let legacyVersion = 0;
let unsubscribe: (() => void) | undefined;
function json(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function claims(token: string | undefined): {
  subject: string | null;
  companyId: number | null;
} {
  if (!token || typeof window === "undefined")
    return { subject: null, companyId: null };
  try {
    const part = token.split(".")[1];
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const value = z
      .object({
        sub: z.union([z.string(), z.number()]).optional(),
        companyId: z.number().int().positive().optional(),
      })
      .parse(
        JSON.parse(
          window.atob(
            normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
          ),
        ),
      );
    return {
      subject: value.sub === undefined ? null : String(value.sub),
      companyId: value.companyId ?? null,
    };
  } catch {
    return { subject: null, companyId: null };
  }
}
export function getServerSessionSnapshot(): SessionSnapshot {
  return EMPTY;
}
export function getSessionSnapshot(): SessionSnapshot {
  if (typeof window === "undefined") return EMPTY;
  const canonical = readStorage(SESSION_STORAGE_KEY);
  const tokenRaw = readStorage(AUTH_STORAGE_KEYS.tokens);
  const userRaw = readStorage(AUTH_STORAGE_KEYS.user);
  const direct = readStorage(ACCESS_TOKEN_STORAGE_KEY);
  const key = canonical ?? JSON.stringify([tokenRaw, userRaw, direct]);
  if (cachedWindow === window && cachedKey === key) return cached;
  cachedWindow = window;
  cachedKey = key;
  let record: z.output<typeof StoredSession>;
  if (canonical !== null) {
    const parsed = StoredSession.safeParse(json(canonical));
    if (!parsed.success) {
      cached = EMPTY;
      return cached;
    }
    record = parsed.data;
  } else {
    const tokens = AuthTokensSchema.safeParse(json(tokenRaw));
    const user = AuthUserSchema.safeParse(json(userRaw));
    record = {
      tokens: tokens.success
        ? tokens.data
        : direct
          ? { accessToken: direct, refreshToken: "" }
          : null,
      user: user.success ? user.data : null,
      credentialVersion: `legacy-${++legacyVersion}`,
    };
    if (!record.tokens)
      record = { tokens: null, user: null, credentialVersion: "" };
  }
  if (record.tokens) Object.freeze(record.tokens);
  if (record.user) {
    if (record.user.permissions) Object.freeze(record.user.permissions);
    Object.freeze(record.user);
  }
  const identity = claims(record.tokens?.accessToken);
  cached = Object.freeze({
    ...record,
    subject: identity.subject ?? (record.user ? String(record.user.id) : null),
    companyId: identity.companyId ?? record.user?.companyId ?? null,
  });
  return cached;
}
function observeSession() {
  if (unsubscribe || typeof window === "undefined") return;
  unsubscribe = subscribeStorage(() => {
    const before = cached;
    const next = getSessionSnapshot();
    if (before !== next) for (const listener of [...listeners]) listener();
  });
}
export function subscribeSession(listener: () => void): () => void {
  observeSession();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function persistAuthSession(
  tokens: z.output<typeof AuthTokensSchema> | null,
  user: unknown,
): void {
  const previous = getSessionSnapshot();
  const verifiedTokens =
    tokens === null ? null : AuthTokensSchema.parse(tokens);
  const verifiedUser =
    user === null || user === undefined ? null : AuthUserSchema.parse(user);
  const changed =
    verifiedTokens === null ||
    previous.tokens?.accessToken !== verifiedTokens?.accessToken ||
    previous.tokens?.refreshToken !== verifiedTokens?.refreshToken ||
    previous.user?.id !== verifiedUser?.id ||
    previous.user?.companyId !== verifiedUser?.companyId ||
    previous.user?.scope !== verifiedUser?.scope ||
    previous.user?.dashboardType !== verifiedUser?.dashboardType ||
    previous.user?.employeeId !== verifiedUser?.employeeId ||
    previous.user?.employeeLinked !== verifiedUser?.employeeLinked ||
    previous.user?.role !== verifiedUser?.role ||
    JSON.stringify(previous.user?.permissions) !==
      JSON.stringify(verifiedUser?.permissions);
  const credentialVersion = changed
    ? `${Date.now()}-${Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4))).join("-")}`
    : previous.credentialVersion;
  // Publish one canonical record first. Even logout persists a tombstone so stale legacy mirrors cannot revive it.
  writeStorageBatch({
    [SESSION_STORAGE_KEY]: JSON.stringify({
      tokens: verifiedTokens,
      user: verifiedTokens ? verifiedUser : null,
      credentialVersion,
    }),
    [ACCESS_TOKEN_STORAGE_KEY]: verifiedTokens?.accessToken ?? null,
    [AUTH_STORAGE_KEYS.tokens]: verifiedTokens
      ? JSON.stringify(verifiedTokens)
      : null,
    [AUTH_STORAGE_KEYS.user]: verifiedUser
      ? JSON.stringify(verifiedUser)
      : null,
  });
  getSessionSnapshot();
}
export function persistAuthUser(user: unknown): void {
  persistAuthSession(getSessionSnapshot().tokens, user);
}
