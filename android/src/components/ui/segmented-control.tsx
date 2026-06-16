import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { COLORS } from '../../lib/config';

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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? COLORS.surfaceVariantDark : '#f5f5f5',
          borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
        },
      ]}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.segment,
              active ? { backgroundColor: isDark ? '#f4f4f5' : COLORS.primary } : null,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    width: '100%',
  },
  segment: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
