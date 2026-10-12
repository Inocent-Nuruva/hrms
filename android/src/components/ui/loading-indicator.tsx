import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';
import { useAppAccent } from '../../hooks/useAppAccent';

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  type?: 'dot-circle';
}

const SIZE_MAP = {
  sm: 26,
  md: 36,
  lg: 48,
} as const;

export function LoadingIndicator({
  size = 'md',
  type = 'dot-circle',
}: LoadingIndicatorProps) {
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const [spin] = React.useState(() => new Animated.Value(0));
  const dimension = SIZE_MAP[size];

  React.useEffect(() => {
    if (type !== 'dot-circle') return;

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [spin, type]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const dotColor = isDark ? '#f4f4f5' : accent;
  const fadedColor = isDark ? 'rgba(244,244,245,0.22)' : 'rgba(67,56,202,0.18)';
  const ringRadius = dimension / 2;
  const dotSize = Math.max(5, Math.round(dimension / 6));
  const orbitRadius = dimension / 2.6;

  return (
    <Animated.View style={[styles.container, { width: dimension, height: dimension, transform: [{ rotate }] }]}>
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        const x = Math.cos(angle) * orbitRadius + ringRadius - dotSize / 2;
        const y = Math.sin(angle) * orbitRadius + ringRadius - dotSize / 2;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                left: x,
                top: y,
                backgroundColor: index === 0 ? dotColor : fadedColor,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
  },
});
