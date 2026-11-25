// Shared by server and client code. No 'use client' here on purpose.
export type UiTheme = 'v1' | 'v2';
export const UI_THEME_COOKIE = 'ui-theme';
export const parseUiTheme = (value?: string | null): UiTheme => (value === 'v2' ? 'v2' : 'v1');
