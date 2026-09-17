import React from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, CalendarClock, Clock3, Landmark, Target, UserRound } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import { TouchableScale } from '../components/ui/touchable-scale';
import { Text } from '../components/ui/text';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
  onTabChange?: (tab: 'attendance' | 'leave' | 'profile') => void;
}

const DASHBOARD_BLUE = '#087FD4';

export function HomeScreen({ auth, onTabChange }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const employee = asRecord(auth.employee) || {};
  const user = asRecord(auth.user) || {};
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const borderColor = isDark ? COLORS.outlineDark : COLORS.outline;

  const balancesQuery = useQuery({
    queryKey: ['mobileHomeLeaveBalances'],
    queryFn: async () => normalizeList(await api.listMyLeaveBalances({ limit: 20 })),
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

  const profilePhotoQuery = useQuery({
    queryKey: ['mobileHomeProfilePhoto'],
    queryFn: () => api.getMyProfilePhotoUrl(),
    enabled: auth.isAuthenticated,
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      auth.refreshProfile(),
      balancesQuery.refetch(),
      punchesQuery.refetch(),
      todayAttendanceQuery.refetch(),
      profilePhotoQuery.refetch(),
    ]);
  }, [auth, balancesQuery, profilePhotoQuery, punchesQuery, todayAttendanceQuery]);

  const fullName =
    [readString(employee, ['first_name']), readString(employee, ['last_name'])].filter(Boolean).join(' ') ||
    readString(user, ['fullName', 'full_name', 'name']) ||
    'Employee';
  const preferredName = readString(employee, ['first_name']) || fullName.split(/\s+/)[0] || 'Employee';
  const employmentStatus = readString(employee, ['employment_status', 'status']) || 'Active';
  const employeeNo =
    readString(employee, ['employee_no', 'user_no']) || readString(user, ['employeeId', 'employee_id']) || '—';
  const position =
    readString(employee, ['position_name']) || readNestedName(employee, ['position', 'primary_position']) || 'Not assigned';
  const department =
    readString(employee, ['department_name']) || readNestedName(employee, ['department', 'primary_department']) || 'Not assigned';
  const branch =
    readString(employee, ['branch_name']) || readNestedName(employee, ['branch', 'primary_branch']) || 'Not assigned';
  const joined = formatDate(readUnknown(employee, ['hire_date', 'joining_date', 'date_joined']));
  const role = formatTitle(readString(user, ['role', 'user_type']) || 'Company user');
  const roleLabel = role.toLowerCase() === 'employee' ? 'Employee' : `${role} · Employee`;

  const today = new Date();
  const todayDateKey = today.toISOString().slice(0, 10);
  const todayCheckIn =
    readString(todayAttendanceQuery.data, ['checkInAt', 'check_in_at', 'firstCheckInAt', 'first_check_in_at']) ||
    findPunchTime(punchesQuery.data || [], todayDateKey, 'in');
  const todayCheckOut =
    readString(todayAttendanceQuery.data, ['checkOutAt', 'check_out_at', 'lastCheckOutAt', 'last_check_out_at']) ||
    findPunchTime(punchesQuery.data || [], todayDateKey, 'out');
  const attendanceStatus = todayCheckOut ? 'Completed' : todayCheckIn ? 'Checked In' : 'Not Checked In';
  const availableLeaveDays = sumNumbers(balancesQuery.data, ['remaining', 'balance']);
  const leaveTypes = balancesQuery.data?.length || 0;
  const isOnboarding = employmentStatus.toLowerCase() === 'onboarding';
  const initials = getInitials(fullName);
  const isRefreshing =
    balancesQuery.isFetching ||
    punchesQuery.isFetching ||
    todayAttendanceQuery.isFetching ||
    profilePhotoQuery.isFetching;

  const snapshots = [
    { label: 'Today', value: attendanceStatus, highlighted: true },
    { label: 'Check in', value: formatTime(todayCheckIn) },
    { label: 'Check out', value: formatTime(todayCheckOut) },
    { label: 'Leave left', value: formatCompactNumber(availableLeaveDays) },
    { label: 'Leave types', value: String(leaveTypes) },
  ];

  const quickActions = [
    { label: 'My attendance', icon: Clock3, onPress: () => onTabChange?.('attendance') },
    { label: 'Request leave', icon: CalendarClock, onPress: () => onTabChange?.('leave') },
    { label: 'My payroll', icon: Landmark, onPress: () => router.push('/payroll') },
    { label: 'My performance', icon: Target, onPress: () => router.push('/performance') },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={[]}>
      <MobileTopBar auth={auth} title="Dashboard" variant="centered" />
      <ScrollView
        style={[styles.scroll, { backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <ScreenTransition style={styles.screenTransition}>
          {isOnboarding ? (
            <View
              style={[
                styles.onboardingBanner,
                {
                  backgroundColor: isDark ? '#332A18' : '#FFFBEB',
                  borderColor: isDark ? '#765B24' : '#FDE68A',
                },
              ]}
            >
              <Text style={[styles.onboardingText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                Your employee profile is still in onboarding.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onTabChange?.('profile')}
                style={styles.onboardingButton}
              >
                <Text style={styles.onboardingButtonText}>Finish onboarding</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.greetingBlock}>
            <Text style={[styles.dateLabel, { color: mutedColor }]}>{formatHeaderDate(today)}</Text>
            <Text style={[styles.greeting, { color: textColor }]}>
              {getGreeting(today)},{' '}
              <Text style={styles.greetingName}>{preferredName}</Text>
            </Text>
            <Text style={[styles.greetingSubtitle, { color: mutedColor }]}>Here&apos;s your day at a glance.</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.snapshotRow}
            style={[styles.snapshotScroller, { borderColor }]}
          >
            {snapshots.map((snapshot, index) => (
              <View
                key={snapshot.label}
                style={[
                  styles.snapshotItem,
                  snapshot.highlighted
                    ? { backgroundColor: isDark ? '#123D39' : '#E6F8F4' }
                    : { backgroundColor },
                  index < snapshots.length - 1 ? { borderRightColor: borderColor, borderRightWidth: 1 } : null,
                ]}
              >
                <Text
                  style={[
                    styles.snapshotLabel,
                    { color: snapshot.highlighted ? (isDark ? '#6EE7D1' : '#0F766E') : mutedColor },
                  ]}
                >
                  {snapshot.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.snapshotValue,
                    { color: snapshot.highlighted ? (isDark ? '#99F6E4' : '#047857') : textColor },
                  ]}
                >
                  {snapshot.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.profilePanel}>
            <View style={styles.identityRow}>
              <View style={styles.avatarShell}>
                {profilePhotoQuery.data ? (
                  <Image
                    alt={`${fullName} profile photo`}
                    source={{ uri: profilePhotoQuery.data }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <View style={styles.identityCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.employeeName}>{fullName}</Text>
                  <Text style={styles.employeeStatus}>{formatTitle(employmentStatus)}</Text>
                </View>
                <Text style={styles.roleLabel}>{roleLabel}</Text>
                <TouchableScale
                  style={styles.profileButton}
                  onPress={() => onTabChange?.('profile')}
                  pressedScale={0.97}
                >
                  <UserRound size={14} color="#FFFFFF" />
                  <Text style={styles.profileButtonText}>View full profile</Text>
                </TouchableScale>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <ProfileField label="Employee no." value={employeeNo} />
              <ProfileField label="Position" value={position} />
              <ProfileField label="Department" value={department} />
              <ProfileField label="Branch" value={branch} />
              <ProfileField label="Joined" value={joined} />
            </View>

            <View style={styles.quickActions}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <TouchableScale
                    accessibilityRole="button"
                    key={action.label}
                    onPress={action.onPress}
                    pressedScale={0.985}
                    style={styles.quickAction}
                  >
                    <View style={styles.quickActionIcon}>
                      <Icon size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.quickActionText}>{action.label}</Text>
                    <ArrowRight size={17} color="rgba(255,255,255,0.9)" />
                  </TouchableScale>
                );
              })}
            </View>
          </View>
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileField}>
      <Text style={styles.profileFieldLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.profileFieldValue}>{value}</Text>
    </View>
  );
}

function asRecord(value: unknown): MobileRecord | null {
  return value && typeof value === 'object' ? (value as MobileRecord) : null;
}

function readUnknown(value: unknown, keys: string[]) {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined) return record[key];
  }
  return undefined;
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

function readNestedName(record: MobileRecord, keys: string[]) {
  for (const key of keys) {
    const name = readString(record[key], ['name', 'title', 'label']);
    if (name) return name;
  }
  return '';
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

function sumNumbers(items: MobileRecord[] | undefined, keys: string[]) {
  return (items || []).reduce((total, item) => total + readNumber(item, keys), 0);
}

function findPunchTime(items: MobileRecord[], dateKey: string, direction: 'in' | 'out') {
  const match = items.find((item) => {
    const stamp = readString(item, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']);
    const type = readString(item, ['punch_type', 'punchType', 'type']).toLowerCase();
    return stamp.startsWith(dateKey) && type.includes(direction);
  });
  return match ? readString(match, ['punched_at', 'punchedAt', 'timestamp', 'created_at', 'createdAt']) : '';
}

function formatTime(value: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const timeMatch = value.match(/\b(\d{1,2}:\d{2})\b/);
  return timeMatch?.[1] || value;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatHeaderDate(value: Date) {
  return value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase();
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTitle(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'E';
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  screenTransition: { flexGrow: 1 },
  onboardingBanner: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  onboardingText: { flex: 1, fontSize: 13, lineHeight: 19 },
  onboardingButton: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 13,
    backgroundColor: DASHBOARD_BLUE,
  },
  onboardingButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  greetingBlock: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 18 },
  dateLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.3 },
  greeting: { marginTop: 5, fontSize: 24, lineHeight: 31, fontWeight: '700', letterSpacing: -0.6 },
  greetingName: { color: DASHBOARD_BLUE },
  greetingSubtitle: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  snapshotScroller: { borderTopWidth: 1, borderBottomWidth: 1 },
  snapshotRow: { minWidth: '100%' },
  snapshotItem: { minWidth: 104, minHeight: 72, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  snapshotLabel: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  snapshotValue: { marginTop: 3, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  profilePanel: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 26, backgroundColor: DASHBOARD_BLUE },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  avatarShell: {
    width: 64,
    height: 64,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  identityCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 7 },
  employeeName: { color: '#FFFFFF', fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.35 },
  employeeStatus: { color: 'rgba(255,255,255,0.86)', fontSize: 11, fontWeight: '700' },
  roleLabel: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  profileButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 24, rowGap: 14 },
  profileField: { width: '50%', paddingRight: 14 },
  profileFieldLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase' },
  profileFieldValue: { marginTop: 2, color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  quickActions: { gap: 9, marginTop: 24 },
  quickAction: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  quickActionIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.16)' },
  quickActionText: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
