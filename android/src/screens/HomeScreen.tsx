import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Clock3,
  Fingerprint,
  UserRound,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, normalizeList, buildMobilePunchPayload, formatAttendancePunchError } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ScreenTransition } from '../components/ui/screen-transition';
import { TouchableScale } from '../components/ui/touchable-scale';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';
import { Text } from '../components/ui/text';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
  onTabChange?: (tab: 'attendance' | 'leave' | 'profile') => void;
}

export function HomeScreen({ auth, onTabChange }: Props) {
  const queryClient = useQueryClient();
  const { isDark } = useThemePreference();
  const employee = asRecord(auth.employee) || asRecord(auth.user);
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? '#a1a1aa' : '#6b7280';
  const [attendanceActionOverride, setAttendanceActionOverride] = React.useState<'in' | 'out' | null>(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  const toast = useToast();

  const balancesQuery = useQuery({
    queryKey: ['mobileHomeLeaveBalances'],
    queryFn: async () => normalizeList(await api.listMyLeaveBalances({ limit: 6 })),
    enabled: auth.isAuthenticated,
  });

  const requestsQuery = useQuery({
    queryKey: ['mobileHomeLeaveRequests'],
    queryFn: async () => normalizeList(await api.listMyLeaveRequests({ limit: 6 })),
    enabled: auth.isAuthenticated,
  });

  const punchesQuery = useQuery({
    queryKey: ['mobileHomePunches'],
    queryFn: async () => normalizeList(await api.listMyPunches({ limit: 20 })),
    enabled: auth.isAuthenticated,
  });

  const todayAttendanceQuery = useQuery({
    queryKey: ['mobileHomeAttendanceToday'],
    queryFn: async () => asRecord(await api.getMyAttendanceToday()),
    enabled: auth.isAuthenticated,
  });

  const holidaysQuery = useQuery({
    queryKey: ['mobileHomeHolidays'],
    queryFn: async () => normalizeList(await api.listHolidays({ limit: 12 })),
    enabled: auth.isAuthenticated,
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      balancesQuery.refetch(),
      requestsQuery.refetch(),
      punchesQuery.refetch(),
      todayAttendanceQuery.refetch(),
      holidaysQuery.refetch(),
    ]);
  }, [balancesQuery, holidaysQuery, punchesQuery, requestsQuery, todayAttendanceQuery]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const payload = await buildMobilePunchPayload({ overrideReason: 'New check in' });
      return api.checkIn(payload);
    },
    onSuccess: () => {
      setAttendanceActionOverride('out');
      toast.success('Your attendance punch was recorded successfully.');
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mobileHomePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendanceToday'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(formatAttendancePunchError(error, 'check-in'));
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const payload = await buildMobilePunchPayload({ overrideReason: 'New check out' });
      return api.checkOut(payload);
    },
    onSuccess: () => {
      setAttendanceActionOverride('in');
      toast.success('Your check-out punch was recorded successfully.');
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mobileHomePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileHomeAttendanceToday'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendancePunches'] }),
        queryClient.invalidateQueries({ queryKey: ['mobileAttendanceToday'] }),
      ]);
    },
    onError: (error: unknown) => {
      toast.error(formatAttendancePunchError(error, 'check-out'));
    },
  });

  const employeeName =
    auth.user?.fullName ||
    [readString(employee, ['first_name']), readString(employee, ['last_name'])].filter(Boolean).join(' ') ||
    'Employee';
  const employeeFirstName =
    readString(employee, ['first_name']) ||
    auth.user?.fullName?.trim().split(/\s+/)[0] ||
    employeeName.trim().split(/\s+/)[0] ||
    'Employee';
  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const greeting = getGreeting(today);
  const lastPunch = punchesQuery.data?.[0];
  const lastPunchType = String(lastPunch?.punch_type || lastPunch?.punchType || lastPunch?.type || '').toLowerCase();
  const todayCheckIn = readString(todayAttendanceQuery.data, ['checkInAt', 'check_in_at', 'firstCheckInAt', 'first_check_in_at']);
  const todayCheckOut = readString(todayAttendanceQuery.data, ['checkOutAt', 'check_out_at', 'lastCheckOutAt', 'last_check_out_at']);
  const requiresCheckout =
    readBoolean(todayAttendanceQuery.data, ['requiresCheckout', 'requires_checkout']) ||
    readBoolean(asRecord(todayAttendanceQuery.data?.flags), ['requiresCheckout', 'requires_checkout']);
  const nextAttendanceAction =
    attendanceActionOverride ||
    (requiresCheckout || (todayCheckIn && !todayCheckOut) ? 'out' : lastPunchType.includes('in') ? 'out' : 'in');
  const availableLeaveDays = sumNumbers(balancesQuery.data, ['remaining', 'balance']);
  const pendingRequests = requestsQuery.data?.filter((item) =>
    String(item.status || '').toLowerCase().includes('pending')
  ).length ?? 0;
  const holidayCount = holidaysQuery.data?.length ?? 0;
  const workedDays = countUniquePunchDays(punchesQuery.data || []);
  const totalDays = daysInMonth(today);
  const absentDays = Math.max(totalDays - workedDays - holidayCount, 0);
  const remainingTime = getRemainingWorkTime(currentTime);
  const approvedLeavesThisMonth = (requestsQuery.data || []).filter((item) => {
    const status = String(item?.status || '').toLowerCase();
    const isApproved = status.includes('approve') || status.includes('used') || status.includes('complete') || status.includes('taken');
    if (!isApproved) return false;
    const start = readString(item, ['start_date', 'from_date', 'start', 'date']);
    if (start) {
      const d = new Date(start);
      if (!isNaN(d.getTime()) && (d.getFullYear() !== today.getFullYear() || d.getMonth() !== today.getMonth())) {
        return false;
      }
    }
    return true;
  }).length;

  const quickMenu = [
    { label: 'My Information', icon: <UserRound size={14} color={COLORS.primary} />, tab: 'profile' as const },
    { label: 'Attendance', icon: <Fingerprint size={14} color={COLORS.primary} />, tab: 'attendance' as const },
    { label: 'Leave', icon: <CalendarDays size={14} color={COLORS.primary} />, tab: 'leave' as const },
  ];

  const monthSummary = [
    { label: 'Total Days', value: String(totalDays), tone: isDark ? '#dd3740' : '#e0e5f5' },
    { label: 'Working Days', value: String(workedDays), tone: isDark ? COLORS.primary : '#d8ddf0' },
    { label: 'Week Off', value: String(getWeekendCount(today.getFullYear(), today.getMonth())), tone: isDark ? '#67e8f9' : '#e8ebf5' },
    { label: 'Holiday', value: String(holidayCount), tone: isDark ? '#4ade80' : '#e0e5f5' },
    { label: 'No Pay', value: formatCompactNumber(absentDays), tone: isDark ? '#fbbf24' : '#f0f2f8' },
    { label: 'Leave', value: String(approvedLeavesThisMonth), tone: isDark ? COLORS.accent : '#e8ebf5' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} title={`Hi, ${employeeFirstName}`} subtitle={greeting} variant="dashboard" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={
              balancesQuery.isFetching ||
              requestsQuery.isFetching ||
              punchesQuery.isFetching ||
              todayAttendanceQuery.isFetching ||
              holidaysQuery.isFetching
            }
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        <ScreenTransition style={styles.screenTransition}>
          <View style={styles.content}>
            <Card style={styles.checkCard}>
              <View style={styles.checkHeader}>
                <View style={styles.checkHeaderCopy}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Today&apos;s attendance</Text>
                  <Text style={[styles.checkMeta, { color: mutedColor }]}>{todayLabel} · Regular shift</Text>
                </View>
                <View style={[styles.attendanceStatus, { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant }]}>
                  <Text style={[styles.attendanceStatusText, { color: nextAttendanceAction === 'out' ? COLORS.success : mutedColor }]}>
                    {nextAttendanceAction === 'out' ? 'Checked in' : 'Not checked in'}
                  </Text>
                </View>
              </View>
              <View style={styles.timeRow}>
                <Clock3 size={17} color={mutedColor} />
                <Text style={[styles.timeLabel, { color: mutedColor }]}>Time remaining</Text>
                <Text style={[styles.timeValue, { color: textColor }]}>{remainingTime}</Text>
              </View>
              <Button
                loading={checkInMutation.isPending || checkOutMutation.isPending}
                leftIcon={<Fingerprint size={18} color={COLORS.onPrimary} />}
                onPress={() => {
                  if (nextAttendanceAction === 'in') void checkInMutation.mutateAsync();
                  else void checkOutMutation.mutateAsync();
                }}
              >
                {nextAttendanceAction === 'in' ? 'Check in' : 'Check out'}
              </Button>
            </Card>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Overview</Text>
            </View>
            <View style={styles.overviewRow}>
              <OverviewItem label="Leave days" value={String(availableLeaveDays || 0)} textColor={textColor} mutedColor={mutedColor} borderColor={isDark ? COLORS.outlineDark : COLORS.outline} />
              <OverviewItem label="Pending" value={String(pendingRequests || 0)} textColor={textColor} mutedColor={mutedColor} borderColor={isDark ? COLORS.outlineDark : COLORS.outline} />
              <OverviewItem label="Worked" value={String(workedDays)} textColor={textColor} mutedColor={mutedColor} borderColor={isDark ? COLORS.outlineDark : COLORS.outline} />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Quick access</Text>
            </View>
            <View style={styles.quickMenuRow}>
              {quickMenu.map((item) => (
                <TouchableScale
                  key={item.label}
                  style={[styles.quickChip, { borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                  onPress={() => onTabChange?.(item.tab)}
                  pressedScale={0.98}
                >
                  {item.icon}
                  <Text style={[styles.quickChipText, { color: textColor }]} numberOfLines={1}>{item.label}</Text>
                </TouchableScale>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>This month</Text>
              <Text style={[styles.sectionMeta, { color: mutedColor }]}>{today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            </View>
            <View style={[styles.summaryTable, { borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
              {monthSummary.map((item, index) => (
                <View key={item.label} style={[styles.summaryRow, index > 0 && { borderTopColor: isDark ? COLORS.outlineDark : COLORS.outline, borderTopWidth: 1 }]}>
                  <Text style={[styles.summaryLabel, { color: mutedColor }]}>{item.label}</Text>
                  <Text style={[styles.summaryValue, { color: textColor }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewItem({
  label,
  value,
  textColor,
  mutedColor,
  borderColor,
}: {
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
}) {
  return (
    <View style={[styles.overviewItem, { borderColor }]}>
      <Text style={[styles.overviewValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.overviewLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
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

function sumNumbers(items: MobileRecord[] | undefined, keys: string[]) {
  return (items || []).reduce((total, item) => total + readNumber(item, keys), 0);
}

function readNumber(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return 0;

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
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

function countUniquePunchDays(items: MobileRecord[]) {
  const days = new Set<string>();
  items.forEach((item) => {
    const stamp = readString(item, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']);
    if (stamp) {
      days.add(new Date(stamp).toISOString().slice(0, 10));
    }
  });
  return days.size;
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getWeekendCount(year: number, monthIndex: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const weekday = new Date(year, monthIndex, day).getDay();
    if (weekday === 0 || weekday === 6) count += 1;
  }
  return count;
}

function getRemainingWorkTime(now: Date) {
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);
  const diff = Math.max(target.getTime() - now.getTime(), 0);
  const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}


const styles = StyleSheet.create({
  screenTransition: {
    flexGrow: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: 12,
  },
  quickMenuRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    minHeight: 44,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  checkCard: {
    gap: 18,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkHeaderCopy: {
    flex: 1,
  },
  checkMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  attendanceStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attendanceStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    flex: 1,
    fontSize: 13,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  overviewItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  overviewLabel: {
    marginTop: 4,
    fontSize: 11,
  },
  summaryTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    minHeight: 44,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 13,
  },
});
