import React from 'react';
import { ActivityIndicator as FluentNativeActivityIndicator } from '@fluentui-react-native/experimental-activity-indicator';
import type { StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../../lib/config';
import { useAppAccent } from '../../hooks/useAppAccent';

export type FluentActivityIndicatorSize = 'xSmall' | 'small' | 'medium' | 'large' | 'xLarge';

interface Props {
  size?: FluentActivityIndicatorSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  animating?: boolean;
}

export function FluentActivityIndicator({ size = 'medium', color, style, animating = true }: Props) {
  const accent = useAppAccent();
  const indicatorColor = color ?? accent ?? COLORS.primary;
  return (
    <FluentNativeActivityIndicator
      size={size}
      activityIndicatorColor={indicatorColor}
      color={indicatorColor}
      style={style}
      animating={animating}
    />
  );
}
