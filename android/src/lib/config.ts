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
// Using company brand colors: #2e3d8a (blue), #dd3740 (red)
export const COLORS = {
  // Brand
  primary: '#2e3d8a',
  primaryDark: '#1f2a5e',
  onPrimary: '#ffffff',
  accent: '#dd3740',
  onAccent: '#ffffff',

  // Light - branded with blue tints
  background: '#f4f6fa',       // light blue-gray
  surface: '#ffffff',
  surfaceVariant: '#e8ebf5',   // blue-tinted
  onSurface: '#1a1f2e',        // dark blue-ish text
  onSurfaceVariant: '#3f4759', // blue-gray
  outline: '#c5cde0',          // blue-tinted outline

  // Dark - branded with blue tints
  backgroundDark: '#0d1426',   // dark blue
  surfaceDark: '#141a2e',      // blue-tinted dark
  surfaceVariantDark: '#1f2740',
  onSurfaceDark: '#e0e5f5',
  onSurfaceVariantDark: '#a8b3d0',
  outlineDark: '#3a4666',

  // Semantic
  success: '#15803d',
  error: '#dd3740',
  warning: '#a16207',
  info: '#2e3d8a',
} as const;

export type ColorKey = keyof typeof COLORS;
