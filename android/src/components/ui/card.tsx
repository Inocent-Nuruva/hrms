import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  const { isDark } = useThemePreference();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
          borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
});
