import React from 'react';

interface Props {
  children: React.ReactNode;
  isDark: boolean;
}

export function FluentThemeProvider({ children }: Props) {
  return <>{children}</>;
}
