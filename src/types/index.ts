export type UserRole = "employee" | "hr" | "admin";

export interface AuthUser {
  id: string | number;
  employeeId?: string;
  fullName: string;
  email: string;
  role?: UserRole | string;
  companyId?: number;
  companyName?: string;
  requiresPasswordChange?: boolean;
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
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
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
