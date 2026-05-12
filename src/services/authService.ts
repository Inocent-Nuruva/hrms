import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  AuthUser,
  AuthTokens,
} from "@/types";
import { apiRequest } from "@/services/api";
import { isLikelyRefreshToken } from "@/utils/token-utils";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function readString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function readNumber(record: UnknownRecord | null, keys: string[]): number | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function readBoolean(record: UnknownRecord | null, keys: string[]): boolean | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function normalizeTokens(payload: unknown): AuthTokens | undefined {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);
  const tokenCandidates = [
    root,
    asRecord(root?.tokens),
    rootData,
    asRecord(rootData?.tokens),
    rootResult,
    asRecord(rootResult?.tokens),
  ];

  for (const candidate of tokenCandidates) {
    const accessToken = readString(candidate, ["accessToken", "access_token", "token"]);
    const refreshToken = readString(candidate, ["refreshToken", "refresh_token"]);

    if (
      accessToken &&
      refreshToken &&
      accessToken !== refreshToken &&
      !isLikelyRefreshToken(accessToken, refreshToken)
    ) {
      return { accessToken, refreshToken };
    }
  }

  return undefined;
}

function normalizeUser(payload: unknown): AuthUser | undefined {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);
  const userCandidates = [
    asRecord(root?.user),
    asRecord(rootData?.user),
    asRecord(rootResult?.user),
    root,
    rootData,
    rootResult,
  ];

  for (const candidate of userCandidates) {
    if (!candidate) {
      continue;
    }

    const id = candidate.id ?? candidate.user_id;
    const email = readString(candidate, ["email"]);
    const fullName =
      readString(candidate, ["fullName", "full_name", "name"]) ??
      [readString(candidate, ["first_name", "firstName"]), readString(candidate, ["last_name", "lastName"])]
        .filter(Boolean)
        .join(" ")
        .trim();

    if ((typeof id === "string" || typeof id === "number") && email && fullName) {
      const companyRecord = asRecord(candidate.company);
      return {
        id,
        fullName,
        email,
        role: readString(candidate, ["role", "user_type"]),
        employeeId: readString(candidate, ["employeeId", "employee_id", "user_no"]),
        companyId: readNumber(candidate, ["companyId", "company_id"]),
        companyName:
          readString(candidate, ["companyName", "company_name", "organization_name"]) ??
          readString(companyRecord, ["name", "company_name", "display_name"]),
      };
    }
  }

  return undefined;
}

function normalizeLoginResponse(payload: unknown): LoginResponse {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);

  const tempToken =
    readString(root, ["tempToken", "temp_token"]) ??
    readString(rootData, ["tempToken", "temp_token"]) ??
    readString(rootResult, ["tempToken", "temp_token"]);

  const tokens = normalizeTokens(payload);
  const user = normalizeUser(payload);
  const explicitRequiresOtp = readBoolean(root, [
    "requiresOtp",
    "requires_otp",
    "requires2FA",
    "requires_2fa",
    "twoFactorRequired",
  ]);

  const requiresOtp = explicitRequiresOtp ?? Boolean(tempToken && !tokens);

  return {
    requiresOtp,
    tempToken,
    tokens,
    user,
  };
}

function normalizeVerifyOtpResponse(payload: unknown): VerifyOtpResponse {
  const tokens = normalizeTokens(payload);
  const user = normalizeUser(payload);

  if (!tokens || !user) {
    throw new Error("2FA verification response is missing session data.");
  }

  return { tokens, user };
}

export const authService = {
  async login(payload: LoginRequest) {
    const body = {
      email: payload.email,
      password: payload.password,
    };

    const response = await apiRequest<unknown>("/api/auth/login", {
      method: "POST",
      body,
    });
    return normalizeLoginResponse(response);
  },

  async verifyOtp(payload: VerifyOtpRequest) {
    const response = await apiRequest<unknown>("/api/auth/2fa/complete-login", {
      method: "POST",
      body: payload,
    });
    return normalizeVerifyOtpResponse(response);
  },

  async refresh(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiRequest<unknown>("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
    });

    const tokens = normalizeTokens(response);
    if (!tokens) {
      throw new Error("Refresh response did not contain valid tokens.");
    }

    return { tokens };
  },

  changePassword(payload: ChangePasswordRequest, token: string) {
    return apiRequest<void>("/api/auth/change-password", {
      method: "POST",
      body: payload,
      token,
    });
  },

  getCurrentUser(token: string) {
    return apiRequest<AuthUser>("/api/auth/me", {
      method: "GET",
      token,
    });
  },

  logout(tokens?: AuthTokens) {
    if (!tokens?.accessToken || !tokens.refreshToken) {
      return Promise.resolve();
    }

    return apiRequest<void>("/api/auth/logout", {
      method: "POST",
      token: tokens.accessToken,
      body: { refresh_token: tokens.refreshToken },
    }).catch(() => undefined);
  },
};
