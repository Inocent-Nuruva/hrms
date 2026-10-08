import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { ButtonV1 } from '@fluentui-react-native/button';
import { FluentActivityIndicator } from './fluent-activity-indicator';
import { useAppAccent } from '../../hooks/useAppAccent';
import { useAppAccentForeground } from '../../hooks/useAppAccent';
import { FluentText } from './fluent-text';

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
  const button = (
    <ButtonV1
      appearance={appearance}
      size={size}
      block={block}
      onClick={onPress}
      disabled={disabled || loading}
      style={[appearance === 'primary' ? { backgroundColor: accent } : undefined, centered ? { alignSelf: 'center' } : undefined, style]}
    >
      {loading ? <FluentActivityIndicator size="small" color={appearance === 'primary' ? accentForeground : accent} /> : null}
      {appearance === 'primary' ? <FluentText style={{ color: accentForeground, fontWeight: '600' }}>{children}</FluentText> : children}
    </ButtonV1>
  );

  return centered ? <View style={{ alignSelf: 'center' }}>{button}</View> : button;
}
