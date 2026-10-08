import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { TextV1 } from '@fluentui-react-native/text';

type FluentTextProps = React.ComponentProps<typeof TextV1>;

function resolveFontFamily(style: FluentTextProps['style']) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  if (flattened?.fontFamily) return flattened.fontFamily;

  const weight = String(flattened?.fontWeight || '400');
  if (weight === 'bold' || Number(weight) >= 700) return 'Comfortaa_700Bold';
  if (Number(weight) >= 600) return 'Comfortaa_600SemiBold';
  if (Number(weight) >= 500) return 'Comfortaa_500Medium';
  return 'Comfortaa_400Regular';
}

export function FluentText({ style, ...props }: FluentTextProps) {
  return <TextV1 {...props} style={[{ fontFamily: resolveFontFamily(style) }, style]} />;
}
