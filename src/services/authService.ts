import type {
  AuthSessionRecord,
  AuthSwitchCompanyResponse,
  ChangePasswordRequest,
  DashboardType,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  ResetPasswordRequest,
  TwoFactorSetupResponse,
  UserSecurityFlags,
  VerifyOtpRequest,
  VerifyOtpResponse,
  AuthUser,
  AuthTokens,
} from "@/types";
import { extractBackupCodes } from "@/lib/admin-api";
import { apiRequest, ApiError } from "@/services/api";
import { isLikelyRefreshToken } from "@/utils/token-utils";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function asRecordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is UnknownRecord => Boolean(entry));
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
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
  }

  return undefined;
}

function readSessionId(record: UnknownRecord | null): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of ["id", "session_id", "sessionId", "sid"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function normalizeAuthSessionLabel(record: UnknownRecord) {
  const direct =
    readString(record, [
      "device_name",
      "deviceName",
      "session_name",
      "sessionName",
      "label",
      "title",
      "browser",
      "user_agent",
      "userAgent",
    ]) ?? "";
  if (direct) {
    return direct;
  }

  const browser = readString(record, ["browser"]);
  const os = readString(record, ["os", "platform"]);
  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }
  if (os) {
    return os;
  }

  return "Session";
}

function normalizeAuthSessions(payload: unknown): AuthSessionRecord[] {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const listCandidates = [
    payload,
    root?.sessions,
    root?.items,
    root?.rows,
    rootData?.sessions,
    rootData?.items,
    rootData?.rows,
    rootData,
  ];

  const seen = new Set<string>();
  const sessions: AuthSessionRecord[] = [];

  for (const candidate of listCandidates) {
    for (const record of asRecordArray(candidate)) {
      const id = readSessionId(record);
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      sessions.push({
        id,
        label: normalizeAuthSessionLabel(record),
        isCurrent:
          readBoolean(record, ["is_current", "isCurrent", "current"]) ?? false,
        createdAt: readString(record, ["created_at", "createdAt", "issued_at", "issuedAt"]),
        lastUsedAt: readString(record, ["last_used_at", "lastUsedAt", "updated_at", "updatedAt"]),
        expiresAt: readString(record, ["expires_at", "expiresAt"]),
        ipAddress: readString(record, ["ip_address", "ipAddress"]),
        userAgent: readString(record, ["user_agent", "userAgent"]),
        deviceName: readString(record, ["device_name", "deviceName"]),
        browser: readString(record, ["browser"]),
        os: readString(record, ["os", "platform"]),
        location: readString(record, ["location"]),
        raw: record,
      });
    }
  }

  return sessions;
}

function normalizeDashboardType(value: unknown): DashboardType | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "admin" || normalized === "employee") {
    return normalized
  }

  return undefined
}

function readRole(record: UnknownRecord | null): string | undefined {
  const direct = readString(record, ["role", "user_type"]);
  if (direct) {
    return direct;
  }

  const roles = Array.isArray(record?.roles) ? record.roles : [];
  for (const role of roles) {
    if (typeof role === "string" && role.trim()) {
      return role.trim();
    }

    const roleRecord = asRecord(role);
    const roleName = readString(roleRecord, ["name", "display_name", "displayName", "role"]);
    if (roleName) {
      return roleName;
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
  const rootCompanies = asRecordArray(root?.companies);
  const rootDataCompanies = asRecordArray(rootData?.companies);
  const rootResultCompanies = asRecordArray(rootResult?.companies);
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
    const companyCandidates = [
      asRecord(candidate.company),
      asRecord(candidate.active_company),
      asRecord(root?.company),
      asRecord(root?.active_company),
      asRecord(rootData?.company),
      asRecord(rootData?.active_company),
      asRecord(rootResult?.company),
      asRecord(rootResult?.active_company),
      rootCompanies[0] ?? null,
      rootDataCompanies[0] ?? null,
      rootResultCompanies[0] ?? null,
    ];
    const membershipCandidates = [
      asRecord(candidate.active_company_membership),
      asRecord(root?.active_company_membership),
      asRecord(rootData?.active_company_membership),
      asRecord(rootResult?.active_company_membership),
      rootCompanies[0] ?? null,
      rootDataCompanies[0] ?? null,
      rootResultCompanies[0] ?? null,
    ];
    const fullNameParts = [readString(candidate, ["first_name", "firstName"]), readString(candidate, ["last_name", "lastName"])]
      .filter(Boolean)
      .join(" ")
      .trim();
    const fullName =
      readString(candidate, ["fullName", "full_name", "name"]) ??
      (fullNameParts || (email ? email.split("@")[0]?.replace(/[._-]+/g, " ").trim() : undefined));

    if ((typeof id === "string" || typeof id === "number") && email && fullName) {
      const companyRecord = asRecord(candidate.company);
      const resolvedCompanyRecord =
        companyCandidates.find((entry) => entry && (readString(entry, ["name", "company_name", "companyName"]) || readNumber(entry, ["id", "company_id", "companyId"]))) ??
        companyRecord;
      const resolvedMembershipRecord =
        membershipCandidates.find((entry) => entry && (readString(entry, ["employee_no", "user_no"]) || readNumber(entry, ["employee_id", "employeeId", "membershipId"]))) ??
        null;
      const employeeId =
        readString(candidate, ["employee_no", "employeeId", "employee_id", "user_no"]) ??
        readString(resolvedMembershipRecord, ["employee_no", "employeeId", "employee_id", "user_no"]) ??
        (() => {
          const numericEmployeeId =
            readNumber(candidate, ["employee_id", "employeeId"]) ??
            readNumber(resolvedMembershipRecord, ["employee_id", "employeeId", "employeeId"]);
          return numericEmployeeId !== null && numericEmployeeId !== undefined
            ? String(numericEmployeeId)
            : undefined;
        })();
      return {
        id,
        fullName,
        email,
        role: readRole(candidate),
        dashboardType:
          normalizeDashboardType(candidate.dashboard_type) ??
          normalizeDashboardType(candidate.dashboardType) ??
          normalizeDashboardType(root?.dashboard_type) ??
          normalizeDashboardType(root?.dashboardType) ??
          normalizeDashboardType(rootData?.dashboard_type) ??
          normalizeDashboardType(rootData?.dashboardType) ??
          normalizeDashboardType(rootResult?.dashboard_type) ??
          normalizeDashboardType(rootResult?.dashboardType),
        employeeId,
        requiresPasswordChange:
          readBoolean(candidate, [
            "requiresPasswordChange",
            "requires_password_change",
          ]) ??
          readBoolean(root, [
            "requiresPasswordChange",
            "requires_password_change",
          ]) ??
          readBoolean(rootData, [
            "requiresPasswordChange",
            "requires_password_change",
          ]) ??
          readBoolean(rootResult, [
            "requiresPasswordChange",
            "requires_password_change",
          ]),
        companyId:
          readNumber(candidate, ["companyId", "company_id"]) ??
          readNumber(resolvedCompanyRecord, ["companyId", "company_id", "id"]),
        companyName:
          readString(candidate, ["companyName", "company_name", "organization_name"]) ??
          readString(resolvedCompanyRecord, ["companyName", "company_name", "name", "display_name"]),
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
    readString(root, ["tempToken", "temp_token", "temporary_token", "temporaryToken"]) ??
    readString(rootData, ["tempToken", "temp_token", "temporary_token", "temporaryToken"]) ??
    readString(rootResult, ["tempToken", "temp_token", "temporary_token", "temporaryToken"]);

  const tokens = normalizeTokens(payload);
  const user = normalizeUser(payload);
  const twoFactorKeys = [
    "requiresOtp",
    "requires_otp",
    "requires2FA",
    "requires_2fa",
    "twoFactorRequired",
    "two_factor_required",
    "mfaRequired",
    "mfa_required",
  ] as const;
  const explicitRequiresOtp =
    readBoolean(root, [...twoFactorKeys]) ??
    readBoolean(rootData, [...twoFactorKeys]) ??
    readBoolean(rootResult, [...twoFactorKeys]);

  // Login step returns a temporary token when 2FA is required (no final JWT pair yet).
  const requiresOtp = explicitRequiresOtp === true || Boolean(tempToken && !tokens);
  const requiresPasswordChange =
    readBoolean(root, ["requiresPasswordChange", "requires_password_change"]) ??
    readBoolean(rootData, ["requiresPasswordChange", "requires_password_change"]) ??
    readBoolean(rootResult, ["requiresPasswordChange", "requires_password_change"]) ??
    user?.requiresPasswordChange ??
    false;
  const requiresEmailVerification =
    readBoolean(root, ["requiresEmailVerification", "requires_email_verification"]) ??
    readBoolean(rootData, ["requiresEmailVerification", "requires_email_verification"]) ??
    readBoolean(rootResult, ["requiresEmailVerification", "requires_email_verification"]) ??
    false;
  const requires2FASetup =
    readBoolean(root, ["requires2FASetup", "requires_2fa_setup"]) ??
    readBoolean(rootData, ["requires2FASetup", "requires_2fa_setup"]) ??
    readBoolean(rootResult, ["requires2FASetup", "requires_2fa_setup"]) ??
    false;
  const message =
    readString(root, ["message"]) ??
    readString(rootData, ["message"]) ??
    readString(rootResult, ["message"]);

  if (user) {
    user.requiresPasswordChange = requiresPasswordChange;
  }

  return {
    requiresOtp,
    tempToken,
    tokens,
    user,
    requiresPasswordChange,
    requiresEmailVerification,
    requires2FASetup,
    message,
  };
}

function normalizeVerifyOtpResponse(payload: unknown): VerifyOtpResponse {
  const tokens = normalizeTokens(payload);
  let user = normalizeUser(payload);

  // Complete-login may return a minimal user { id, email } without names.
  if (!user && tokens) {
    const root = asRecord(payload);
    const rootData = asRecord(root?.data);
    const candidate =
      asRecord(root?.user) ?? asRecord(rootData?.user) ?? rootData ?? root;
    const id = candidate?.id ?? candidate?.user_id;
    const email = readString(candidate, ["email"]);
    if ((typeof id === "string" || typeof id === "number") && email) {
      user = {
        id,
        email,
        fullName:
          readString(candidate, ["fullName", "full_name", "name"]) ??
          email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ??
          email,
      };
    }
  }

  if (!tokens) {
    throw new Error("2FA verification response is missing session tokens.");
  }
  if (!user) {
    throw new Error("2FA verification response is missing user profile data.");
  }

  return { tokens, user };
}

function normalizeSwitchCompanyResponse(payload: unknown): AuthSwitchCompanyResponse {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const accessToken =
    readString(root, ["access_token", "accessToken", "token"]) ??
    readString(rootData, ["access_token", "accessToken", "token"]);

  if (!accessToken) {
    throw new Error("Company switch response did not include a new access token.");
  }

  return {
    accessToken,
    companyId:
      readNumber(root, ["company_id", "companyId"]) ??
      readNumber(rootData, ["company_id", "companyId"]),
    companyName:
      readString(root, ["company_name", "companyName"]) ??
      readString(rootData, ["company_name", "companyName"]),
  };
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
    // Backend Complete2FALoginDto accepts tempToken + code (login flow).
    const response = await apiRequest<unknown>("/api/auth/2fa/complete-login", {
      method: "POST",
      body: {
        tempToken: payload.tempToken,
        code: payload.code,
      },
    });
    return normalizeVerifyOtpResponse(response);
  },

  async setupTwoFactor(token: string): Promise<TwoFactorSetupResponse> {
    const response = await apiRequest<unknown>("/api/users/2fa/setup", {
      method: "POST",
      token,
    });
    const root = asRecord(response);
    const data = asRecord(root?.data) ?? root;
    const secret = readString(data, ["secret", "base32", "base32Secret"]);
    if (!secret) {
      throw new Error("2FA setup response did not include a secret.");
    }
    return {
      secret,
      qrCode: readString(data, ["qrCode", "qr_code", "qr"]),
      otpAuthUrl: readString(data, ["otpAuthUrl", "otp_auth_url", "otpauth_url", "uri"]),
    };
  },

  async verifyTwoFactor(token: string, code: string) {
    return apiRequest<unknown>("/api/users/2fa/verify", {
      method: "POST",
      token,
      body: { token: code },
    });
  },

  async disableTwoFactor(token: string, code: string) {
    return apiRequest<unknown>("/api/users/2fa/disable", {
      method: "POST",
      token,
      body: { token: code },
    });
  },

  async regenerateBackupCodes(token: string, code: string): Promise<string[]> {
    const response = await apiRequest<unknown>(
      "/api/users/2fa/backup-codes/regenerate",
      {
        method: "POST",
        token,
        body: { token: code.trim() },
      },
    );
    return extractBackupCodes(response);
  },

  async getSecurityFlags(token: string): Promise<UserSecurityFlags> {
    const response = await apiRequest<unknown>("/api/users/me", {
      method: "GET",
      token,
    });
    const root = asRecord(response);
    const candidates = [
      asRecord(root?.user),
      asRecord(asRecord(root?.data)?.user),
      asRecord(root?.data),
      root,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const hasTwoFactorField =
        "is_two_factor_enabled" in candidate ||
        "isTwoFactorEnabled" in candidate ||
        "two_factor_enabled" in candidate ||
        "twoFactorEnabled" in candidate ||
        "is_2fa_enabled" in candidate ||
        "is2faEnabled" in candidate ||
        "is2FAEnabled" in candidate ||
        "mfa_enabled" in candidate ||
        "mfaEnabled" in candidate ||
        "totp_enabled" in candidate ||
        "totpEnabled" in candidate ||
        "two_factor_status" in candidate ||
        "twoFactorStatus" in candidate;
      const hasEmailField =
        "is_email_verified" in candidate ||
        "isEmailVerified" in candidate ||
        "email_verified" in candidate ||
        "emailVerified" in candidate;
      if (!hasTwoFactorField && !hasEmailField) continue;
      return {
        isTwoFactorEnabled:
          readBoolean(candidate, [
            "is_two_factor_enabled",
            "isTwoFactorEnabled",
            "two_factor_enabled",
            "twoFactorEnabled",
            "is_2fa_enabled",
            "is2faEnabled",
            "is2FAEnabled",
            "mfa_enabled",
            "mfaEnabled",
            "totp_enabled",
            "totpEnabled",
          ]) ?? false,
        isEmailVerified:
          readBoolean(candidate, [
            "is_email_verified",
            "isEmailVerified",
            "email_verified",
            "emailVerified",
          ]) ?? false,
      };
    }
    return { isTwoFactorEnabled: false, isEmailVerified: false };
  },

  async resendVerification(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email is required.");
    }
    await apiRequest<unknown>("/api/auth/resend-verification", {
      method: "POST",
      body: { email: normalizedEmail },
    });
  },

  async verifyEmail(token: string): Promise<void> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new Error("Verification token is missing.");
    }
    const searchParams = new URLSearchParams({ token: normalizedToken });
    await apiRequest<unknown>(`/api/auth/verify-email?${searchParams.toString()}`, {
      method: "GET",
    });
  },

  async logoutAll(token: string): Promise<void> {
    const accessToken = token.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    await apiRequest<unknown>("/api/auth/logout-all", {
      method: "POST",
      token: accessToken,
    });
  },

  async listSessions(token: string): Promise<AuthSessionRecord[]> {
    const accessToken = token.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    const response = await apiRequest<unknown>("/api/auth/sessions", {
      method: "GET",
      token: accessToken,
    });
    return normalizeAuthSessions(response);
  },

  async revokeSession(token: string, sessionId: string): Promise<void> {
    const accessToken = token.trim();
    const normalizedSessionId = sessionId.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }
    await apiRequest<unknown>(`/api/auth/sessions/${encodeURIComponent(normalizedSessionId)}`, {
      method: "DELETE",
      token: accessToken,
    });
  },

  async switchCompany(token: string, companyId: number): Promise<AuthSwitchCompanyResponse> {
    const accessToken = token.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new Error("A valid company id is required.");
    }
    const response = await apiRequest<unknown>("/api/auth/switch-company", {
      method: "POST",
      token: accessToken,
      body: { company_id: companyId },
    });
    return normalizeSwitchCompanyResponse(response);
  },

  async refresh(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiRequest<unknown>("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
    });

    const tokens = normalizeTokens(response);
    const user = normalizeUser(response);
    if (!tokens) {
      throw new Error("Refresh response did not contain valid tokens.");
    }

    return { tokens, user };
  },

  changePassword(payload: ChangePasswordRequest, token: string) {
    return apiRequest<void>("/api/users/me/change-password", {
      method: "POST",
      body: {
        old_password: payload.currentPassword,
        new_password: payload.newPassword,
      },
      token,
    });
  },

  /**
   * Request a password-reset email.
   * POST /api/auth/forgot-password  body: { email }
   * Always resolves on success; backends may return 200 with an empty body.
   */
  async forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required.");
    }
    await apiRequest<unknown>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  },

  /**
   * Complete password reset with the email token.
   * POST /api/auth/reset-password  body: { token, new_password }
   * 410 → token expired; 400 → validation error.
   */
  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    const token = payload.token.trim();
    const newPassword = payload.new_password;
    if (!token) {
      throw new Error("Reset token is missing. Open the link from your email again.");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    try {
      await apiRequest<unknown>("/api/auth/reset-password", {
        method: "POST",
        body: {
          token,
          new_password: newPassword,
        },
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 410) {
        throw new ApiError(
          error.message || "This reset link has expired or is no longer valid.",
          410,
          error.details
        );
      }
      throw error;
    }
  },

  async getCurrentUser(token: string) {
    const response = await apiRequest<unknown>("/api/users/me", {
      method: "GET",
      token,
    });

    const user = normalizeUser(response);
    if (!user) {
      throw new Error("Current user response is missing required profile fields.");
    }

    return user;
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
