import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import * as SecureStore from '../lib/secure-store';

const THEME_PREFERENCE_KEY = 'hrms.themePreference';

type ThemePreference = 'light' | 'dark';

interface ThemePreferenceContextValue {
  colorScheme: ThemePreference;
  isDark: boolean;
  preference: ThemePreference;
  toggleTheme: () => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreference] = useState<ThemePreference>(systemScheme);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY).catch(() => null);
      if (!cancelled && (stored === 'light' || stored === 'dark')) {
        setPreference(stored);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((current) => {
      const next: ThemePreference = current === 'dark' ? 'light' : 'dark';
      void SecureStore.setItemAsync(THEME_PREFERENCE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      colorScheme: preference,
      isDark: preference === 'dark',
      preference,
      toggleTheme,
    }),
    [preference, toggleTheme]
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider.');
  }
  return context;
}
