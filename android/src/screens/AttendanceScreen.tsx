import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Clock3, Navigation, ShieldCheck } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, normalizeList, buildMobilePunchPayload, formatAttendancePunchError } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import { TouchableScale } from '../components/ui/touchable-scale';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';

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
      <MobileTopBar auth={auth} variant="compact" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={punchesQuery.isFetching || todayQuery.isFetching} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition style={{ flex: 1 }}>
          <View style={styles.topContent}>
            <View style={styles.dateWrap}>
              <Text style={[styles.dateText, { color: textColor }]}>
                {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>

            <TouchableScale
              style={styles.fingerprintAction}
              pressedScale={0.97}
              onPress={() => {
                setStatusMessage(null);
                if (primaryAction === 'in') {
                  void checkInMutation.mutateAsync();
                } else {
                  void checkOutMutation.mutateAsync();
                }
              }}
            >
              <View style={styles.fingerprintGlow}>
                <View style={styles.fingerprintCircle}>
                  <Navigation size={16} color={COLORS.primary} style={styles.fingerprintAccent} />
                  <ShieldCheck size={48} color={COLORS.primary} />
                </View>
              </View>
              <Text style={[styles.fingerprintLabel, { color: textColor }]}>{actionLabel}</Text>
            </TouchableScale>

            <View style={[styles.statsCard, { backgroundColor: panelColor, borderColor: lineColor }]}>
              <StatItem label="Check In" value={attendanceSummary.checkInTime} textColor={textColor} mutedColor={mutedColor} />
              <View style={[styles.verticalDivider, { backgroundColor: lineColor }]} />
              <StatItem label="Check Out" value={attendanceSummary.checkOutTime} textColor={textColor} mutedColor={mutedColor} />
              <View style={[styles.verticalDivider, { backgroundColor: lineColor }]} />
              <StatItem label="Total Hrs." value={attendanceSummary.totalHours} textColor={textColor} mutedColor={mutedColor} />
            </View>

            {statusMessage ? (
              <View style={[styles.statusBanner, { backgroundColor: isDark ? COLORS.surfaceVariantDark : '#e8ebf5', borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
                <Text style={[styles.statusBannerText, { color: textColor }]}>{statusMessage}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.centeredContainer}>
            <View style={styles.centeredActions}>
              <TouchableScale
                style={[styles.secondaryButton, { backgroundColor: COLORS.primary }]}
                pressedScale={0.98}
                onPress={() => router.push('/punch-details')}
              >
                <Text style={styles.secondaryButtonText}>Punch Details</Text>
              </TouchableScale>
              <TouchableScale
                style={[styles.secondaryButton, { backgroundColor: COLORS.accent }]}
                pressedScale={0.98}
                onPress={() => router.push('/my-location')}
              >
                <Text style={styles.secondaryButtonText}>My Location</Text>
              </TouchableScale>
            </View>
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
    paddingTop: 6,
    paddingBottom: 28,
    flexGrow: 1,
  },
  topContent: {},
  dateWrap: {
    alignItems: 'center',
    marginTop: 6,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
    color: '#6b7280',
  },
  fingerprintAction: {
    alignItems: 'center',
    marginTop: 4,
  },
  fingerprintGlow: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(134, 239, 172, 0.22)',
  },
  fingerprintCircle: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#e0e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerprintAccent: {
    position: 'absolute',
    top: 18,
    right: 20,
  },
  fingerprintLabel: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
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
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  centeredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  centeredActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
