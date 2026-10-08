import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './text';
import { FluentActivityIndicator } from './fluent-activity-indicator';
import { useAppAccent, useAppAccentForeground } from '../../hooks/useAppAccent';

interface Props {
  children: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  centered?: boolean;
  size?: 'small' | 'medium' | 'large';
  appearance?: 'primary' | 'secondary' | 'subtle' | 'transparent' | 'outline';
}

export function FluentButton({ children, onPress, style, disabled, loading, block, centered, size = 'medium', appearance = 'primary' }: Props) {
  const accent = useAppAccent();
  const accentForeground = useAppAccentForeground();
  const sizeStyle = size === 'small' ? styles.small : size === 'large' ? styles.large : styles.medium;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy: !!loading, disabled: !!(disabled || loading) }} disabled={disabled || loading} onPress={onPress} style={[styles.button, { backgroundColor: appearance === 'primary' ? accent : 'transparent', borderColor: accent }, sizeStyle, block && styles.block, centered && styles.centered, appearance !== 'primary' && styles.secondary, (disabled || loading) && styles.disabled, style]}>
      <View style={styles.contentRow}>
        {loading ? <FluentActivityIndicator size="small" color={appearance === 'primary' ? accentForeground : accent} /> : null}
        <Text style={[styles.label, { color: appearance === 'primary' ? accentForeground : accent }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 14,
    backgroundColor: '#0078D4',
  },
  small: { minHeight: 36 },
  medium: { minHeight: 44 },
  large: { minHeight: 50 },
  block: { width: '100%', alignSelf: 'stretch' },
  centered: { alignSelf: 'center' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1 },
  disabled: { opacity: 0.6 },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
  },
});
