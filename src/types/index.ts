export type UserRole = "employee" | "hr" | "admin";
export type DashboardType = "admin" | "employee"
export type AuthScope = "platform" | "company"

export interface AuthUser {
  id: string | number;
  employeeId?: string;
  fullName: string;
  email: string;
  role?: UserRole | string;
  scope?: AuthScope;
  dashboardType?: DashboardType;
  companyId?: number;
  companyName?: string;
  requiresPasswordChange?: boolean;
  permissions?: string[];
  /** True when the API response explicitly included roles/permissions for this session. */
  accessContextResolved?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  requiresOtp: boolean;
  tempToken?: string;
  tokens?: AuthTokens;
  user?: AuthUser;
  /** Tenant boundary returned by the login API. */
  scope?: AuthScope;
  /** Authoritative dashboard shell returned by the login API. */
  dashboardType?: DashboardType;
  requiresPasswordChange?: boolean;
  requiresEmailVerification?: boolean;
  requires2FASetup?: boolean;
  message?: string;
}

export interface VerifyOtpRequest {
  tempToken: string;
  code: string;
}

export interface VerifyOtpResponse {
  tokens: AuthTokens;
  user: AuthUser;
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
  user?: AuthUser;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/** POST /api/auth/reset-password — ResetPasswordDto */
export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode?: string;
  otpAuthUrl?: string;
}

export interface UserSecurityFlags {
  isTwoFactorEnabled: boolean;
  isEmailVerified: boolean;
}

export interface AuthSessionRecord {
  id: string;
  label: string;
  isCurrent: boolean;
  createdAt?: string;
  lastUsedAt?: string;
  expiresAt?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  location?: string;
  raw: Record<string, unknown>;
}

export interface AuthSwitchCompanyResponse {
  accessToken: string;
  scope?: AuthScope;
  dashboardType?: DashboardType;
  companyId?: number;
  companyName?: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  route: string;
}

export interface ApiErrorResponse {
  message: string;
  statusCode?: number;
  details?: Record<string, string | string[]>;
}
