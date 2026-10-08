import React from 'react';
import { ThemeProvider } from '@fluentui-react-native/design/theming';
import { createAndroidTheme } from '@fluentui-react-native/android-theme';

interface Props {
  children: React.ReactNode;
  isDark: boolean;
}

export function FluentThemeProvider({ children, isDark }: Props) {
  const theme = React.useMemo(
    () => createAndroidTheme({ appearance: isDark ? 'dark' : 'light' }),
    [isDark],
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
