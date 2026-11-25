import { cookies } from 'next/headers';
import { parseUiTheme, UI_THEME_COOKIE, type UiTheme } from './shared';

/** Read the user's design choice in server components and layouts. Works on Next 14 and 15. */
export async function getUiTheme(): Promise<UiTheme> {
  const store = await cookies();
  return parseUiTheme(store.get(UI_THEME_COOKIE)?.value);
}
