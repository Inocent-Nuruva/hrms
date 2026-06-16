import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                active
                  ? { backgroundColor: isDark ? '#f4f4f5' : '#111111' }
                  : null,
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
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingRight: 8,
  },
  container: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
