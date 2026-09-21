import { z } from "zod"

const apiBaseUrlSchema = z
  .string()
  .trim()
  .default("http://localhost:8888")
  .refine(
    (value) => {
      if (value === "" || value === "/api") return true
      try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) URL, /api, or empty." },
  )

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/api\/?$/i, "").replace(/\/$/, "")
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().default("HRMS"),
  NEXT_PUBLIC_API_BASE_URL: apiBaseUrlSchema,
  NEXT_PUBLIC_USE_MOCK_AUTH: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  COUNTRIES_API_BASE_URL: z.url().default("https://countriesnow.space/api/v0.1"),

  NEXT_PUBLIC_MOCK_AUTH_DELAY_MS: z.coerce.number().positive().default(1500),
  NEXT_PUBLIC_SESSION_CHECK_INTERVAL_MS: z.coerce.number().positive().default(30_000),
  NEXT_PUBLIC_TOKEN_REFRESH_WINDOW_MS: z.coerce.number().positive().default(60_000),
  NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL_MS: z.coerce.number().positive().default(60_000),
  NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS: z.coerce.number().nonnegative().default(20_000),
  NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS: z.coerce.number().nonnegative().default(60_000),
  NEXT_PUBLIC_DEVICE_ACTION_TIMEOUT_MS: z.coerce.number().positive().default(20_000),
  NEXT_PUBLIC_DEVICE_BULK_ACTION_TIMEOUT_MS: z.coerce.number().positive().default(90_000),
  NEXT_PUBLIC_MAX_PAGE_SIZE: z.coerce.number().positive().default(100),
})

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
  COUNTRIES_API_BASE_URL: process.env.COUNTRIES_API_BASE_URL,

  NEXT_PUBLIC_MOCK_AUTH_DELAY_MS: process.env.NEXT_PUBLIC_MOCK_AUTH_DELAY_MS,
  NEXT_PUBLIC_SESSION_CHECK_INTERVAL_MS: process.env.NEXT_PUBLIC_SESSION_CHECK_INTERVAL_MS,
  NEXT_PUBLIC_TOKEN_REFRESH_WINDOW_MS: process.env.NEXT_PUBLIC_TOKEN_REFRESH_WINDOW_MS,
  NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL_MS: process.env.NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL_MS,
  NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS: process.env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
  NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS: process.env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS,
  NEXT_PUBLIC_DEVICE_ACTION_TIMEOUT_MS: process.env.NEXT_PUBLIC_DEVICE_ACTION_TIMEOUT_MS,
  NEXT_PUBLIC_DEVICE_BULK_ACTION_TIMEOUT_MS: process.env.NEXT_PUBLIC_DEVICE_BULK_ACTION_TIMEOUT_MS,
  NEXT_PUBLIC_MAX_PAGE_SIZE: process.env.NEXT_PUBLIC_MAX_PAGE_SIZE,
})

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`)
}

export const env = {
  ...parsed.data,
  NEXT_PUBLIC_API_BASE_URL: normalizeApiBaseUrl(parsed.data.NEXT_PUBLIC_API_BASE_URL),
  COUNTRIES_API_BASE_URL: parsed.data.COUNTRIES_API_BASE_URL.replace(/\/$/, ""),
  IS_DEV: parsed.data.NODE_ENV === "development",
  IS_PROD: parsed.data.NODE_ENV === "production",
}
