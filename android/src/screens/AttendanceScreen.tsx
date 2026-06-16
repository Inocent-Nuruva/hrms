import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Clock3, MapPinned, ShieldCheck } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusPill } from '../components/ui/status-pill';
import type { UseAuthReturn } from '../hooks/useAuth';

interface Props {
  auth: UseAuthReturn;
}

export function AttendanceScreen({ auth }: Props) {
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const subtleBlock = isDark ? COLORS.surfaceVariantDark : '#f5f5f5';

  const punchesQuery = useQuery({
    queryKey: ['mobileAttendancePunches'],
    queryFn: async () => normalizeList(await api.listMyPunches({ limit: 30 })),
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const payload = await getPunchLocation();
      return api.checkIn(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] });
      Alert.alert('Checked in', 'Your attendance punch was recorded successfully.');
    },
    onError: (error: unknown) => Alert.alert('Check-in failed', error instanceof Error ? error.message : 'Please try again.'),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const payload = await getPunchLocation();
      return api.checkOut(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] });
      Alert.alert('Checked out', 'Your check-out punch was recorded successfully.');
    },
    onError: (error: unknown) => Alert.alert('Check-out failed', error instanceof Error ? error.message : 'Please try again.'),
  });

  const onRefresh = React.useCallback(async () => {
    await punchesQuery.refetch();
  }, [punchesQuery]);

  const runCheckIn = async () => {
    setBusy(true);
    try {
      await checkInMutation.mutateAsync();
    } finally {
      setBusy(false);
    }
  };

  const runCheckOut = async () => {
    setBusy(true);
    try {
      await checkOutMutation.mutateAsync();
    } finally {
      setBusy(false);
    }
  };

  const employeeName =
    auth.user?.fullName ||
    [auth.employee?.first_name, auth.employee?.last_name].filter(Boolean).join(' ') ||
    'Employee';
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={punchesQuery.isFetching} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: textColor }]}>Track today’s work time</Text>
            </View>
            <View style={[styles.heroIconWrap, { backgroundColor: subtleBlock }]}>
              <Clock3 size={22} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.metaRow}>
            <MiniMeta label="Employee" value={employeeName} textColor={textColor} mutedColor={mutedColor} />
            <MiniMeta label="Today" value={todayLabel} textColor={textColor} mutedColor={mutedColor} />
          </View>
        </Card>

        <View style={styles.actionRow}>
          <Button onPress={runCheckIn} loading={busy && checkInMutation.isPending} style={styles.flexButton}>
            Check in
          </Button>
          <Button
            variant="outline"
            onPress={runCheckOut}
            loading={busy && checkOutMutation.isPending}
            style={styles.flexButton}
          >
            Check out
          </Button>
        </View>

        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Recent punches</Text>
            <ShieldCheck size={18} color={COLORS.primary} />
          </View>
          {punchesQuery.data?.length ? (
            punchesQuery.data.map((item, index: number) => {
              const type = item.punch_type || item.type || item.punchType || 'Punch';
              const timestamp = item.punched_at || item.timestamp || item.created_at;
              const status = String(item.validation_status || item.status || 'Recorded');
              return (
                <View key={index} style={[styles.punchRow, index !== 0 ? styles.withTopBorder : null]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.punchTitle, { color: textColor }]}>
                      {String(type).replaceAll('_', ' ')}
                    </Text>
                    <Text style={[styles.punchMeta, { color: mutedColor }]}>
                      {formatDateTime(timestamp)}
                    </Text>
                  </View>
                  <StatusPill label={status} tone={statusTone(status)} />
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No punches recorded yet.</Text>
          )}
        </Card>

        <Card>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Validation note</Text>
            <MapPinned size={18} color={COLORS.primary} />
          </View>
          <Text style={[styles.noteText, { color: mutedColor }]}>
            Your organization may require approved location, device, or checkpoint validation before a punch is accepted.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

async function getPunchLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required before checking in or out.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function MiniMeta({
  label,
  value,
  textColor,
  mutedColor,
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.metaBlock}>
      <Text style={[styles.metaLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: textColor }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  const value = status.toLowerCase();
  if (value.includes('approve') || value.includes('valid') || value.includes('record')) return 'success';
  if (value.includes('reject') || value.includes('fail')) return 'danger';
  return 'warning';
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaBlock: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
  },
  withTopBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d4d4d8',
  },
  punchTitle: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  punchMeta: {
    marginTop: 4,
    fontSize: 13,
  },
  emptyText: {
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  noteText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
});
