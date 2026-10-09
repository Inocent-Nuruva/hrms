/**
 * HRMS Employee App Configuration
 * Google-style clean professional UI for user/employee self-service.
 * Uses the same backend APIs as the web ESS (Employee Self Service).
 */

export const API_BASE_URL =
  // Change this to match your backend (same as web NEXT_PUBLIC_API_BASE_URL or default)
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://192.168.1.30:9999';

export const APP_NAME = 'HRMS';
export const APP_SUBTITLE = 'Employee Portal';

// Storage keys (secure)
export const STORAGE_KEYS = {
  accessToken: 'hrms.accessToken',
  refreshToken: 'hrms.refreshToken',
  user: 'hrms.user',
  employee: 'hrms.employee',
} as const;

// Default query stale / cache times (ms)
export const QUERY_STALE_TIME = 1000 * 60 * 2; // 2 minutes
export const QUERY_CACHE_TIME = 1000 * 60 * 10; // 10 minutes

let selectedAppAccent = '#0078D4';

export function setAppAccentColor(color: string) {
  selectedAppAccent = color;
}

// Shared mobile palette aligned with the web self-service portal.
export const COLORS = {
  // Brand
  get primary() { return selectedAppAccent; },
  primaryDark: '#005A9E',
  onPrimary: '#ffffff',
  get accent() { return selectedAppAccent; },
  onAccent: '#ffffff',

  // Light
  background: '#FFFFFF',
  surface: '#ffffff',
  surfaceVariant: '#f7f7f7',
  onSurface: '#111111',
  onSurfaceVariant: '#4b5563',
  outline: '#e4e4e7',

  // Dark
  backgroundDark: '#181818',
  surfaceDark: '#18181b',
  surfaceVariantDark: '#27272a',
  onSurfaceDark: '#fafafa',
  onSurfaceVariantDark: '#a1a1aa',
  outlineDark: '#3f3f46',

  // Semantic
  success: '#059669',
  error: '#b91c1c',
  warning: '#b45309',
  get info() { return selectedAppAccent; },
} as const;

export type ColorKey = keyof typeof COLORS;
