import React from 'react';
import { ActivityIndicator } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { FluentActivityIndicatorSize } from './fluent-activity-indicator.native';
import { COLORS } from '../../lib/config';
import { useAppAccent } from '../../hooks/useAppAccent';

interface Props {
  size?: FluentActivityIndicatorSize;
  color?: string;
  style?: StyleProp<ViewStyle>;
  animating?: boolean;
}

export function FluentActivityIndicator({ size = 'medium', color, style, animating = true }: Props) {
  const accent = useAppAccent();
  const indicatorColor = color ?? accent ?? COLORS.primary;
  return <ActivityIndicator size={size === 'xSmall' || size === 'small' || size === 'medium' ? 'small' : 'large'} color={indicatorColor} style={style} animating={animating} />;
}
