import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../lib/config';
import { Text } from './text';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<Tone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: '#f4f4f5', color: '#27272a' },
  success: { backgroundColor: '#dcfce7', color: '#166534' },
  warning: { backgroundColor: '#fef3c7', color: '#92400e' },
  danger: { backgroundColor: '#fee2e2', color: '#dd3740' },
  info: { backgroundColor: '#e0e5f5', color: COLORS.primary || '#2e3d8a' },
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, { backgroundColor: TONE_STYLES[tone].backgroundColor }]}>
      <Text style={[styles.label, { color: TONE_STYLES[tone].color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
