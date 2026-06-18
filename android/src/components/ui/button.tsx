import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View } from 'react-native';
import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';
import { TouchableScale } from './touchable-scale';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  disabled,
  style,
  textStyle,
  loading,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const { isDark } = useThemePreference();
  const baseStyle = styles.base;
  let variantStyle = {};
  let textVariantStyle = {};
  let spinnerColor = '#fff';

  if (variant === 'default') {
    variantStyle = { backgroundColor: COLORS.primary || '#18181b' };
    textVariantStyle = { color: '#fff' };
    spinnerColor = '#fff';
  } else if (variant === 'secondary') {
    variantStyle = { backgroundColor: COLORS.accent };
    textVariantStyle = { color: COLORS.onAccent };
    spinnerColor = COLORS.onAccent;
  } else if (variant === 'outline') {
    variantStyle = {
      borderWidth: 1,
      borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
      backgroundColor: 'transparent',
    };
    textVariantStyle = { color: isDark ? COLORS.onSurfaceDark : COLORS.onSurface };
    spinnerColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  } else if (variant === 'ghost') {
    variantStyle = { backgroundColor: 'transparent' };
    textVariantStyle = { color: isDark ? COLORS.onSurfaceDark : COLORS.onSurface };
    spinnerColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  } else if (variant === 'destructive') {
    variantStyle = { backgroundColor: COLORS.error || '#dd3740' };
    textVariantStyle = { color: '#fff' };
    spinnerColor = '#fff';
  }

  return (
    <TouchableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[baseStyle, variantStyle, disabled && styles.disabled, style]}
      pressedScale={0.98}
    >
      {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
      {!loading && leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
      {!loading ? (
        <Text style={[styles.text, textVariantStyle, textStyle]}>
          {children}
        </Text>
      ) : null}
      {!loading && rightIcon ? <View style={styles.iconWrap}>{rightIcon}</View> : null}
    </TouchableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconWrap: {
    marginHorizontal: 4,
  },
  disabled: {
    opacity: 0.6,
  },
});
