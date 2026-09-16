import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Clock3, MapPin, Navigation } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, normalizeList, buildMobilePunchPayload, formatAttendancePunchError } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { Text } from '../components/ui/text';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
}

export function AttendanceScreen({ auth }: Props) {
  const { isDark } = useThemePreference();
  const queryClient = useQueryClient();
  const router = useRouter();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const panelColor = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const lineColor = isDark ? COLORS.outlineDark : COLORS.outline;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const punchesQuery = useQuery({
    queryKey: ['mobileAttendancePunches'],
    queryFn: async () => normalizeList(await api.listMyPunches({ limit: 30 })),
    enabled: auth.isAuthenticated,
  });

  const todayQuery = useQuery({
    queryKey: ['mobileAttendanceToday'],
    queryFn: async () => asRecord(await api.getMyAttendanceToday()),
    enabled: auth.isAuthenticated,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const payload = await buildMobilePunchPayload({ overrideReason: 'New check in' });
      return api.checkIn(payload);
    },
    onSuccess: () => {
      setStatusMessage('Check-in recorded successfully.');
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeAttendanceToday'] }),
      ]);
    },
    onError: (error: unknown) => {
      setStatusMessage(formatAttendancePunchError(error, 'check-in'));
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const payload = await buildMobilePunchPayload({ overrideReason: 'New check out' });
      return api.checkOut(payload);
    },
    onSuccess: () => {
      setStatusMessage('Check-out recorded successfully.');
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeAttendanceToday'] }),
      ]);
    },
    onError: (error: unknown) => {
      setStatusMessage(formatAttendancePunchError(error, 'check-out'));
    },
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      punchesQuery.refetch(),
      todayQuery.refetch(),
    ]);
  }, [punchesQuery, todayQuery]);

  const attendanceSummary = useMemo(
    () => buildAttendanceSummary(punchesQuery.data, todayQuery.data),
    [punchesQuery.data, todayQuery.data]
  );
  const primaryAction = attendanceSummary.nextAction;
  const busy = checkInMutation.isPending || checkOutMutation.isPending;
  const actionLabel = busy ? (primaryAction === 'in' ? 'Checking In...' : 'Checking Out...') : primaryAction === 'in' ? 'Check-In' : 'Check-Out';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} title="Attendance" variant="centered" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={punchesQuery.isFetching || todayQuery.isFetching} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition style={{ flex: 1 }}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Today</Text>
              <Text style={[styles.dateText, { color: mutedColor }]}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>

          <Card style={styles.attendanceCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: primaryAction === 'out' ? COLORS.success : COLORS.outline }]} />
              <View style={styles.statusCopy}>
                <Text style={[styles.statusTitle, { color: textColor }]}>
                  {primaryAction === 'out' ? 'You are checked in' : 'You are not checked in'}
                </Text>
                <Text style={[styles.statusHelp, { color: mutedColor }]}>Location will be included with this attendance record.</Text>
              </View>
            </View>

            <Button
              loading={busy}
              onPress={() => {
                setStatusMessage(null);
                if (primaryAction === 'in') void checkInMutation.mutateAsync();
                else void checkOutMutation.mutateAsync();
              }}
              leftIcon={<Navigation size={18} color={COLORS.onPrimary} />}
            >
              {actionLabel}
            </Button>
          </Card>

          <View style={[styles.statsCard, { backgroundColor: panelColor, borderColor: lineColor }]}>
            <StatItem label="Check in" value={attendanceSummary.checkInTime} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.verticalDivider, { backgroundColor: lineColor }]} />
            <StatItem label="Check out" value={attendanceSummary.checkOutTime} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.verticalDivider, { backgroundColor: lineColor }]} />
            <StatItem label="Hours" value={attendanceSummary.totalHours} textColor={textColor} mutedColor={mutedColor} />
          </View>

          {statusMessage ? (
            <View style={[styles.statusBanner, { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant, borderColor: lineColor }]}>
              <Text style={[styles.statusBannerText, { color: textColor }]}>{statusMessage}</Text>
            </View>
          ) : null}

          <Text style={[styles.moreTitle, { color: textColor }]}>Attendance tools</Text>
          <View style={styles.secondaryActions}>
            <Button variant="outline" style={styles.secondaryButton} onPress={() => router.push('/punch-details')} leftIcon={<Clock3 size={17} color={textColor} />}>
              Punch details
            </Button>
            <Button variant="outline" style={styles.secondaryButton} onPress={() => router.push('/my-location')} leftIcon={<MapPin size={17} color={textColor} />}>
              My location
            </Button>
          </View>
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({
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
    <View style={styles.statItem}>
      <Clock3 size={16} color={mutedColor} />
      <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}



function buildAttendanceSummary(items: unknown[] | undefined, todayRecord: MobileRecord | null | undefined) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPunches = (items || [])
    .map((item) => asRecord(item))
    .filter((item): item is MobileRecord => Boolean(item))
    .filter((item) => {
      const stamp = readString(item, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']);
      if (!stamp) return false;
      return new Date(stamp).toISOString().slice(0, 10) === todayKey;
    })
    .sort((a, b) => {
      const left = new Date(readString(a, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) || 0).getTime();
      const right = new Date(readString(b, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) || 0).getTime();
      return left - right;
    });

  const checkIn = todayPunches.find((item) => readString(item, ['punch_type', 'punchType', 'type']).toLowerCase().includes('in'));
  const reversed = [...todayPunches].reverse();
  const checkOut = reversed.find((item) => readString(item, ['punch_type', 'punchType', 'type']).toLowerCase().includes('out'));
  const lastPunchType = readString(reversed[0], ['punch_type', 'punchType', 'type']).toLowerCase();
  const todayCheckIn = readString(todayRecord, ['checkInAt', 'check_in_at', 'firstCheckInAt', 'first_check_in_at']);
  const todayCheckOut = readString(todayRecord, ['checkOutAt', 'check_out_at', 'lastCheckOutAt', 'last_check_out_at']);
  const requiresCheckout =
    readBoolean(todayRecord, ['requiresCheckout', 'requires_checkout']) ||
    readBoolean(asRecord(todayRecord?.flags), ['requiresCheckout', 'requires_checkout']);
  const nextAction =
    requiresCheckout || (todayCheckIn && !todayCheckOut)
      ? 'out'
      : lastPunchType.includes('in')
        ? 'out'
        : 'in';

  let totalHours = '00:00:00';
  if (checkIn && checkOut) {
    const start = new Date(readString(checkIn, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt'])).getTime();
    const end = new Date(readString(checkOut, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt'])).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const diff = end - start;
      const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      totalHours = `${hours}:${minutes}:${seconds}`;
    }
  }

  return {
    checkInTime: formatTime(checkIn ? readString(checkIn, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) : ''),
    checkOutTime: formatTime(checkOut ? readString(checkOut, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) : ''),
    totalHours,
    nextAction,
  };
}

function asRecord(value: unknown): MobileRecord | null {
  return value && typeof value === 'object' ? (value as MobileRecord) : null;
}

function readString(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return '';

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return '';
}

function readBoolean(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return false;

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }

  return false;
}

function formatTime(value: string) {
  if (!value) return '--:--';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}




const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 28,
    flexGrow: 1,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  attendanceCard: {
    gap: 20,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusCopy: {
    flex: 1,
    gap: 3,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusHelp: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsCard: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    marginHorizontal: 6,
  },
  statusBanner: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  moreTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
  },
});
