import { createContext, createElement, useState, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, saveTokens, clearTokens, loadTokensFromStorage, AuthTokens, AuthUser } from '../lib/api';
import * as SecureStore from '../lib/secure-store'; // use wrapper (fixes ExpoSecureStore.default.setValueWithKeyAsync on web)
import {
  authenticateWithBiometrics as promptBiometricAuth,
  getBiometricStatus,
  setBiometricEnabled as storeBiometricEnabled,
} from '../lib/biometrics';
import { normalizeSingle } from '../lib/api';
import { unregisterRemotePushDeviceAsync } from '../lib/notification-settings';

type AnyRecord = Record<string, unknown>;
type AuthEmployee = AnyRecord & {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
};

interface AuthState {
  isLoading: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  hasStoredSession: boolean;
  user: AuthUser | null;
  employee: AuthEmployee | null;
  error: string | null;
  requiresOtp: boolean;
  tempToken: string | null;
  biometricEnabled: boolean;
  biometricEnrolled: boolean;
  biometricLocked: boolean;
  biometricSupported: boolean;
  biometricTypeLabel: string;
}

function useProvideAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isSubmitting: false,
    isAuthenticated: false,
    hasStoredSession: false,
    user: null,
    employee: null,
    error: null,
    requiresOtp: false,
    tempToken: null,
    biometricEnabled: false,
    biometricEnrolled: false,
    biometricLocked: false,
    biometricSupported: false,
    biometricTypeLabel: 'Fingerprint',
  });

  const resetOtp = useCallback(() => {
    setState((s) => ({
      ...s,
      requiresOtp: false,
      tempToken: null,
      error: null,
      isLoading: false,
      isSubmitting: false,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const loadSession = useCallback(async ({ skipBiometricLock = false, quiet = false }: { skipBiometricLock?: boolean; quiet?: boolean } = {}) => {
    if (!quiet) setState((s) => ({ ...s, isLoading: true }));
    const [tokens, biometricStatus] = await Promise.all([
      loadTokensFromStorage(),
      getBiometricStatus(),
    ]);
    if (!tokens) {
      setState((s) => ({
        ...s,
        isLoading: false,
        isSubmitting: quiet ? s.isSubmitting : false,
        isAuthenticated: false,
        hasStoredSession: biometricStatus.enabled,
        user: null,
        employee: null,
        biometricEnabled: biometricStatus.enabled,
        biometricEnrolled: biometricStatus.enrolled,
        biometricLocked: false,
        biometricSupported: biometricStatus.supported,
        biometricTypeLabel: biometricStatus.label,
      }));
      return;
    }

    try {
      // Try to hydrate current user + employee
      const [userPayload, empPayload] = await Promise.all([
        api.getCurrentUser().catch(() => null),
        api.getCurrentEmployee().catch(() => null),
      ]);

      const user = extractUser(userPayload);
      const normalizedEmployee = await normalizeSingle(empPayload);
      const employee =
        normalizedEmployee && typeof normalizedEmployee === 'object'
          ? (normalizedEmployee as AuthEmployee)
          : null;

      // Fallbacks for name
      const empName = employee ? [employee.first_name, employee.last_name, employee.full_name].filter(Boolean).join(' ') : '';
      const finalUser: AuthUser = user || {
        id: 'me',
        fullName: empName || 'Employee',
        email: employee?.email || '',
      };

      // Persist lightly
      if (user) await SecureStore.setItemAsync('hrms.user', JSON.stringify(user)).catch(() => {});
      if (employee) await SecureStore.setItemAsync('hrms.employee', JSON.stringify(employee)).catch(() => {});

      const biometricLocked = biometricStatus.enabled && !skipBiometricLock;

      setState((s) => ({
        isLoading: false,
        isSubmitting: quiet ? s.isSubmitting : false,
        isAuthenticated: !biometricLocked,
        hasStoredSession: true,
        user: finalUser,
        employee,
        error: null,
        requiresOtp: false,
        tempToken: null,
        biometricEnabled: biometricStatus.enabled,
        biometricEnrolled: biometricStatus.enrolled,
        biometricLocked,
        biometricSupported: biometricStatus.supported,
        biometricTypeLabel: biometricStatus.label,
      }));
    } catch {
      // Invalid token probably
      await clearTokens();
      setState((s) => ({
        isLoading: false,
        isSubmitting: quiet ? s.isSubmitting : false,
        isAuthenticated: false,
        hasStoredSession: biometricStatus.enabled,
        user: null,
        employee: null,
        error: null,
        requiresOtp: false,
        tempToken: null,
        biometricEnabled: biometricStatus.enabled,
        biometricEnrolled: biometricStatus.enrolled,
        biometricLocked: false,
        biometricSupported: biometricStatus.supported,
        biometricTypeLabel: biometricStatus.label,
      }));
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isSubmitting: true, error: null }));
    try {
      const res: AnyRecord = await api.login(email.trim(), password) as AnyRecord;

      // Align strictly with the provided OpenAPI spec examples for /api/auth/login
      const userFromResponse = (res?.user as AnyRecord) || ((res?.data as AnyRecord)?.user as AnyRecord) || {};
      const requiresOtp = !!(
        res?.requires_2fa ||
        userFromResponse.requires_2fa ||
        res?.requiresOtp ||
        res?.requires_otp ||
        res?.temp_token ||
        res?.tempToken
      );
      const tempToken = (res?.temp_token as string) || (res?.tempToken as string) || null;

      if (requiresOtp && tempToken) {
        setState((s) => ({
          ...s,
          requiresOtp: true,
          tempToken: tempToken as string,
          error: null,
        }));
        return { requiresOtp: true };
      }

      if (requiresOtp) {
        // 2FA required but temp token may be implicit or the client will ask for code in the next step
        setState((s) => ({
          ...s,
          requiresOtp: true,
          tempToken: tempToken as string | null,
          error: null,
        }));
        return { requiresOtp: true };
      }

      // Direct login success (tokens + user) per spec examples
      const tokens = extractTokens(res);
      if (tokens) {
        await saveTokens(tokens);
      }

      setState((s) => ({
        ...s,
        hasStoredSession: !!tokens,
        requiresOtp: false,
        tempToken: null,
      }));

      await loadSession({ skipBiometricLock: true, quiet: true });
      return { requiresOtp: false };
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Login failed. Check your credentials.';
      setState((s) => ({ ...s, error: msg }));
      throw e;
    } finally {
      setState((s) => ({ ...s, isSubmitting: false }));
    }
  }, [loadSession]);

  const verifyOtp = useCallback(async (code: string) => {
    if (!state.tempToken) throw new Error('No OTP session. Please login again.');
    setState((s) => ({ ...s, isSubmitting: true, error: null }));

    try {
      // Per spec: /api/auth/2fa/complete-login expects the temporary token + the code (TOTP or backup)
      const res: AnyRecord = await api.verifyOtp(state.tempToken, code.trim()) as AnyRecord;
      const tokens = extractTokens(res);
      if (tokens) await saveTokens(tokens);

      setState((s) => ({ ...s, requiresOtp: false, tempToken: null }));
      await loadSession({ skipBiometricLock: true, quiet: true });
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Invalid code. Please try again.';
      setState((s) => ({ ...s, error: msg }));
      throw e;
    } finally {
      setState((s) => ({ ...s, isSubmitting: false }));
    }
  }, [state.tempToken, loadSession]);

  const logout = useCallback(async () => {
    const rt = (await SecureStore.getItemAsync('hrms.refreshToken')) || undefined;
    const biometricStatus = await getBiometricStatus();
    await unregisterRemotePushDeviceAsync().catch(() => {});
    await api.logout(rt);
    if (!biometricStatus.enabled) {
      await clearTokens();
    }
    setState({
      isLoading: false,
      isSubmitting: false,
      isAuthenticated: false,
      hasStoredSession: biometricStatus.enabled,
      user: null,
      employee: null,
      error: null,
      requiresOtp: false,
      tempToken: null,
      biometricEnabled: biometricStatus.enabled,
      biometricEnrolled: biometricStatus.enrolled,
      biometricLocked: false,
      biometricSupported: biometricStatus.supported,
      biometricTypeLabel: biometricStatus.label,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadSession({ skipBiometricLock: true });
  }, [loadSession]);

  const enableBiometricLogin = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const biometricStatus = await getBiometricStatus();
      if (!biometricStatus.supported || !biometricStatus.enrolled) {
        throw new Error(
          Platform.OS === 'web'
            ? 'Fingerprint login is only available in the Android or iPhone app, not the browser preview.'
            : 'Fingerprint login is not available on this device yet.'
        );
      }

      const confirmed = await promptBiometricAuth(
        biometricStatus.label,
        `Confirm your ${biometricStatus.label.toLowerCase()} to enable quick sign in`
      );

      if (!confirmed) {
        throw new Error(`${biometricStatus.label} confirmation was cancelled.`);
      }

      await storeBiometricEnabled(true);
      setState((s) => ({
        ...s,
        isLoading: false,
        hasStoredSession: true,
        biometricEnabled: true,
        biometricEnrolled: biometricStatus.enrolled,
        biometricSupported: biometricStatus.supported,
        biometricTypeLabel: biometricStatus.label,
      }));
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unable to enable fingerprint login.';
      setState((s) => ({ ...s, isLoading: false, error: message }));
      throw e;
    }
  }, []);

  const disableBiometricLogin = useCallback(async () => {
    await storeBiometricEnabled(false);
    const biometricStatus = await getBiometricStatus();
    setState((s) => ({
        ...s,
        biometricEnabled: false,
        biometricEnrolled: biometricStatus.enrolled,
        biometricLocked: false,
        biometricSupported: biometricStatus.supported,
        biometricTypeLabel: biometricStatus.label,
      }));
  }, []);

  const authenticateWithBiometricLogin = useCallback(async () => {
    if (!state.biometricEnabled) {
      return false;
    }

    setState((s) => ({ ...s, isSubmitting: true, error: null }));

    try {
      const confirmed = await promptBiometricAuth(
        state.biometricTypeLabel,
        `Use ${state.biometricTypeLabel.toLowerCase()} to sign in`
      );

      if (confirmed) {
        await loadSession({ skipBiometricLock: true, quiet: true });
      } else {
        setState((s) => ({
          ...s,
          isAuthenticated: false,
          biometricLocked: true,
        }));
      }

      return confirmed;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Fingerprint authentication failed.';
      setState((s) => ({ ...s, error: message }));
      throw e;
    } finally {
      setState((s) => ({ ...s, isSubmitting: false }));
    }
  }, [state.biometricEnabled, state.biometricTypeLabel, loadSession]);

  return {
    ...state,
    authenticateWithBiometricLogin,
    clearError,
    disableBiometricLogin,
    enableBiometricLogin,
    login,
    verifyOtp,
    logout,
    refreshProfile,
    resetOtp,
  };
}

export type UseAuthReturn = ReturnType<typeof useProvideAuth>;

const AuthContext = createContext<UseAuthReturn | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useProvideAuth();
  return createElement(AuthContext.Provider, { value: auth }, children);
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return auth;
}

function extractTokens(payload: unknown): AuthTokens | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as AnyRecord;
  const root = (p.data as AnyRecord) || (p.result as AnyRecord) || p || {};
  const t = (root.tokens as AnyRecord) || (p.tokens as AnyRecord) || root;

  // Per OpenAPI spec examples: responses use access_token / refresh_token (snake_case)
  const access =
    (t?.access_token as string) ||
    (t?.accessToken as string) ||
    (root?.access_token as string) ||
    (root?.accessToken as string) ||
    (root?.token as string);
  const refresh =
    (t?.refresh_token as string) ||
    (t?.refreshToken as string) ||
    (root?.refresh_token as string) ||
    (root?.refreshToken as string);

  if (access && refresh) return { accessToken: access, refreshToken: refresh };
  return null;
}

function extractUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as AnyRecord;
  const rootPayload = (p.data as AnyRecord) || (p.result as AnyRecord) || p;
  const root =
    (p.data as AnyRecord)?.user ||
    (p.result as AnyRecord)?.user ||
    (p.user as AnyRecord) ||
    (p.data as AnyRecord) ||
    (p.result as AnyRecord) ||
    p;
  if (!root) return null;

  const r = root as AnyRecord;
  const activeCompany = (r.active_company as AnyRecord) || (rootPayload.active_company as AnyRecord) || (p.company as AnyRecord);
  const companies = Array.isArray(p.companies)
    ? (p.companies as AnyRecord[])
    : Array.isArray(rootPayload.companies)
      ? (rootPayload.companies as AnyRecord[])
      : [];
  const firstCompany = companies.find((entry) => entry && typeof entry === 'object') || null;
  const id = r.id || r.user_id || r.sub;
  const email = r.email as string | undefined;
  let fullName = (r.fullName as string) || (r.full_name as string) || (r.name as string);
  if (!fullName) {
    const fn = (r.first_name as string) || (r.firstName as string) || '';
    const ln = (r.last_name as string) || (r.lastName as string) || '';
    fullName = [fn, ln].filter(Boolean).join(' ').trim() || (email as string);
  }
  if (!id || !email) return null;

  const employeeId =
    (r.employee_no as string) ||
    (r.employeeId as string) ||
    (r.employee_id as string) ||
    (r.user_no as string) ||
    (typeof r.employee_id === 'number' ? String(r.employee_id) : undefined) ||
    (typeof rootPayload.employee_id === 'number' ? String(rootPayload.employee_id) : undefined);

  const role =
    (r.role as string) ||
    (r.user_type as string) ||
    (Array.isArray(r.roles) && typeof r.roles[0] === 'string' ? (r.roles[0] as string) : undefined) ||
    (Array.isArray(r.roles) && r.roles[0] && typeof r.roles[0] === 'object'
      ? ((r.roles[0] as AnyRecord).name as string | undefined)
      : undefined);

  const companyId =
    (typeof r.companyId === 'number' ? r.companyId : undefined) ||
    (typeof activeCompany?.id === 'number' ? activeCompany.id : undefined) ||
    (typeof activeCompany?.company_id === 'number' ? activeCompany.company_id : undefined) ||
    (typeof firstCompany?.companyId === 'number' ? firstCompany.companyId : undefined);

  const companyName =
    (r.companyName as string) ||
    (r.company_name as string) ||
    (activeCompany?.name as string) ||
    (activeCompany?.company_name as string) ||
    (firstCompany?.companyName as string) ||
    (firstCompany?.company_name as string);

  return {
    id: (id ?? 'me') as string | number,
    fullName: fullName || 'Employee',
    email,
    employeeId,
    role,
    companyId,
    companyName,
  };
}
