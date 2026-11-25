'use client';

import { useUiTheme } from './UiThemeProvider';

/**
 * Drop this into your EXISTING (Theme 1) top bar or profile menu so users can
 * switch to the new design. It is unstyled apart from the className you pass,
 * so it matches whatever Tailwind classes you use there.
 */
export function UiThemeToggle({ className }: { className?: string }) {
  const { ui, toggleUi } = useUiTheme();
  return (
    <button type="button" onClick={toggleUi} className={className}>
      {ui === 'v1' ? 'Try the new design' : 'Back to classic design'}
    </button>
  );
}
