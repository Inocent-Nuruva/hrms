import React from 'react';
import { Animated, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { COLORS } from '../../lib/config';
import { Text } from './text';
import { useAppAccent } from '../../hooks/useAppAccent';

type Segment = {
  key: string;
  label: string;
}

export function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Segment[];
}) {
  const isDark = useColorScheme() === 'dark';
  const accent = useAppAccent();
  const [width, setWidth] = React.useState(0);
  const [translateX] = React.useState(() => new Animated.Value(0));
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === value)
  );
  const segmentWidth = width && options.length ? (width - 8 - (options.length - 1) * 4) / options.length : 0;

  React.useEffect(() => {
    if (!segmentWidth) return;
    Animated.spring(translateX, {
      toValue: activeIndex * (segmentWidth + 4),
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [activeIndex, segmentWidth, translateX]);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant,
          borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
        },
      ]}
    >
      {segmentWidth ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeSegment,
            {
              width: segmentWidth,
              backgroundColor: isDark ? '#f4f4f5' : accent,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.segment,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: active
                    ? isDark
                      ? '#111111'
                      : '#ffffff'
                    : isDark
                      ? COLORS.onSurfaceVariantDark
                      : COLORS.onSurfaceVariant,
                },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    width: '100%',
    position: 'relative',
  },
  activeSegment: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 6,
  },
  segment: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
});
