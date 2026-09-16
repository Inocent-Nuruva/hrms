import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View } from 'react-native';

import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';
import { Text } from './text';

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, style, ...props }: InputProps) {
  const { isDark } = useThemePreference();

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: isDark ? '#d4d4d8' : '#3f3f46' }]}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
            borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
            color: isDark ? COLORS.onSurfaceDark : COLORS.onSurface,
          },
          style,
        ]}
        placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
        {...props}
      />
      {hint ? <Text style={[styles.hint, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Comfortaa_400Regular',
    minHeight: 48,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Comfortaa_400Regular',
  },
});
