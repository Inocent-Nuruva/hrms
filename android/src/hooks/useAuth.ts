import { useState, useEffect, useCallback } from 'react';
import { api, saveTokens, clearTokens, loadTokensFromStorage, AuthTokens, AuthUser } from '../lib/api';
import * as SecureStore from '../lib/secure-store'; // use wrapper (fixes ExpoSecureStore.default.setValueWithKeyAsync on web)
import { normalizeSingle } from '../lib/api';

type AnyRecord = Record<string, unknown>;

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  employee: any | null;
  error: string | null;
  requiresOtp: boolean;
  tempToken: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    employee: null,
    error: null,
    requiresOtp: false,
    tempToken: null,
  });

  const resetOtp = useCallback(() => {
    setState((s) => ({ ...s, requiresOtp: false, tempToken: null, error: null }));
  }, []);

  const loadSession = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    const tokens = await loadTokensFromStorage();
    if (!tokens) {
      setState((s) => ({ ...s, isLoading: false, isAuthenticated: false }));
      return;
    }

    try {
      // Try to hydrate current user + employee
      const [userPayload, empPayload] = await Promise.all([
        api.getCurrentUser().catch(() => null),
        api.getCurrentEmployee().catch(() => null),
      ]);

      const user = (await normalizeSingle(userPayload)) as AuthUser | null;
      const employee = await normalizeSingle(empPayload);

      // Fallbacks for name
      const finalUser: AuthUser = user || {
        id: 'me',
        fullName: 'Employee',
        email: '',
      };

      // Persist lightly
      if (user) await SecureStore.setItemAsync('hrms.user', JSON.stringify(user)).catch(() => {});
      if (employee) await SecureStore.setItemAsync('hrms.employee', JSON.stringify(employee)).catch(() => {});

      setState({
        isLoading: false,
        isAuthenticated: true,
        user: finalUser,
        employee,
        error: null,
        requiresOtp: false,
        tempToken: null,
      });
    } catch (e: unknown) {
      // Invalid token probably
      await clearTokens();
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        employee: null,
        error: null,
        requiresOtp: false,
        tempToken: null,
      });
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res: AnyRecord = await api.login(email.trim(), password) as AnyRecord;

      // Align strictly with the provided OpenAPI spec examples for /api/auth/login
      const userFromResponse = (res?.user as AnyRecord) || ((res?.data as AnyRecord)?.user as AnyRecord) || {};
      const requiresOtp = !!(
        res?.requires_2fa ||
        (userFromResponse as any)?.requires_2fa ||
        res?.requiresOtp ||
        res?.requires_otp ||
        res?.temp_token ||
        res?.tempToken
      );
      const tempToken = (res?.temp_token as string) || (res?.tempToken as string) || null;

      if (requiresOtp && tempToken) {
        setState((s) => ({
          ...s,
          isLoading: false,
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
          isLoading: false,
          requiresOtp: true,
          tempToken: tempToken as string | null,
          error: null,
        }));
        return { requiresOtp: true };
      }

      // Direct login success (tokens + user) per spec examples
      const tokens = extractTokens(res);
      const user = extractUser(res);

      if (tokens) {
        await saveTokens(tokens);
      }

      setState((s) => ({
        ...s,
        isLoading: false,
        requiresOtp: false,
        tempToken: null,
      }));

      await loadSession();
      return { requiresOtp: false };
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Login failed. Check your credentials.';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      throw e;
    }
  }, [loadSession]);

  const verifyOtp = useCallback(async (code: string) => {
    if (!state.tempToken) throw new Error('No OTP session. Please login again.');
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Per spec: /api/auth/2fa/complete-login expects the temporary token + the code (TOTP or backup)
      const res: AnyRecord = await api.verifyOtp(state.tempToken, code.trim()) as AnyRecord;
      const tokens = extractTokens(res);
      if (tokens) await saveTokens(tokens);

      setState((s) => ({ ...s, requiresOtp: false, tempToken: null, isLoading: false }));
      await loadSession();
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Invalid code. Please try again.';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      throw e;
    }
  }, [state.tempToken, loadSession]);

  const logout = useCallback(async () => {
    const rt = (await SecureStore.getItemAsync('hrms.refreshToken')) || undefined;
    await api.logout(rt);
    await clearTokens();
    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      employee: null,
      error: null,
      requiresOtp: false,
      tempToken: null,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  return {
    ...state,
    login,
    verifyOtp,
    logout,
    refreshProfile,
    resetOtp,
  };
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
  const root = (p.data as AnyRecord)?.user || (p.result as AnyRecord)?.user || (p.user as AnyRecord) || (p.data as AnyRecord) || (p.result as AnyRecord) || p;
  if (!root) return null;

  const r = root as AnyRecord;
  const id = r.id || r.user_id || r.sub;
  const email = r.email as string | undefined;
  let fullName = (r.fullName as string) || (r.full_name as string) || (r.name as string);
  if (!fullName) {
    const fn = (r.first_name as string) || (r.firstName as string) || '';
    const ln = (r.last_name as string) || (r.lastName as string) || '';
    fullName = [fn, ln].filter(Boolean).join(' ').trim() || (email as string);
  }
  if (!id || !email) return null;

  return {
    id: (id ?? 'me') as string | number,
    fullName: fullName || 'Employee',
    email,
    employeeId: (r.employeeId as string) || (r.employee_id as string) || (r.user_no as string),
    role: (r.role as string) || (r.user_type as string),
    companyId: r.companyId as number | undefined,
    companyName: (r.companyName as string) || (r.company_name as string),
  };
}
