/**
 * HRMS Employee App Configuration
 * Google-style clean professional UI for user/employee self-service.
 * Uses the same backend APIs as the web ESS (Employee Self Service).
 */

export const API_BASE_URL =
  // Change this to match your backend (same as web NEXT_PUBLIC_API_BASE_URL or default)
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://192.168.1.30:8888';

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

// Shared mobile palette aligned with the web self-service portal.
export const COLORS = {
  // Brand (web portal blue)
  primary: '#303194',
  primaryDark: '#262777',
  onPrimary: '#ffffff',

  // Light (shadcn-like)
  background: '#ffffff',
  surface: '#ffffff',
  surfaceVariant: '#f4f4f5',   // zinc-100
  onSurface: '#18181b',
  onSurfaceVariant: '#52525b', // zinc-600
  outline: '#e4e4e7',          // zinc-200

  // Dark (shadcn-like)
  backgroundDark: '#09090b',   // zinc-950
  surfaceDark: '#18181b',      // zinc-900
  surfaceVariantDark: '#27272a',
  onSurfaceDark: '#f4f4f5',
  onSurfaceVariantDark: '#a1a1aa',
  outlineDark: '#3f3f46',

  // Semantic
  success: '#15803d',
  error: '#b91c1c',
  warning: '#a16207',
  info: '#303194',
} as const;

export type ColorKey = keyof typeof COLORS;
