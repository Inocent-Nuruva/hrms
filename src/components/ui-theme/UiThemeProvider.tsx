'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccountAppearance } from '@/hooks/use-account-appearance';
import { UI_THEME_COOKIE, type UiTheme } from './shared';

type Ctx = { ui: UiTheme; setUi: (t: UiTheme) => void; toggleUi: () => void };
const UiThemeContext = createContext<Ctx | null>(null);

/**
 * Remembers Theme 1 / Theme 2 on the user's account (appearance preferences),
 * so the choice follows them to every device. The ui-theme cookie mirrors it
 * so the server renders the right frame on the first paint of each device.
 */
export function UiThemeProvider({ initial, children }: { initial: UiTheme; children: ReactNode }) {
  const router = useRouter();
  const [ui, setState] = useState<UiTheme>(initial);
  const current = useRef<UiTheme>(initial);

  // Applies a choice on this device: state, <html data-ui>, cookie, and a
  // server re-render when the frame has to change.
  const apply = useCallback((t: UiTheme) => {
    setState(t);
    document.documentElement.dataset.ui = t;
    document.cookie = `${UI_THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    if (current.current !== t) {
      current.current = t;
      router.refresh();
    }
  }, [router]);

  // Loads the account's saved design on sign-in and window focus, and saves
  // changes to the account. Falls back to this device's cookie.
  const saveToAccount = useAccountAppearance('uiDesign', initial, apply);

  const setUi = useCallback((t: UiTheme) => saveToAccount(t), [saveToAccount]);
  const value = useMemo(() => ({ ui, setUi, toggleUi: () => setUi(ui === 'v1' ? 'v2' : 'v1') }), [ui, setUi]);
  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

/** Same as useUiTheme, but returns null outside the provider instead of throwing. */
export function useOptionalUiTheme() {
  return useContext(UiThemeContext);
}

export function useUiTheme() {
  const ctx = useContext(UiThemeContext);
  if (!ctx) throw new Error('useUiTheme must be used inside <UiThemeProvider>');
  return ctx;
}
