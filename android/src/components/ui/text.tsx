import React from 'react';
import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';

function resolveFontFamily(style: TextProps['style']) {
  const flattened = StyleSheet.flatten(style);
  if (flattened?.fontFamily) return flattened.fontFamily;

  const weight = String(flattened?.fontWeight || '400');
  if (weight === 'bold' || Number(weight) >= 700) return 'Comfortaa_700Bold';
  if (Number(weight) >= 600) return 'Comfortaa_600SemiBold';
  if (Number(weight) >= 500) return 'Comfortaa_500Medium';
  return 'Comfortaa_400Regular';
}

export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: resolveFontFamily(style) }, style]} />;
}
