import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  CalendarRange,
  Clock3,
  Fingerprint,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, normalizeList, buildMobilePunchPayload, formatAttendancePunchError } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import { TouchableScale } from '../components/ui/touchable-scale';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
  onTabChange?: (tab: 'attendance' | 'leave' | 'profile') => void;
}

export function HomeScreen({ auth, onTabChange }: Props) {
  const queryClient = useQueryClient();
  const { isDark } = useThemePreference();
  const insets = useSafeAreaInsets();
  const employee = asRecord(auth.employee) || asRecord(auth.user);
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? '#a1a1aa' : '#6b7280';
  const sheetBackground = isDark ? COLORS.surfaceDark : COLORS.surface;
  const metricCardText = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
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
  const initials = employeeName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
  const approvedLeavesThisMonth = (requestsQuery.data || []).filter((item: any) => {
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

  const topMetrics = [
    { label: 'Profile', value: readString(employee, ['employee_no', 'user_no']) || '1' },
    { label: 'Approval', value: String(pendingRequests || 0) },
    { label: 'Leave', value: String(availableLeaveDays || 0) },
  ];

  const quickMenu = [
    { label: 'My Information', icon: <UserRound size={16} color={COLORS.primary} />, tab: 'profile' as const },
    { label: 'Attendance', icon: <Fingerprint size={16} color={COLORS.primary} />, tab: 'attendance' as const },
    { label: 'Leave', icon: <CalendarDays size={16} color={COLORS.primary} />, tab: 'leave' as const },
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
      <MobileTopBar auth={auth} title={`Hi, ${employeeName}`} subtitle={greeting} variant="dashboard" />
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
          <View style={styles.metricRow}>
            {topMetrics.map((item) => (
              <View key={item.label} style={styles.metricCard}>
                <Text style={[styles.metricLabel, { color: COLORS.primary }]}>{item.label}</Text>
                <Text style={[styles.metricValue, { color: metricCardText }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.sheet, { backgroundColor: sheetBackground, paddingBottom: Math.max(insets.bottom, 4) }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Menu</Text>
              <TouchableScale pressedScale={0.96}>
                <Text style={[styles.sectionLink, { color: COLORS.accent }]}>View More</Text>
              </TouchableScale>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickMenuRow}>
              {quickMenu.map((item) => (
                <TouchableScale
                  key={item.label}
                  style={[styles.quickChip, { backgroundColor: isDark ? COLORS.surfaceVariantDark : '#e8ebf5' }]}
                  onPress={() => onTabChange?.(item.tab)}
                  pressedScale={0.96}
                >
                  {item.icon}
                  <Text style={[styles.quickChipText, { color: textColor }]}>{item.label}</Text>
                </TouchableScale>
              ))}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Check In-Out</Text>
            </View>

            <View style={[styles.checkCard, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
              <View style={styles.checkDetails}>
                <DetailRow icon={<CalendarRange size={18} color={mutedColor} />} label="Date" value={todayLabel} textColor={textColor} mutedColor={mutedColor} />
                <DetailRow icon={<Clock3 size={18} color={mutedColor} />} label="Remaining Time" value={remainingTime} textColor={textColor} mutedColor={mutedColor} />
                <DetailRow icon={<WalletCards size={18} color={mutedColor} />} label="Shift" value="Regular" textColor={textColor} mutedColor={mutedColor} />
              </View>
              <TouchableScale
                style={styles.fingerprintPanel}
                pressedScale={0.97}
                onPress={() => {
                  if (nextAttendanceAction === 'in') {
                    void checkInMutation.mutateAsync();
                  } else {
                    void checkOutMutation.mutateAsync();
                  }
                }}
              >
                <View style={styles.fingerprintCircle}>
                  <Fingerprint size={42} color={COLORS.primary} />
                </View>
                <Text style={[styles.fingerprintLabel, { color: textColor }]}>
                  {checkInMutation.isPending
                    ? 'Checking In...'
                    : checkOutMutation.isPending
                      ? 'Checking Out...'
                      : nextAttendanceAction === 'in'
                        ? 'Check-In'
                        : 'Check-Out'}
                </Text>
              </TouchableScale>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Month Summary <Text style={{ color: mutedColor, fontWeight: '600' }}>| {today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
              </Text>
              <TouchableScale pressedScale={0.96} onPress={() => onTabChange?.('leave')}>
                <Text style={[styles.sectionLink, { color: COLORS.accent }]}>More</Text>
              </TouchableScale>
            </View>

            <View style={styles.summaryRow}>
              {monthSummary.map((item) => (
                <View 
                  key={item.label} 
                  style={[
                    styles.summaryCard, 
                    { 
                      borderColor: item.tone,
                      backgroundColor: isDark ? '#18181b' : '#ffffff'
                    }
                  ]}
                >
                  <Text style={[styles.summaryValue, { color: textColor }]}>{item.value}</Text>
                  <Text style={[styles.summaryLabel, { color: mutedColor }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  textColor,
  mutedColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: mutedColor }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
      </View>
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
    paddingBottom: 0,
  },
  heroShell: {
    paddingTop: 0,
    paddingBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  metricCard: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  sheet: {
    marginTop: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 16,
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickMenuRow: {
    paddingBottom: 18,
    gap: 10,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 0,
    overflow: 'hidden',
    marginBottom: 22,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkDetails: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIcon: {
    width: 24,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
  },
  fingerprintPanel: {
    width: 150,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#c5cde0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  fingerprintCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#e0e5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerprintLabel: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    width: '31%',
    minWidth: 92,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
});
