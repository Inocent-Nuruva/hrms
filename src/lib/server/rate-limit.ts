import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError, errorResponse } from "./http";

export interface RateLimitPolicy {
  name: string;
  perMinute: number;
  perDay: number;
  globalPerMinute: number;
  globalPerDay: number;
}

type Counter = { count: number; expiresAt: number };
const localCounters = new Map<string, Counter>();
const MAX_LOCAL_KEYS = 10_000;

// All checks/increments occur atomically across replicas. Denials consume no new slots.
const SCRIPT = `
local retry = 0
for i = 1, #KEYS do
  local current = tonumber(redis.call('GET', KEYS[i]) or '0')
  if current >= tonumber(ARGV[(i-1)*2+1]) then
    local ttl = redis.call('PTTL', KEYS[i])
    if ttl < 1 then ttl = tonumber(ARGV[(i-1)*2+2]) end
    retry = math.max(retry, ttl)
  end
end
if retry > 0 then return {0, retry} end
for i = 1, #KEYS do
  local current = redis.call('INCR', KEYS[i])
  if current == 1 then redis.call('PEXPIRE', KEYS[i], ARGV[(i-1)*2+2]) end
end
return {1, 0}
`;

export class RateLimitError extends HttpError {
  constructor(public readonly retryAfterSeconds: number) {
    super(429, "Too many requests. Please try again later.");
  }
}

/** Only use an IP header if the deployment's trusted proxy strips/replaces client copies. */
export function publicRateLimitIdentity(request: Request): string {
  const trustedHeader = process.env.RATE_LIMIT_TRUSTED_IP_HEADER?.trim();
  if (!trustedHeader) return "anonymous-shared";
  const value = request.headers.get(trustedHeader)?.trim();
  if (!value || value.length > 128 || value.includes(",")) return "anonymous-shared";
  return `public:${value}`;
}

export async function enforceRateLimit(policy: RateLimitPolicy, identity: string): Promise<void> {
  const now = Date.now();
  const digest = createHash("sha256").update(identity).digest("hex");
  const rules = [
    { scope: digest, duration: 60_000, limit: policy.perMinute },
    { scope: digest, duration: 86_400_000, limit: policy.perDay },
    { scope: "global", duration: 60_000, limit: policy.globalPerMinute },
    { scope: "global", duration: 86_400_000, limit: policy.globalPerDay },
  ].map((rule) => ({
    key: `hrms:{${policy.name}}:${rule.scope}:${rule.duration}:${Math.floor(now / rule.duration)}`,
    limit: rule.limit,
    ttl: rule.duration - (now % rule.duration),
  }));
  const restUrl = process.env.RATE_LIMIT_REDIS_REST_URL?.trim();
  const restToken = process.env.RATE_LIMIT_REDIS_REST_TOKEN?.trim();
  if (restUrl && restToken) {
    const url = new URL(restUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new HttpError(503, "Rate limiting is not configured correctly.");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${restToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", SCRIPT, rules.length, ...rules.map((rule) => rule.key),
        ...rules.flatMap((rule) => [rule.limit, rule.ttl])]),
      signal: AbortSignal.timeout(3_000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(503, "Rate limiting is temporarily unavailable.");
    }
    const parsed = z.object({ result: z.tuple([z.union([z.literal(0), z.literal(1)]),
      z.number().int().nonnegative()]) }).safeParse(await response.json());
    if (!parsed.success) throw new HttpError(503, "Rate limiting is temporarily unavailable.");
    if (parsed.data.result[0] === 0) {
      throw new RateLimitError(Math.max(1, Math.ceil(parsed.data.result[1] / 1_000)));
    }
    return;
  }
  if (process.env.NODE_ENV === "production" || restUrl || restToken) {
    throw new HttpError(503, "Shared rate limiting must be configured before using this service.");
  }
  // Development/test only. Production never silently falls back to per-process counters.
  for (const [key, counter] of localCounters) {
    if (counter.expiresAt <= now) localCounters.delete(key);
  }
  let retry = 0;
  for (const rule of rules) {
    const counter = localCounters.get(rule.key);
    if (counter && counter.count >= rule.limit) retry = Math.max(retry, counter.expiresAt - now);
  }
  if (retry > 0) throw new RateLimitError(Math.max(1, Math.ceil(retry / 1_000)));
  const missingKeys = rules.filter((rule) => !localCounters.has(rule.key)).length;
  if (localCounters.size + missingKeys > MAX_LOCAL_KEYS) {
    throw new HttpError(503, "Rate limiting capacity is temporarily unavailable.");
  }
  for (const rule of rules) {
    const counter = localCounters.get(rule.key);
    localCounters.set(rule.key, { count: (counter?.count ?? 0) + 1, expiresAt: now + rule.ttl });
  }
}

export function withRateLimit(
  policy: RateLimitPolicy,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      await enforceRateLimit(policy, publicRateLimitIdentity(request));
      return await handler(request);
    } catch (error) {
      const response = errorResponse(error);
      if (error instanceof RateLimitError) {
        response.headers.set("Retry-After", String(error.retryAfterSeconds));
      }
      return response;
    }
  };
}
