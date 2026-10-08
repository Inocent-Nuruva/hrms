import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';
import { TouchableScale } from './touchable-scale';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'default' | 'elevated';
  transparent?: boolean;
}

export function Card({ children, style, onPress, accessibilityLabel, variant = 'default', transparent = false }: CardProps) {
  const { isDark } = useThemePreference();
  const elevated = variant === 'elevated';

  const cardStyle = [
    styles.card,
    elevated && styles.elevatedCard,
    {
      backgroundColor: transparent ? 'transparent' : elevated ? (isDark ? '#252B32' : '#FFFFFF') : (isDark ? COLORS.surfaceDark : COLORS.surface),
      borderColor: elevated ? (isDark ? '#475361' : '#C6DAE9') : (isDark ? COLORS.outlineDark : COLORS.outline),
      shadowColor: isDark ? '#000000' : '#34536B',
      shadowOpacity: elevated ? (isDark ? 0.42 : 0.16) : 0.06,
      shadowOffset: { width: 0, height: elevated ? 3 : 1 },
      shadowRadius: elevated ? 8 : 3,
      elevation: elevated ? 5 : 1,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={cardStyle}
      >
        {children}
      </TouchableScale>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  elevatedCard: { borderRadius: 12, borderWidth: 1.25 },
});
