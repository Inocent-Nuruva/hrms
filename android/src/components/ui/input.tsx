import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text, useColorScheme } from 'react-native';

import { COLORS } from '../../lib/config';

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, style, ...props }: InputProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: isDark ? '#d4d4d8' : '#3f3f46' }]}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? COLORS.surfaceVariantDark : '#fafafa',
            borderColor: isDark ? COLORS.outlineDark : '#d4d4d8',
            color: isDark ? COLORS.onSurfaceDark : '#18181b',
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
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
  },
});
