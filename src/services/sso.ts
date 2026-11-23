import { z } from "zod";
import { apiRequest } from "./api";
import { authService, normalizeLoginResponse } from "./authService";
import { withAuthSessionLock } from "@/lib/auth-session-lock";
import {
  readStoredSessionTokens,
  persistSessionTokens,
  readJwtExpiry,
} from "@/lib/session-client";
import { ApiResponseSchema } from "@/lib/request-json";

export const securitySettingsPath =
  "/dashboard/settings?section=security&tab=devices";
const transactionKey = "hrms.sso.request";
const flowSchema = z.object({
  purpose: z.enum(["login", "link", "test"]),
  browser_key: z.string(),
  state: z.string(),
});

export async function startBrowserSso(
  purpose: "login" | "link" | "test",
  fields: { company?: string; password?: string } = {},
  token?: string,
) {
  const browserKey = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const result = await apiRequest(
    "/api/auth/sso/" + purpose + "/start",
    z.object({ authorization_url: z.url() }),
    { method: "POST", token, body: { ...fields, browser_key: browserKey } },
  );
  const url = new URL(result.authorization_url);
  const state = url.searchParams.get("state");
  if (url.protocol !== "https:" || !state)
    throw new Error("The provider returned an invalid sign-in destination.");
  sessionStorage.setItem(
    transactionKey,
    JSON.stringify({ purpose, browser_key: browserKey, state }),
  );
  window.location.assign(url.href);
}

export async function finishBrowserSso() {
  const query = new URLSearchParams(location.search);
  history.replaceState(history.state, "", location.pathname);
  const stored = sessionStorage.getItem(transactionKey);
  sessionStorage.removeItem(transactionKey);
  if (!stored || query.has("error"))
    throw new Error(
      "Company sign-in was cancelled or expired. Start again from the sign-in page.",
    );
  const flow = flowSchema.parse(JSON.parse(stored));
  const code = query.get("code");
  if (!code || query.get("state") !== flow.state)
    throw new Error("This sign-in request is no longer active in this tab.");
  const token =
    flow.purpose === "login"
      ? undefined
      : await withAuthSessionLock(async () => {
          const current = readStoredSessionTokens();
          if (!current.accessToken)
            throw new Error(
              "Sign in first and restart your provider test or account link.",
            );
          if (
            (readJwtExpiry(current.accessToken) ?? 0) > Date.now() + 5000 ||
            !current.refreshToken
          )
            return current.accessToken;
          const refreshed = await authService.refresh(current.refreshToken);
          if (readStoredSessionTokens().refreshToken !== current.refreshToken)
            throw new Error("The account changed. Restart the request.");
          persistSessionTokens(
            refreshed.tokens.accessToken,
            refreshed.tokens.refreshToken,
            refreshed.user,
          );
          return refreshed.tokens.accessToken;
        });
  const raw = await apiRequest(
    "/api/auth/sso/" + flow.purpose + "/finish",
    ApiResponseSchema,
    {
      method: "POST",
      token,
      body: {
        code,
        state: flow.state,
        browser_key: flow.browser_key,
        iss: query.get("iss") ?? undefined,
      },
    },
  );
  return flow.purpose === "login"
    ? ({ purpose: flow.purpose, login: normalizeLoginResponse(raw) } as const)
    : ({ purpose: flow.purpose } as const);
}
