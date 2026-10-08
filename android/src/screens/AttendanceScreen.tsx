import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Clock3, MapPin, Navigation2 } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, normalizeList, buildMobilePunchPayload, formatAttendancePunchError } from '../lib/api';
import { COLORS } from '../lib/config';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent } from '../lib/profile-card-background';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';
import { Text } from '../components/ui/text';
import { FluentSystemIcon } from '../components/ui/fluent-system-icon';
import {
  AttendanceSelfieModal,
  type AttendanceSelfie,
} from '../components/attendance/AttendanceSelfieModal';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
}

export function AttendanceScreen({ auth }: Props) {
  const { isDark } = useThemePreference();
  const paletteQuery = useQuery({ queryKey: ['dashboardCardStyle'], queryFn: () => api.getMyDashboardCardStyle(), enabled: auth.isAuthenticated });
  const selectedStyle = normalizeProfileCardStyle(paletteQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const actionColor = profilePaletteAccent(selectedStyle.palette, isDark);
  const queryClient = useQueryClient();
  const router = useRouter();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const panelColor = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const lineColor = isDark ? COLORS.outlineDark : COLORS.outline;
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const toast = useToast();
  const [fingerprintPulse] = React.useState(() => new Animated.Value(1));

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
    mutationFn: async (selfie: AttendanceSelfie) => {
      const payload = await buildMobilePunchPayload({ overrideReason: 'New check in' });
      return api.checkIn({
        ...payload,
        selfie: {
          fileName: selfie.fileName,
          fileSize: selfie.fileSize,
          mimeType: selfie.mimeType,
          fileString: selfie.fileString,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Check-in recorded successfully.');
      setSelfieError(null);
      setSelfieModalVisible(false);
      Vibration.vibrate([0, 24, 45, 34]);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeWeeklyAttendance'] }),
      ]);
    },
    onError: (error: unknown) => {
      const message = formatAttendancePunchError(error, 'check-in');
      toast.error(message);
      setSelfieError(message);
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const payload = await buildMobilePunchPayload({ overrideReason: 'New check out' });
      return api.checkOut(payload);
    },
    onSuccess: async () => {
      toast.success('Check-out recorded successfully.');
      Vibration.vibrate([0, 24, 45, 34]);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeWeeklyAttendance'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(formatAttendancePunchError(error, 'check-out'));
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
  React.useEffect(() => {
    if (!busy) {
      fingerprintPulse.stopAnimation();
      fingerprintPulse.setValue(1);
      return;
    }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(fingerprintPulse, { toValue: 1.18, duration: 480, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(fingerprintPulse, { toValue: 0.92, duration: 480, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [busy, fingerprintPulse]);
  const attendanceLoading = punchesQuery.isLoading || todayQuery.isLoading;
  const actionPending = busy || attendanceLoading;
  const actionLabel = attendanceLoading
    ? 'Loading attendance…'
    : busy
      ? primaryAction === 'in' ? 'Checking in…' : 'Checking out…'
      : primaryAction === 'in' ? 'Check in' : 'Check out';
  const checkInTime = attendanceSummary.checkInTime;
  const isCheckedIn = primaryAction === 'out';
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} title="Attendance" variant="centered" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={[styles.content, { backgroundColor }]}
        refreshControl={<RefreshControl refreshing={punchesQuery.isFetching || todayQuery.isFetching} onRefresh={onRefresh} colors={[actionColor]} />}
      >
        <ScreenTransition style={{ flex: 1 }}>
          <View style={styles.pageHeading}>
            <View style={styles.headingCopy}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                {isCheckedIn ? 'You’re on the clock' : 'Ready when you are'}
              </Text>
              <Text style={[styles.statusHelp, { color: mutedColor }]}>
                {isCheckedIn && checkInTime !== '--:--'
                  ? `Your workday started at ${checkInTime}.`
                  : 'Check in to start your workday.'}
              </Text>
              <Text style={[styles.dateText, { color: mutedColor }]}>{todayLabel}</Text>
            </View>
            <View style={styles.statePill}>
              <View style={[styles.statusDot, { backgroundColor: actionColor }]} />
              <Text style={[styles.statePillText, { color: actionColor }]}>{isCheckedIn ? 'CHECKED IN' : 'OFF DUTY'}</Text>
            </View>
          </View>

          <View style={[styles.metricsSection, { borderTopColor: lineColor }]}>
            <View style={styles.timeMetricsRow}>
              <TimeMetric label="CHECK IN" value={attendanceSummary.checkInTime} actionColor={actionColor} mutedColor={mutedColor} />
              <View style={[styles.metricDivider, { backgroundColor: lineColor }]} />
              <TimeMetric label="CHECK OUT" value={attendanceSummary.checkOutTime} actionColor={actionColor} mutedColor={mutedColor} />
            </View>
            <HoursWorked
              startedAt={attendanceSummary.checkInAt}
              endedAt={attendanceSummary.checkOutAt}
              breakMinutes={attendanceSummary.breakMinutes}
              fallback={attendanceSummary.totalHours}
              actionColor={actionColor}
              mutedColor={mutedColor}
            />
          </View>

          <Text style={[styles.moreTitle, { color: textColor }]}>More</Text>
          <View style={styles.toolList}>
            <Pressable style={[styles.navigationRow, { borderBottomColor: lineColor }]} onPress={() => router.push('/punch-details')}>
              <Clock3 size={18} color={actionColor} />
              <Text style={[styles.navigationText, { color: textColor }]}>Punch history</Text>
              <ArrowRight size={16} color={mutedColor} />
            </Pressable>
            <Pressable style={styles.navigationRow} onPress={() => router.push('/(tabs)/location')}>
              <MapPin size={18} color={actionColor} />
              <Text style={[styles.navigationText, { color: textColor }]}>Work location</Text>
              <ArrowRight size={16} color={mutedColor} />
            </Pressable>
          </View>
        </ScreenTransition>
      </ScrollView>
      <SafeAreaView style={[styles.bottomActionArea, { backgroundColor, borderTopColor: lineColor }]} edges={['bottom']}>
        <View style={styles.locationHint}>
          <Navigation2 size={13} color={mutedColor} />
          <Text style={[styles.locationHintText, { color: mutedColor }]}>Location is included with your attendance record</Text>
        </View>
        <View style={styles.bottomButtonStage}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            disabled={actionPending}
            onPressIn={() => {
              if (!actionPending) {
                Vibration.vibrate(12);
                Animated.spring(fingerprintPulse, { toValue: 1.18, useNativeDriver: true, speed: 28, bounciness: 9 }).start();
              }
            }}
            onPressOut={() => {
              if (!busy) Animated.spring(fingerprintPulse, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5 }).start();
            }}
            onPress={() => {
              if (actionPending) return;
              if (primaryAction === 'in') {
                setSelfieError(null);
                setSelfieModalVisible(true);
              } else {
                Vibration.vibrate(18);
                void checkOutMutation.mutateAsync();
              }
            }}
            style={({ pressed }) => [
              styles.punchButton,
              { borderColor: actionColor },
              (busy || pressed) && styles.punchButtonBusy,
            ]}
          >
            {actionPending ? <ActivityIndicator size="small" color={actionColor} /> : (
              <Animated.View style={{ transform: [{ scale: fingerprintPulse }] }}>
                <FluentSystemIcon name="fingerprint" size={35} color={actionColor} />
              </Animated.View>
            )}
            <Text style={[styles.punchButtonText, { color: actionColor }]}>{actionLabel}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <AttendanceSelfieModal
        visible={selfieModalVisible}
        submitting={checkInMutation.isPending}
        errorMessage={selfieError}
        onClose={() => {
          if (!checkInMutation.isPending) setSelfieModalVisible(false);
        }}
        onSubmit={(selfie) => {
          setSelfieError(null);
          void checkInMutation.mutateAsync(selfie);
        }}
      />
    </SafeAreaView>
  );
}

function TimeMetric({ label, value, actionColor, mutedColor }: { label: string; value: string; actionColor: string; mutedColor: string }) {
  return (
    <View style={styles.timeMetric}>
      <Text style={[styles.statLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.statValue, { color: actionColor, textShadowColor: `${actionColor}44` }]}>{value}</Text>
    </View>
  );
}

function HoursWorked({
  startedAt,
  endedAt,
  breakMinutes,
  fallback,
  actionColor,
  mutedColor,
}: {
  startedAt: string;
  endedAt: string;
  breakMinutes: number;
  fallback: string;
  actionColor: string;
  mutedColor: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const [sheen] = React.useState(() => new Animated.Value(1));
  const running = Boolean(startedAt && !endedAt);

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  React.useEffect(() => {
    if (!running) return;
    Animated.sequence([
      Animated.timing(sheen, { toValue: 1.035, duration: 180, useNativeDriver: true }),
      Animated.timing(sheen, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [now, running, sheen]);

  const start = startedAt ? new Date(startedAt).getTime() : NaN;
  const end = endedAt ? new Date(endedAt).getTime() : now;
  const netDuration = end - start - breakMinutes * 60_000;
  const duration = Number.isFinite(start) && end >= start
    ? formatDuration(Math.max(0, netDuration))
    : fallback;

  return (
    <View style={styles.hoursMetric}>
      <Text style={[styles.statLabel, { color: mutedColor }]}>HOURS WORKED</Text>
      <Animated.View style={{ transform: [{ scale: running ? sheen : 1 }] }}>
        <Text style={[styles.hoursValue, { color: actionColor, textShadowColor: `${actionColor}55` }]}>{duration}</Text>
      </Animated.View>
      <View style={[styles.hoursSheen, { backgroundColor: actionColor }]} />
    </View>
  );
}



function buildAttendanceSummary(items: unknown[] | undefined, todayRecord: MobileRecord | null | undefined) {
  const todaySummary = asRecord(todayRecord?.summary);
  const recordedBreakMinutes = readNumber(todaySummary, ['break_minutes', 'breakMinutes']);
  const scheduledBreakMinutes = readNumber(todayRecord, ['scheduled_break_minutes', 'scheduledBreakMinutes']);
  const todayKey = readString(todayRecord, ['date']) || new Date().toISOString().slice(0, 10);
  const responsePunches = Array.isArray(todayRecord?.punches) ? todayRecord.punches : [];
  const todayPunches = [...(items || []), ...responsePunches]
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
  const firstPunch = asRecord(todayRecord?.first_punch);
  const lastPunch = asRecord(todayRecord?.last_punch);
  const todayCheckIn =
    readString(todaySummary, ['checkInAt', 'check_in_at', 'first_punch', 'first_punch_at']) ||
    (readString(firstPunch, ['punch_type', 'punchType', 'type']).toLowerCase().includes('in')
      ? readString(firstPunch, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt'])
      : '');
  const todayCheckOut =
    readString(todaySummary, ['checkOutAt', 'check_out_at', 'last_punch', 'last_punch_at']) ||
    (readString(lastPunch, ['punch_type', 'punchType', 'type']).toLowerCase().includes('out')
      ? readString(lastPunch, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt'])
      : '');
  const actionFlags = asRecord(todayRecord?.action_flags);
  const punchState = readString(todayRecord, ['punch_state']).toLowerCase();
  const nextAction =
    readBoolean(actionFlags, ['can_check_out']) ||
    punchState === 'checked_in' ||
    (todayCheckIn && !todayCheckOut)
      ? 'out'
      : lastPunchType.includes('in')
        ? 'out'
        : 'in';

  let totalHours = '00:00:00';
  const checkInValue = todayCheckIn || readString(checkIn, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']);
  const checkOutValue = todayCheckOut || readString(checkOut, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']);
  if (checkInValue && checkOutValue) {
    const start = new Date(checkInValue).getTime();
    const end = new Date(checkOutValue).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const diff = end - start;
      const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      totalHours = `${hours}:${minutes}:${seconds}`;
    }
  }

  return {
    checkInTime: formatTime(checkInValue),
    checkOutTime: formatTime(checkOutValue),
    checkInAt: checkInValue,
    checkOutAt: checkOutValue,
    breakMinutes: recordedBreakMinutes > 0 ? recordedBreakMinutes : scheduledBreakMinutes,
    totalHours,
    nextAction,
  };
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
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

function readNumber(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return 0;

  for (const key of keys) {
    const candidate = record[key];
    const parsed = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headingCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 3,
  },
  dateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statePillText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.45,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusHelp: {
    fontSize: 11,
    lineHeight: 16,
  },
  bottomActionArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  bottomButtonStage: {
    minHeight: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchButton: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    padding: 12,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    shadowOpacity: 0,
    elevation: 0,
    zIndex: 1,
  },
  punchButtonBusy: {
    opacity: 0.82,
  },
  punchButtonText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginLeft: 0,
  },
  locationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  locationHintText: {
    fontSize: 11,
    lineHeight: 16,
  },
  metricsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  timeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeMetric: {
    flex: 1,
    minHeight: 55,
    justifyContent: 'center',
    gap: 5,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    marginHorizontal: 17,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.45,
  },
  hoursMetric: {
    alignItems: 'center',
    gap: 4,
    marginTop: 11,
    paddingTop: 9,
  },
  hoursValue: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  hoursSheen: {
    width: 42,
    height: 2,
    borderRadius: 2,
    opacity: 0.68,
  },
  moreTitle: {
    marginTop: 22,
    marginBottom: 9,
    fontSize: 15,
    fontWeight: '700',
  },
  toolList: {
    marginHorizontal: 2,
  },
  navigationRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navigationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
