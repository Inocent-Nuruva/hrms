import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useThemePreference } from '../../hooks/useThemePreference';
import { useAppAccent } from '../../hooks/useAppAccent';
import { COLORS } from '../../lib/config';
import { FluentText } from './fluent-text';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  trailing?: React.ReactNode;
}

export function FluentInput({ label, hint, trailing, style, ...props }: Props) {
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const [focused, setFocused] = useState(false);
  const color = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;

  return (
    <View style={styles.wrapper}>
      {label ? <FluentText style={[styles.label, { color: muted }]}>{label}</FluentText> : null}
      <View style={styles.inputWrap}>
        <TextInput
          {...props}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            {
              backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
              color,
              borderColor: focused ? accent : isDark ? COLORS.outlineDark : '#8A8886',
              borderWidth: focused ? 2 : 1,
            },
            style,
          ]}
          placeholderTextColor={muted}
          accessibilityLabel={props.accessibilityLabel || label}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {hint ? <FluentText style={[styles.hint, { color: muted }]}>{hint}</FluentText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    minHeight: 48,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    paddingRight: 48,
  },
  trailing: { position: 'absolute', right: 6, top: 6, bottom: 6, justifyContent: 'center' },
  hint: { marginTop: 6, fontSize: 11, lineHeight: 16 },
});
