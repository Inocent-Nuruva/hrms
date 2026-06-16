import { API_BASE_URL } from './config';
import * as SecureStore from './secure-store'; // cross-platform wrapper (fixes web + native)

export interface ApiError extends Error {
  status?: number;
  payload?: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string | number;
  fullName: string;
  email: string;
  employeeId?: string;
  role?: string;
  companyId?: number;
  companyName?: string;
}

let accessToken: string | null = null;

export async function loadTokensFromStorage(): Promise<AuthTokens | null> {
  try {
    const [at, rt] = await Promise.all([
      SecureStore.getItemAsync('hrms.accessToken'),
      SecureStore.getItemAsync('hrms.refreshToken'),
    ]);
    if (at && rt) {
      accessToken = at;
      return { accessToken: at, refreshToken: rt };
    }
  } catch {}
  return null;
}

export async function saveTokens(tokens: AuthTokens) {
  accessToken = tokens.accessToken;
  await Promise.all([
    SecureStore.setItemAsync('hrms.accessToken', tokens.accessToken),
    SecureStore.setItemAsync('hrms.refreshToken', tokens.refreshToken),
  ]);
}

export async function clearTokens() {
  accessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync('hrms.accessToken').catch(() => {}),
    SecureStore.deleteItemAsync('hrms.refreshToken').catch(() => {}),
    SecureStore.deleteItemAsync('hrms.user').catch(() => {}),
    SecureStore.deleteItemAsync('hrms.employee').catch(() => {}),
  ]);
}

export function getAccessToken() {
  return accessToken;
}

async function request<T>(path: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
} = {}): Promise<T> {
  const { method = 'GET', body, token, headers } = options;

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token || accessToken ? { Authorization: `Bearer ${token || accessToken}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }

  if (!res.ok) {
    const d = data as Record<string, unknown> | null;
    const err = new Error(
      (d && (d.message as string)) || (d && Array.isArray(d.message) ? (d.message as string[]).join('. ') : `Request failed (${res.status})`)
    ) as ApiError;
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return (data ?? undefined) as T;
}

export const api = {
  // --- AUTH (user specific) ---
  async login(email: string, password: string) {
    // Exact match for the LoginDto in the OpenAPI spec
    return request<unknown>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  async verifyOtp(tempToken: string, code: string) {
    // Matches the Complete2FALoginDto expected by the backend per OpenAPI
    return request<unknown>('/api/auth/2fa/complete-login', {
      method: 'POST',
      body: { temp_token: tempToken, code },
    });
  },

  async getCurrentUser() {
    return request<unknown>('/api/users/me');
  },

  async getCurrentEmployee() {
    // Primary source for rich employee profile (user side)
    return request<unknown>('/api/employees/me');
  },

  async refreshToken(rt: string) {
    return request<unknown>('/api/auth/refresh', {
      method: 'POST',
      body: { refresh_token: rt },
    });
  },

  async logout(rt?: string) {
    if (!accessToken) return;
    try {
      await request<void>('/api/auth/logout', {
        method: 'POST',
        token: accessToken,   // per spec, logout requires the access token in Authorization header
        body: rt ? { refresh_token: rt } : undefined,
      });
    } catch {
      // ignore server logout errors
    }
  },

  // --- LEAVE (user specific /me endpoints preferred) ---
  async listMyLeaveBalances(params: Record<string, unknown> = {}) {
    const q = buildQuery(params);
    return request<unknown>(`/api/me/leave/balances${q}`);
  },

  async listMyLeaveRequests(params: Record<string, unknown> = {}) {
    const q = buildQuery(params);
    return request<unknown>(`/api/me/leave/requests${q}`);
  },

  async createMyLeaveRequest(data: Record<string, unknown>) {
    return request<unknown>('/api/me/leave/requests', {
      method: 'POST',
      body: data,
    });
  },

  async listLeaveTypes(params: Record<string, unknown> = {}) {
    const q = buildQuery(params);
    return request<unknown>(`/api/leave/types${q}`);
  },

  // --- ATTENDANCE (mobile punches + summaries for user) ---
  async checkIn(data: Record<string, unknown> = {}) {
    return request<unknown>('/api/attendance/mobile-punches/check-in', {
      method: 'POST',
      body: data,
    });
  },

  async checkOut(data: Record<string, unknown> = {}) {
    return request<unknown>('/api/attendance/mobile-punches/check-out', {
      method: 'POST',
      body: data,
    });
  },

  async listMyPunches(params: Record<string, unknown> = {}) {
    const q = buildQuery(params);
    return request<unknown>(`/api/attendance/mobile-punches${q}`);
  },

  // Generic list helpers (used for holidays etc.)
  async listHolidays(params: Record<string, unknown> = {}) {
    const q = buildQuery(params);
    return request<unknown>(`/api/attendance/holidays${q}`);
  },

  // Update basic profile fields (re-uses users endpoint)
  async updateMyProfile(id: string | number, data: Record<string, unknown>) {
    return request<unknown>(`/api/users/${id}`, {
      method: 'PATCH',
      body: data,
    });
  },
};

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v));
    }
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function normalizeList(payload: unknown): Promise<Record<string, unknown>[]> {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const r = (payload || {}) as Record<string, unknown>;
  const candidates = [r.data, r.result, r.items, r.rows, r.records, r.list];
  for (const c of candidates) if (Array.isArray(c)) return c as Record<string, unknown>[];
  // try nested
  if (r.data && typeof r.data === 'object') {
    const rd = r.data as Record<string, unknown>;
    for (const c of [rd.data, rd.items, rd.rows]) if (Array.isArray(c)) return c as Record<string, unknown>[];
  }
  return [];
}

export async function normalizeSingle(payload: unknown): Promise<Record<string, unknown> | null> {
  const r = (payload || {}) as Record<string, unknown>;
  const candidates = [r.data, r.result, r.item, r.employee, r.user, r];
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const rec = c as Record<string, unknown>;
      if (rec.id || rec.employee_no || rec.email || rec.full_name) return rec;
    }
  }
  return null;
}
