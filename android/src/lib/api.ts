import { API_BASE_URL } from './config';
import * as SecureStore from './secure-store'; // cross-platform wrapper (fixes web + native)
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

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
let refreshPromise: Promise<string | null> | null = null;

function readManifestVersion(): string | undefined {
  const expoConfigVersion = Constants.expoConfig?.version?.trim();
  if (expoConfigVersion) {
    return expoConfigVersion;
  }

  const manifest2Version = Constants.manifest2?.extra?.expoClient?.version;
  if (typeof manifest2Version === 'string' && manifest2Version.trim()) {
    return manifest2Version.trim();
  }

  const legacyManifest = Constants.manifest as { version?: unknown } | null | undefined;
  return typeof legacyManifest?.version === 'string' && legacyManifest.version.trim()
    ? legacyManifest.version.trim()
    : undefined;
}

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

function extractErrorMessage(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const payload = value as Record<string, unknown>;
  if (Array.isArray(payload.message)) {
    return payload.message.join('. ').trim();
  }
  if (typeof payload.message === 'string') {
    return payload.message.trim();
  }
  return '';
}

export function formatAttendancePunchError(error: unknown, _action: 'check-in' | 'check-out') {
  const baseFallback = 'Attendance action could not be completed right now. Please try again.';

  if (!(error instanceof Error)) {
    return baseFallback;
  }

  const apiError = error as ApiError;
  const rawMessage = [error.message, extractErrorMessage(apiError.payload)]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .trim();
  const normalized = rawMessage.toLowerCase();

  if (!normalized) {
    return baseFallback;
  }

  if (normalized.includes('location permission is required')) {
    return error.message;
  }

  if (normalized.includes('unauthorized')) {
    return 'Your session expired. Please sign in again, then try the attendance action once more.';
  }

  if (
    normalized.includes('wifi') ||
    normalized.includes('wi-fi') ||
    normalized.includes('ssid') ||
    normalized.includes('bssid') ||
    normalized.includes('network')
  ) {
    return 'Connect to the approved office Wi-Fi and confirm the correct SSID, then try again.';
  }

  if (
    normalized.includes('geofence') ||
    normalized.includes('location') ||
    normalized.includes('outside') ||
    normalized.includes('range')
  ) {
    return 'Make sure you are inside the approved office location range, then try again.';
  }

  if (
    normalized.includes('already exists') ||
    normalized.includes('already checked in') ||
    normalized.includes('already checked out') ||
    normalized.includes('duplicate') ||
    apiError.status === 409
  ) {
    return 'A similar attendance punch already exists for you. Refresh and confirm your latest attendance status.';
  }

  if (
    normalized === 'attendance punch rejected.' ||
    normalized.includes('attendance punch rejected')
  ) {
    return 'Make sure you are on the approved office Wi-Fi or inside the allowed office location, then try again.';
  }

  return error.message;
}

function extractAuthTokens(payload: unknown): AuthTokens | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const nested =
    (root.data as Record<string, unknown> | undefined) ||
    (root.result as Record<string, unknown> | undefined) ||
    root;
  const tokenContainer =
    (nested.tokens as Record<string, unknown> | undefined) ||
    (root.tokens as Record<string, unknown> | undefined) ||
    nested;

  const access =
    (tokenContainer.access_token as string | undefined) ||
    (tokenContainer.accessToken as string | undefined) ||
    (nested.access_token as string | undefined) ||
    (nested.accessToken as string | undefined) ||
    (nested.token as string | undefined);
  const refresh =
    (tokenContainer.refresh_token as string | undefined) ||
    (tokenContainer.refreshToken as string | undefined) ||
    (nested.refresh_token as string | undefined) ||
    (nested.refreshToken as string | undefined);

  return access && refresh ? { accessToken: access, refreshToken: refresh } : null;
}

async function getBearerToken(explicitToken?: string) {
  if (explicitToken?.trim()) {
    return explicitToken.trim();
  }
  if (accessToken?.trim()) {
    return accessToken.trim();
  }
  const stored = await loadTokensFromStorage();
  return stored?.accessToken?.trim() || null;
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('hrms.refreshToken');
      if (!refreshToken?.trim()) {
        return null;
      }

      const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken.trim() }),
      });

      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { message: text };
        }
      }

      if (!response.ok) {
        await clearTokens();
        return null;
      }

      const nextTokens = extractAuthTokens(payload);
      if (!nextTokens) {
        await clearTokens();
        return null;
      }

      await saveTokens(nextTokens);
      return nextTokens.accessToken;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  retryOnUnauthorized?: boolean;
} = {}): Promise<T> {
  const { method = 'GET', body, token, headers, retryOnUnauthorized = true } = options;

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const bearerToken = await getBearerToken(token);

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
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

    if (res.status === 401 && retryOnUnauthorized && !token) {
      const refreshedAccessToken = await refreshAccessToken();
      if (refreshedAccessToken) {
        return request<T>(path, {
          ...options,
          token: refreshedAccessToken,
          retryOnUnauthorized: false,
        });
      }
    }

    const message =
      d && Array.isArray(d.message)
        ? d.message.join('. ')
        : d && typeof d.message === 'string'
          ? d.message
          : `Request failed (${res.status})`;
    const err = new Error(
      message
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

  /**
   * GET /api/me/profile/photo — profile picture URL for the signed-in user.
   * Returns null when no photo is set (404/204).
   */
  async getMyProfilePhotoUrl() {
    try {
      const payload = await request<unknown>('/api/me/profile/photo');
      if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
      }
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      const root = payload as Record<string, unknown>;
      const nested =
        (root.data as Record<string, unknown> | undefined) ||
        (root.result as Record<string, unknown> | undefined) ||
        root;
      const keys = [
        'profile_photo_url',
        'photo_url',
        'url',
        'avatar_url',
        'avatar',
        'image_url',
        'imageUrl',
        'signed_url',
        'public_url',
      ];
      for (const key of keys) {
        const value = nested[key] ?? root[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return null;
    } catch (error) {
      const status = (error as ApiError)?.status;
      if (status === 404 || status === 204) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Upload the signed-in user's profile picture.
   * POST /api/me/profile/photo (multipart/form-data, field: file) → 201
   */
  async uploadMyProfilePhoto(file: {
    uri: string;
    name?: string;
    type?: string;
  }) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name?.trim() || 'profile-photo.jpg',
      type: file.type?.trim() || 'image/jpeg',
    } as unknown as Blob);

    const bearerToken = await getBearerToken();
    const url = `${API_BASE_URL}/api/me/profile/photo`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: formData,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      const d = data as Record<string, unknown> | null;
      const message =
        d && Array.isArray(d.message)
          ? d.message.join('. ')
          : d && typeof d.message === 'string'
            ? d.message
            : `Request failed (${res.status})`;
      const err = new Error(message) as ApiError;
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  },

  /**
   * Select (or clear) a default profile avatar for the signed-in employee.
   * PATCH /api/me/profile/avatar — body: { default_avatar_id: number | null }
   */
  async selectMyProfileAvatar(defaultAvatarId: number | null) {
    return request<unknown>('/api/me/profile/avatar', {
      method: 'PATCH',
      body: { default_avatar_id: defaultAvatarId },
    });
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

  async getMyLeaveRequest(id: string | number) {
    const payload = await request<unknown>(`/api/me/leave/requests/${id}`);
    return normalizeSingle(payload);
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

  // --- ATTENDANCE (mobile punches + summaries for user)
  // Updated to pass richer context (lat/long + accuracyMeters + deviceIdentifier)
  // to match updated backend contract for /mobile-punches/check-in and check-out.
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
    return request<unknown>(`/api/me/attendance/punches${q}`);
  },

  async listMyAttendanceHistory(params: Record<string, unknown> = {}) {
    const q = buildQuery(params);
    return request<unknown>(`/api/me/attendance/history${q}`);
  },

  async getMyAttendanceToday() {
    return request<unknown>('/api/me/attendance/today');
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

  async listMyFieldVisits() {
    return normalizeList(await request<unknown>('/api/me/field-visits'));
  },

  async listMyFinanceApplications() {
    return normalizeList(await request<unknown>('/api/me/finance/applications'));
  },

  async listMyPerformanceAssignments() {
    return normalizeList(await request<unknown>('/api/performance/me/assignments'));
  },

  async listMyDocuments() {
    return normalizeList(await request<unknown>('/api/me/documents'));
  },

  async listMyActivities() {
    return normalizeList(await request<unknown>('/api/me/activities'));
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
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }

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

function readNumericCandidate(value: unknown): number | undefined {
  const numericCandidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(numericCandidate) && numericCandidate > 0 ? numericCandidate : undefined;
}

async function resolveMobileEmployeeId(): Promise<number | undefined> {
  try {
    const storedEmployee = await SecureStore.getItemAsync('hrms.employee');
    if (storedEmployee) {
      const parsed = JSON.parse(storedEmployee) as Record<string, unknown>;
      const employeeId = readNumericCandidate(parsed.id ?? parsed.employee_id ?? parsed.employeeId);
      if (employeeId) {
        return employeeId;
      }
    }
  } catch {}

  try {
    const storedUser = await SecureStore.getItemAsync('hrms.user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser) as Record<string, unknown>;
      const employeeId = readNumericCandidate(parsed.employeeId ?? parsed.employee_id ?? parsed.id);
      if (employeeId) {
        return employeeId;
      }
    }
  } catch {}

  try {
    const employeePayload = await api.getCurrentEmployee();
    const employee = await normalizeSingle(employeePayload);
    const employeeId = readNumericCandidate(employee?.id ?? employee?.employee_id ?? employee?.employeeId);
    if (employeeId && employee) {
      await SecureStore.setItemAsync('hrms.employee', JSON.stringify(employee)).catch(() => {});
      return employeeId;
    }
  } catch {}

  try {
    const userPayload = await api.getCurrentUser();
    const user = await normalizeSingle(userPayload);
    const employeeId = readNumericCandidate(user?.employeeId ?? user?.employee_id ?? user?.id);
    if (employeeId && user) {
      await SecureStore.setItemAsync('hrms.user', JSON.stringify(user)).catch(() => {});
      return employeeId;
    }
  } catch {}

  return undefined;
}

export async function readMobilePunchContext() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required before checking in or out.');
  }

  const [position, netInfoState, ipAddress] = await Promise.all([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }),
    NetInfo.fetch(),
    Network.getIpAddressAsync().catch(() => null),
  ]);

  const details =
    netInfoState.details && typeof netInfoState.details === 'object'
      ? (netInfoState.details as Record<string, unknown>)
      : null;

  const wifiSsid =
    typeof details?.ssid === 'string' && details.ssid.trim() ? details.ssid.trim() : undefined;
  const wifiBssid =
    typeof details?.bssid === 'string' && details.bssid.trim() ? details.bssid.trim() : undefined;
  const resolvedIpAddress =
    typeof ipAddress === 'string' && ipAddress.trim()
      ? ipAddress.trim()
      : typeof details?.ipAddress === 'string' && details.ipAddress.trim()
        ? details.ipAddress.trim()
        : undefined;
  const networkType =
    typeof netInfoState.type === 'string' && netInfoState.type.trim()
      ? netInfoState.type.toLowerCase()
      : undefined;

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? undefined,
    wifiSsid,
    wifiBssid,
    ipAddress: resolvedIpAddress,
    networkType,
  };
}

/**
 * Builds the payload for mobile check-in / check-out.
 * Passes through richer context fields supported by the backend
 * (accuracy, device info, etc) in addition to lat/long.
 * Matches the expectations seen in updated attendance mobile-punches endpoints.
 */
export async function buildMobilePunchPayload(options: {
  overrideReason?: string;
} = {}): Promise<Record<string, unknown>> {
  const networkContext = await readMobilePunchContext();

  const deviceIdentifier = [
    Device.osName,
    Device.modelName || Device.deviceName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || 'mobile-device';

  const employeeId = await resolveMobileEmployeeId();
  const appVersion = readManifestVersion();

  const deviceInfo = {
    platform: Platform.OS,
    deviceModel: Device.modelName ?? Device.deviceName ?? undefined,
    osVersion: Device.osVersion ?? undefined,
    appVersion,
    networkType: networkContext.networkType,
  };

  const payload = {
    employeeId,
    latitude: networkContext.latitude,
    longitude: networkContext.longitude,
    accuracyMeters: networkContext.accuracyMeters,
    wifiSsid: networkContext.wifiSsid,
    wifiBssid: networkContext.wifiBssid,
    ipAddress: networkContext.ipAddress,
    deviceIdentifier,
    deviceInfo,
    overrideReason: options.overrideReason?.trim() || undefined,
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}
