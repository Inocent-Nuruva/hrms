import React, { createContext, useContext } from 'react';
import { profilePaletteForeground } from '../lib/profile-card-background';

type AppAccentValue = { color: string; foreground: string };
const AppAccentContext = createContext<AppAccentValue>({ color: '#0078D4', foreground: '#FFFFFF' });

export function AppAccentProvider({ accent, children }: { accent: string; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ color: accent, foreground: profilePaletteForeground(accent) }), [accent]);
  return <AppAccentContext.Provider value={value}>{children}</AppAccentContext.Provider>;
}

export function useAppAccent() {
  return useContext(AppAccentContext).color;
}

export function useAppAccentForeground() {
  return useContext(AppAccentContext).foreground;
}
