import React from 'react';
import {
  Animated,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Sparkles, X } from 'lucide-react-native';
import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import { FluentText as Text } from '../components/ui/fluent-text';
import { Button } from '../components/ui/button';
import { TouchableScale } from '../components/ui/touchable-scale';
import { FluentSystemIcon } from '../components/ui/fluent-system-icon';
import { Card } from '../components/ui/card';
import { ProfileCardDoodles } from '../components/ui/profile-card-doodles';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent, profilePaletteColor, profilePaletteForeground } from '../lib/profile-card-background';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
  onTabChange?: (tab: 'attendance' | 'leave' | 'calendar' | 'profile') => void;
}

export function HomeScreen({ auth, onTabChange }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const appAccent = useAppAccent();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [failedProfilePhotoUri, setFailedProfilePhotoUri] = React.useState<string | null>(null);
  const [loadedProfilePhotoUri, setLoadedProfilePhotoUri] = React.useState<string | null>(null);
  const [isOnboardingNoticeDismissed, setIsOnboardingNoticeDismissed] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const compactLayout = viewportWidth <= 640 || viewportHeight <= 880;
  const employee = asRecord(auth.employee) || {};
  const user = asRecord(auth.user) || {};
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;

  const balancesQuery = useQuery({
    queryKey: ['mobileHomeLeaveBalances'],
    queryFn: async () => normalizeList(await api.listMyLeaveBalances({ limit: 20 })),
    enabled: auth.isAuthenticated,
  });

  const holidaysQuery = useQuery({
    queryKey: ['mobileHomeHolidays'],
    queryFn: async () => await normalizeList(await api.listHolidays({ limit: 50 })) as MobileRecord[],
    enabled: auth.isAuthenticated,
  });

  const leaveRequestsQuery = useQuery({
    queryKey: ['mobileHomeLeaveRequests'],
    queryFn: async () => await normalizeList(await api.listMyLeaveRequests({ limit: 50 })) as MobileRecord[],
    enabled: auth.isAuthenticated,
  });

  const upcomingItems = React.useMemo(
    () => buildUpcomingItems(holidaysQuery.data ?? [], leaveRequestsQuery.data ?? [], now),
    [holidaysQuery.data, leaveRequestsQuery.data, now],
  );

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

  const cardStyleQuery = useQuery({
    queryKey: ['dashboardCardStyle'],
    queryFn: () => api.getMyDashboardCardStyle(),
    enabled: auth.isAuthenticated,
  });
  const profileCardStyle = normalizeProfileCardStyle(cardStyleQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const profileCardColor = profilePaletteColor(profileCardStyle.palette, isDark);
  const profileCardIsLight = profilePaletteForeground(profileCardColor) !== '#FFFFFF';
  const profileCardAccent = appAccent || profilePaletteAccent(profileCardStyle.palette, isDark);
  const profileCardTextColor = profilePaletteForeground(profileCardColor);
  const profileCardMutedColor = profileCardTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.84)' : 'rgba(17,17,17,0.72)';
  useFocusEffect(React.useCallback(() => {
    setNow(new Date());
  }, []));

  React.useEffect(() => {
    if (!auth.isAuthenticated) setIsOnboardingNoticeDismissed(false);
  }, [auth.isAuthenticated]);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const todayDateKey = formatDateKey(today);
  const weekRange = getWeekRange(today);

  const weeklyAttendanceQuery = useQuery({
    queryKey: ['mobileHomeWeeklyAttendance', weekRange.startKey, weekRange.endKey],
    queryFn: async () => {
      const response = await api.listMyAttendanceHistory({
        from_date: weekRange.startKey,
        to_date: weekRange.endKey,
        limit: 7,
        sortBy: 'attendanceDate',
        sortOrder: 'ASC',
      });
      const responseRecord = asRecord(response);
      const responseData = Array.isArray(responseRecord?.data) ? responseRecord.data : null;
      return (responseData || normalizeList(response)) as MobileRecord[];
    },
    enabled: auth.isAuthenticated,
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      auth.refreshProfile(),
      balancesQuery.refetch(),
      holidaysQuery.refetch(),
      leaveRequestsQuery.refetch(),
      punchesQuery.refetch(),
      todayAttendanceQuery.refetch(),
      profilePhotoQuery.refetch(),
      weeklyAttendanceQuery.refetch(),
    ]);
  }, [auth, balancesQuery, holidaysQuery, leaveRequestsQuery, profilePhotoQuery, punchesQuery, todayAttendanceQuery, weeklyAttendanceQuery]);

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

  const todayCheckIn =
    readString(todayAttendanceQuery.data, ['checkInAt', 'check_in_at', 'firstCheckInAt', 'first_check_in_at']) ||
    findPunchTime(punchesQuery.data || [], todayDateKey, 'in');
  const todayCheckOut =
    readString(todayAttendanceQuery.data, ['checkOutAt', 'check_out_at', 'lastCheckOutAt', 'last_check_out_at']) ||
    findPunchTime(punchesQuery.data || [], todayDateKey, 'out');
  const availableLeaveDays = sumNumbers(balancesQuery.data, ['remaining', 'balance']);
  const isOnboarding = employmentStatus.toLowerCase() === 'onboarding';
  const initials = getInitials(fullName);
  const profilePhotoUri = profilePhotoQuery.data || null;
  const isRefreshing =
    balancesQuery.isFetching ||
    holidaysQuery.isFetching ||
    leaveRequestsQuery.isFetching ||
    punchesQuery.isFetching ||
    todayAttendanceQuery.isFetching ||
    profilePhotoQuery.isFetching ||
    weeklyAttendanceQuery.isFetching;

  const weeklyAttendance = buildWeeklyAttendance(
    weeklyAttendanceQuery.data || [],
    weekRange.start,
    todayDateKey,
    todayAttendanceQuery.data,
  );
  const weeklyWorkedMinutes = weeklyAttendance.reduce((total, day) => total + day.workMinutes, 0);
  const attendedDays = weeklyAttendance.filter((day) => day.isPresent).length;
  const averageWorkedMinutes = attendedDays > 0 ? Math.round(weeklyWorkedMinutes / attendedDays) : 0;
  const graphScaleMinutes = Math.max(480, ...weeklyAttendance.map((day) => day.workMinutes));
  const streak = countStreak(weeklyAttendance);
  const onClock = Boolean(todayCheckIn) && !todayCheckOut;
  const dayLine = describeDay(todayCheckIn, todayCheckOut, now);
  const streakLine = streak === 0 ? 'A clear week so far.' : streak === 1 ? '1 day in a row.' : `${streak} days in a row.`;

  const snapshots = [
    { label: 'CHECK IN', value: formatTime(todayCheckIn), icon: 'check-in' as const },
    { label: 'CHECK OUT', value: formatTime(todayCheckOut), icon: 'check-out' as const },
    { label: 'LEAVE LEFT', value: `${formatCompactNumber(availableLeaveDays)} ${availableLeaveDays === 1 ? 'day' : 'days'}`, icon: 'leave' as const },
  ];

  const quickActions = [
    { label: 'My attendance', short: 'Attendance', icon: 'attendance' as const, onPress: () => onTabChange?.('attendance') },
    { label: 'Request leave', short: 'Leave', icon: 'leave' as const, onPress: () => onTabChange?.('leave') },
    { label: 'My payroll', short: 'Payroll', icon: 'payroll' as const, onPress: () => router.push('/payroll') },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={[]}>
      <MobileTopBar auth={auth} title="Dashboard" variant="centered" titleWeight="700" hideDivider />
      <ScrollView
        style={[styles.scroll, { backgroundColor }]}
        contentContainerStyle={[
          styles.scrollContent,
          styles.scrollContentEnd,
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[appAccent]} />}
      >
        <ScreenTransition style={styles.screenTransition}>
          <View style={[styles.profileCardShadow, { shadowColor: profileCardIsLight ? '#34536B' : profileCardColor }]}>
            <View style={[styles.profileCard, { backgroundColor: profileCardColor, borderColor: profileCardIsLight ? 'rgba(15,23,42,0.08)' : 'transparent' }]}>
              <View pointerEvents="none" style={styles.profileArtClip}>
                <View style={styles.profileArtShift}>
                  <ProfileCardDoodles artwork={profileCardStyle.artwork} onLight={profileCardIsLight} />
                </View>
              </View>
              <View pointerEvents="none" style={styles.profileWaves}>
                {[0, 1, 2, 3, 4].map((wave) => (
                  <View
                    key={wave}
                    style={[
                      styles.profileWave,
                      styles[`profileWave${wave}` as 'profileWave0'],
                      { backgroundColor: wave === 4 ? backgroundColor : profileCardIsLight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.profileCardBody}>
                <View style={styles.identityRow}>
                  <View style={[styles.avatarShell, compactLayout && styles.avatarShellCompact, { borderColor: profileCardIsLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.92)' }]}>
                    <NativeText style={[styles.avatarInitials, { color: profileCardIsLight ? profileCardAccent : '#FFFFFF' }]}>{initials}</NativeText>
                    {profilePhotoUri && failedProfilePhotoUri !== profilePhotoUri ? (
                      <Image
                        alt={`${fullName} profile photo`}
                        source={{ uri: profilePhotoUri }}
                        style={[styles.avatarImage, { opacity: loadedProfilePhotoUri === profilePhotoUri ? 1 : 0 }]}
                        resizeMode="cover"
                        onLoad={() => setLoadedProfilePhotoUri(profilePhotoUri)}
                        onError={() => setFailedProfilePhotoUri(profilePhotoUri)}
                      />
                    ) : null}
                  </View>
                  <View style={styles.identityCopy}>
                    <View style={styles.identityGreetingRow}>
                      <Text style={[styles.identityGreetingLead, { color: profileCardTextColor }]}>{getGreeting(now)},</Text>
                      <AnimatedGreetingName name={preferredName} color={profileCardTextColor} size={22} />
                    </View>
                    <View style={styles.metaRow}>
                      <View style={[styles.employeeStatusPill, { backgroundColor: profileCardIsLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.2)' }]}>
                        <Text style={[styles.employeeStatus, { color: profileCardTextColor }]}>
                          {formatTitle(employmentStatus)}
                        </Text>
                      </View>
                      <Text style={[styles.dateTimeLabel, { color: profileCardMutedColor }]}>
                        {formatHeaderDate(now)} · {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <TouchableScale
                    accessibilityRole="button"
                    accessibilityLabel="View profile"
                    onPress={() => onTabChange?.('profile')}
                    hitSlop={8}
                    style={styles.profileArrow}
                  >
                    <FluentSystemIcon name="chevron-right" size={18} color={profileCardTextColor} />
                  </TouchableScale>
                </View>

                <View style={[styles.detailsGrid, { borderTopColor: profileCardIsLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.28)' }]}>
                  <ProfileField label="Employee no." value={employeeNo} textColor={profileCardTextColor} mutedColor={profileCardMutedColor} />
                  <ProfileField label="Position" value={position} textColor={profileCardTextColor} mutedColor={profileCardMutedColor} />
                  <ProfileField label="Department" value={department} textColor={profileCardTextColor} mutedColor={profileCardMutedColor} />
                  <ProfileField label="Branch" value={branch} textColor={profileCardTextColor} mutedColor={profileCardMutedColor} />
                </View>
              </View>
            </View>
          </View>

          {isOnboarding && !isOnboardingNoticeDismissed ? (
            <View
              style={[
                styles.onboardingBanner,
                {
                  backgroundColor: isDark ? '#332A18' : '#FFFBEB',
                  borderColor: isDark ? '#765B24' : '#FDE68A',
                },
              ]}
            >
              <View style={[styles.onboardingAccent, { backgroundColor: isDark ? '#F5C16C' : '#D97706' }]} />
              <Text style={[styles.onboardingText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                Your profile is still in onboarding.
              </Text>
              <Button
                variant="default"
                onPress={() => onTabChange?.('profile')}
                style={[styles.onboardingButton, { backgroundColor: profileCardAccent, alignSelf: 'center', minWidth: 0 }]}
              >
                Finish onboarding
              </Button>
              <TouchableScale
                accessibilityRole="button"
                accessibilityLabel="Dismiss onboarding notice"
                onPress={() => setIsOnboardingNoticeDismissed(true)}
                style={styles.onboardingDismissButton}
              >
                <X size={16} color={isDark ? '#FDE68A' : '#92400E'} />
              </TouchableScale>
            </View>
          ) : null}

          <View style={styles.heroStatsSection}>
            <View style={styles.heroStats}>
              {snapshots.map((snapshot, index) => (
                <React.Fragment key={snapshot.label}>
                  {index > 0 ? <View style={[styles.heroStatDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.12)' }]} /> : null}
                  <TouchableScale
                    accessibilityRole="button"
                    accessibilityLabel={`${snapshot.label} ${snapshot.value}`}
                    onPress={() => onTabChange?.(snapshot.icon === 'leave' ? 'leave' : 'attendance')}
                    style={styles.heroStatTile}
                  >
                    <FluentSystemIcon name={snapshot.icon} size={16} color={mutedColor} />
                    <Text style={[styles.snapshotLabel, { color: isDark ? '#596579' : '#526273' }]}>{snapshot.label}</Text>
                    <Text numberOfLines={1} style={[styles.snapshotValue, { color: textColor }]}>{snapshot.value}</Text>
                  </TouchableScale>
                </React.Fragment>
              ))}
            </View>
            {onClock || dayLine !== 'No check-in yet today.' ? (
              <View style={styles.heroStatusRow}>
                <View style={[styles.heroStatusDot, { backgroundColor: onClock ? '#168A63' : mutedColor }]} />
                <Text numberOfLines={2} style={[styles.heroStatus, { color: mutedColor }]}>
                  {onClock ? `On the clock · ${dayLine}` : dayLine}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.sectionHeading, { color: textColor }]}>Shortcuts</Text>
          <View style={[styles.shortcutCard, { backgroundColor: isDark ? '#252B32' : '#FFFFFF', borderColor: isDark ? '#3A4654' : '#E5E7EB' }]}>
            {quickActions.map((action, index) => (
              <React.Fragment key={action.label}>
                {index > 0 ? <View style={[styles.shortcutDivider, { backgroundColor: isDark ? '#3A4654' : '#E6EEF4' }]} /> : null}
                <TouchableScale
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  style={styles.shortcut}
                >
                  <View style={[styles.shortcutIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F8FC' }]}>
                    <FluentSystemIcon name={action.icon} size={22} color={profileCardAccent} />
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.shortcutLabel, { color: textColor }]}>
                    {action.short}
                  </Text>
                </TouchableScale>
              </React.Fragment>
            ))}
          </View>

          <Card variant="default" style={styles.attendanceCard}>
            <View style={styles.attendanceHeader}>
              <View style={styles.attendanceHeaderCopy}>
                <Text style={[styles.attendanceTitle, { color: textColor }]}>Your week</Text>
                <Text style={[styles.attendanceRange, { color: mutedColor }]}>
                  {formatWeekRange(weekRange.start, weekRange.end)}
                </Text>
              </View>
              <View style={[styles.streakPill, { backgroundColor: streak > 0 ? (isDark ? 'rgba(255,255,255,0.08)' : '#F2F8FC') : (isDark ? '#2A3440' : '#F4F6F8') }]}>
                <Text numberOfLines={2} style={[styles.streakLine, { color: streak > 0 ? profileCardAccent : mutedColor }]}>{streakLine}</Text>
              </View>
            </View>

            <View style={styles.attendanceSummary}>
              <View style={styles.attendanceSummaryItem}>
                <Text style={[styles.attendanceSummaryValue, { color: textColor }]}>
                  {formatDuration(weeklyWorkedMinutes)}
                </Text>
                <Text style={[styles.attendanceSummaryLabel, { color: mutedColor }]}>Total hours</Text>
              </View>
              <View style={styles.attendanceSummaryItem}>
                <Text style={[styles.attendanceSummaryValue, { color: textColor }]}>{attendedDays}</Text>
                <Text style={[styles.attendanceSummaryLabel, { color: mutedColor }]}>Days present</Text>
              </View>
              <View style={styles.attendanceSummaryItem}>
                <Text style={[styles.attendanceSummaryValue, { color: textColor }]}>
                  {formatDuration(averageWorkedMinutes)}
                </Text>
                <Text style={[styles.attendanceSummaryLabel, { color: mutedColor }]}>Daily average</Text>
              </View>
            </View>

            <View style={styles.attendanceChart} accessibilityLabel="Weekly attendance hours chart">
              {weeklyAttendance.map((day) => {
                const barHeight = day.workMinutes > 0
                  ? Math.max(5, Math.round((day.workMinutes / graphScaleMinutes) * 100))
                  : 0;

                return (
                  <View key={day.dateKey} style={styles.attendanceDay}>
                    <AnimatedAttendanceHours
                      minutes={day.workMinutes}
                      color={day.isToday ? textColor : mutedColor}
                    />
                    <View
                      style={[
                        styles.attendanceBarTrack,
                        { backgroundColor: isDark ? '#273343' : '#EAF1F7' },
                      ]}
                    >
                      {barHeight > 0 ? (
                        <View
                          style={[
                            styles.attendanceBar,
                            {
                              height: `${barHeight}%` as `${number}%`,
                      backgroundColor: day.isToday ? profileCardAccent : (isDark ? '#66839A' : '#9BB8CA'),
                            },
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.attendanceDayLabel,
                        { color: day.isToday ? profileCardAccent : mutedColor },
                        day.isToday && styles.attendanceDayLabelActive,
                      ]}
                    >
                      {day.label}
                    </Text>
                    <View style={styles.attendancePunches}>
                      <View style={styles.attendancePunchState}>
                        <View
                          style={[
                            styles.attendancePunchDot,
                            { backgroundColor: day.hasCheckIn ? '#168A63' : (isDark ? '#455365' : '#C9D3DE') },
                          ]}
                        />
                        <Text style={[styles.attendancePunchLabel, { color: mutedColor }]}>In</Text>
                      </View>
                      <View style={styles.attendancePunchState}>
                        <View
                          style={[
                            styles.attendancePunchDot,
                            { backgroundColor: day.hasCheckOut ? '#D69200' : (isDark ? '#455365' : '#C9D3DE') },
                          ]}
                        />
                        <Text style={[styles.attendancePunchLabel, { color: mutedColor }]}>Out</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card variant="default" style={styles.comingUpCard}>
            <View style={styles.comingUpHeader}>
              <Text style={[styles.attendanceTitle, { color: textColor }]}>Coming up</Text>
              <TouchableScale
                accessibilityRole="button"
                accessibilityLabel="Open leave and holiday calendar"
                onPress={() => onTabChange?.('calendar')}
                style={styles.comingUpLink}
              >
                <Text style={[styles.comingUpLinkText, { color: profileCardAccent }]}>View calendar</Text>
              </TouchableScale>
            </View>
            {upcomingItems.length ? upcomingItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.comingUpRow,
                  index > 0 && { borderTopColor: isDark ? '#344250' : '#E7EDF2', borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={[styles.comingUpIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F8FC' }]}>
                  <CalendarDays size={17} color={item.kind === 'leave' ? '#168A63' : profileCardAccent} strokeWidth={1.9} />
                </View>
                <View style={styles.comingUpCopy}>
                  <Text numberOfLines={1} style={[styles.comingUpTitle, { color: textColor }]}>{item.title}</Text>
                  <Text numberOfLines={1} style={[styles.comingUpDate, { color: mutedColor }]}>{item.detail}</Text>
                </View>
              </View>
            )) : (
              <Text style={[styles.comingUpEmpty, { color: mutedColor }]}>
                {holidaysQuery.isLoading || leaveRequestsQuery.isLoading
                  ? 'Checking upcoming dates…'
                  : holidaysQuery.isError && leaveRequestsQuery.isError
                    ? 'Upcoming dates are unavailable right now.'
                    : 'Nothing scheduled soon.'}
              </Text>
            )}
          </Card>
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileField({ label, value, textColor, mutedColor }: { label: string; value: string; textColor: string; mutedColor: string }) {
  return (
    <View style={styles.profileField}>
      <Text style={[styles.profileFieldLabel, { color: mutedColor }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.profileFieldValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

type UpcomingItem = { id: string; title: string; detail: string; date: Date; kind: 'holiday' | 'leave' };

function buildUpcomingItems(holidays: MobileRecord[], leaveRequests: MobileRecord[], now: Date): UpcomingItem[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const items: UpcomingItem[] = [];

  holidays.forEach((row, index) => {
    const dateValue = readString(row, ['date', 'holiday_date', 'holidayDate']);
    const date = parseLocalDate(dateValue);
    if (!date || date < today) return;
    items.push({
      id: `holiday-${String(row.id ?? dateValue)}-${index}`,
      title: readString(row, ['name', 'holiday_name', 'title']) || 'Public holiday',
      detail: formatUpcomingDate(date),
      date,
      kind: 'holiday',
    });
  });

  leaveRequests.forEach((row, index) => {
    const status = readString(row, ['status', 'approval_status', 'approvalStatus']).toLowerCase();
    if (!status.includes('approved')) return;
    const start = parseLocalDate(readString(row, ['start_date', 'startDate']));
    const end = parseLocalDate(readString(row, ['end_date', 'endDate'])) || start;
    if (!end || end < today) return;
    const leaveType = asRecord(row.leave_type) || asRecord(row.leaveType) || asRecord(row.type);
    const leaveName = readString(leaveType, ['name', 'display_name']) || readString(row, ['leave_type_name', 'type_name']) || 'Leave';
    const effectiveDate = start && start >= today ? start : today;
    items.push({
      id: `leave-${String(row.id ?? `${leaveName}-${index}`)}`,
      title: `Approved leave · ${leaveName}`,
      detail: start && end && start.getTime() !== end.getTime()
        ? `${formatUpcomingDate(start)} – ${formatUpcomingDate(end)}`
        : formatUpcomingDate(effectiveDate),
      date: effectiveDate,
      kind: 'leave',
    });
  });

  return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
}

function parseLocalDate(value: string) {
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUpcomingDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function formatHeaderDate(value: Date) {
  return value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
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

function describeDay(checkIn: string, checkOut: string, now: Date) {
  if (checkIn && !checkOut) {
    const elapsed = elapsedSince(checkIn, now);
    return elapsed ? `On the clock since ${formatTime(checkIn)}. ${elapsed} so far.` : `On the clock since ${formatTime(checkIn)}.`;
  }
  if (checkIn && checkOut) return `You closed the day at ${formatTime(checkOut)}.`;
  const hour = now.getHours();
  if (hour < 11) return 'The day is open. Check in when you arrive.';
  if (hour < 17) return 'No check-in yet today.';
  return 'Today is still unmarked.';
}

function elapsedSince(checkIn: string, now: Date) {
  const start = new Date(checkIn).getTime();
  if (!Number.isFinite(start)) return '';
  const minutes = Math.max(0, Math.round((now.getTime() - start) / 60000));
  if (minutes <= 0) return '';
  return formatDuration(minutes);
}

function countStreak(days: Array<{ isPresent: boolean; isToday: boolean }>) {
  const todayIndex = days.findIndex((day) => day.isToday);
  if (todayIndex < 0) return 0;
  let streak = 0;
  for (let index = todayIndex; index >= 0; index -= 1) {
    const day = days[index];
    if (!day.isPresent) {
      if (day.isToday) continue;
      break;
    }
    streak += 1;
  }
  return streak;
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekRange(value: Date) {
  const start = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start,
    end,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
  };
}

function buildWeeklyAttendance(
  records: MobileRecord[],
  weekStart: Date,
  todayDateKey: string,
  todayRecord?: MobileRecord | null,
) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = formatDateKey(date);
    const record = records.find(
      (item) => readString(item, ['attendanceDate', 'attendance_date', 'date']).slice(0, 10) === dateKey,
    );
    const liveTodayRecord = dateKey === todayDateKey ? todayRecord : null;
    const status = (
      readString(record, ['attendanceStatus', 'attendance_status', 'status']) ||
      readString(liveTodayRecord, ['attendanceStatus', 'attendance_status', 'status'])
    ).toLowerCase();
    const checkIn =
      readString(record, ['checkInAt', 'check_in_at', 'first_punch', 'firstCheckInAt', 'first_punch_at']) ||
      readString(liveTodayRecord, ['checkInAt', 'check_in_at', 'first_punch', 'firstCheckInAt', 'first_punch_at']);
    const checkOut =
      readString(record, ['checkOutAt', 'check_out_at', 'last_punch', 'lastCheckOutAt', 'last_punch_at']) ||
      readString(liveTodayRecord, ['checkOutAt', 'check_out_at', 'last_punch', 'lastCheckOutAt', 'last_punch_at']);
    const workMinutes = getWorkedMinutes(record) || getWorkedMinutes(liveTodayRecord || undefined);

    return {
      dateKey,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      workMinutes,
      isPresent: workMinutes > 0 || status.includes('present'),
      isToday: dateKey === todayDateKey,
      hasCheckIn: Boolean(checkIn),
      hasCheckOut: Boolean(checkOut),
    };
  });
}

function getWorkedMinutes(record: MobileRecord | undefined) {
  if (!record) return 0;

  const directMinutes = readNumber(record, ['workMinutes', 'work_minutes', 'workedMinutes', 'worked_minutes']);
  if (directMinutes > 0) return Math.round(directMinutes);

  const duration = readString(record, ['workedHours', 'worked_hours', 'total_worked_hours', 'hours_worked', 'totalHours']);
  const durationMatch = duration.match(/^(\d{1,3}):(\d{2})/);
  if (durationMatch) return Number(durationMatch[1]) * 60 + Number(durationMatch[2]);

  const checkIn = readString(record, ['checkInAt', 'check_in_at', 'first_punch', 'firstCheckInAt', 'first_punch_at']);
  const checkOut = readString(record, ['checkOutAt', 'check_out_at', 'last_punch', 'lastCheckOutAt', 'last_punch_at']);
  const checkInTime = new Date(checkIn).getTime();
  const checkOutTime = new Date(checkOut).getTime();
  if (Number.isFinite(checkInTime) && Number.isFinite(checkOutTime) && checkOutTime > checkInTime) {
    return Math.round((checkOutTime - checkInTime) / 60000);
  }

  return 0;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatChartHours(minutes: number) {
  if (minutes <= 0) return '—';
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function AnimatedAttendanceHours({ minutes, color }: { minutes: number; color: string }) {
  const [animatedMinutes] = React.useState(() => new Animated.Value(0));
  const [displayMinutes, setDisplayMinutes] = React.useState(0);

  React.useEffect(() => {
    animatedMinutes.stopAnimation();
    animatedMinutes.setValue(0);
    setDisplayMinutes(0);
    const listenerId = animatedMinutes.addListener(({ value }) => {
      setDisplayMinutes(Math.round(value));
    });
    const animation = Animated.timing(animatedMinutes, {
      toValue: Math.max(0, minutes),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      animation.stop();
      animatedMinutes.removeListener(listenerId);
    };
  }, [animatedMinutes, minutes]);

  return <Text style={[styles.attendanceHours, { color }]}>{formatChartHours(displayMinutes)}</Text>;
}

function AnimatedGreetingName({ name, color, size = 23 }: { name: string; color: string; size?: number }) {
  const [sparkleValues] = React.useState(() => [
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]);

  React.useEffect(() => {
    const animations = sparkleValues.map((value, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(index * 230),
        Animated.timing(value, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.delay(750),
        Animated.timing(value, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [sparkleValues]);

  return (
    <View style={styles.greetingNameWrap}>
      <Text style={[styles.greetingName, size === 23 ? null : { fontSize: size, lineHeight: size + 7 }, { color }]}>{name}</Text>
      {sparkleValues.map((value, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[
            styles.greetingSparkle,
            index === 0 ? { top: -5, left: -7 } : index === 1 ? { top: -6, right: -6 } : { bottom: -3, right: 3 },
            { opacity: value, transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }] },
          ]}
        >
          <Sparkles size={index === 2 ? 10 : 12} color={color} strokeWidth={2.5} />
        </Animated.View>
      ))}
    </View>
  );
}

function formatWeekRange(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },
  scrollContentEnd: { paddingBottom: 13 },
  screenTransition: { flexGrow: 1 },
  onboardingBanner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingRight: 8,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  onboardingAccent: { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  onboardingText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  onboardingButton: { minHeight: 34, paddingHorizontal: 12 },
  onboardingDismissButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  identityGreetingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 4 },
  identityGreetingLead: { fontSize: 18, lineHeight: 27, fontWeight: '500', letterSpacing: -0.2, flexShrink: 0 },
  dateTimeLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500' },
  greetingNameWrap: { position: 'relative' },
  greetingName: { fontSize: 23, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  greetingSparkle: { position: 'absolute' },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 0 },
  heroStatusDot: { width: 7, height: 7, borderRadius: 4 },
  heroStatus: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '500' },
  heroStatsSection: { marginHorizontal: 16, marginTop: 8 },
  heroStats: { flexDirection: 'row', alignItems: 'stretch', marginTop: 4, paddingTop: 4, paddingBottom: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,150,170,0.2)', borderBottomColor: 'rgba(128,150,170,0.2)' },
  heroStatTile: { flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 2 },
  heroStatDivider: { width: StyleSheet.hairlineWidth, marginVertical: 3 },
  snapshotIconPlaceholder: { height: 16 },
  snapshotLabel: { marginTop: 5, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.3 },
  snapshotValue: { marginTop: 1, fontSize: 13, lineHeight: 17, fontWeight: '700', letterSpacing: -0.1 },
  profileCardShadow: {
    marginHorizontal: 0,
    marginTop: 0,
  },
  profileCard: {
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  profileArtClip: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 112,
    height: 72,
    overflow: 'hidden',
  },
  profileArtShift: {
    position: 'absolute',
    width: 190,
    height: 100,
    right: -28,
    bottom: -20,
  },
  profileWaves: {
    position: 'absolute',
    height: 34,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  profileWave: {
    position: 'absolute',
    width: '130%',
    height: 30,
    left: '-15%',
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
  },
  profileWave0: { bottom: -22, transform: [{ rotate: '-4deg' }] },
  profileWave1: { bottom: -25, transform: [{ rotate: '3deg' }] },
  profileWave2: { bottom: -28, transform: [{ rotate: '-2deg' }] },
  profileWave3: { bottom: -31, transform: [{ rotate: '4deg' }] },
  profileWave4: { bottom: -34, transform: [{ rotate: '-1deg' }] },
  profileCardBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 1,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarShell: {
    width: 54,
    height: 54,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 27,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  avatarShellCompact: { width: 50, height: 50, borderRadius: 25 },
  avatarImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  avatarInitials: { fontFamily: 'Comfortaa_600SemiBold', fontSize: 18, fontWeight: '600' },
  identityCopy: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  employeeStatusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  employeeStatus: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  profileArrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9, rowGap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  profileField: { width: '50%', paddingRight: 10 },
  profileFieldLabel: { fontSize: 9, lineHeight: 12, fontWeight: '600', letterSpacing: 0.25 },
  profileFieldValue: { marginTop: 1, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  sectionHeading: { marginTop: 12, marginBottom: 5, marginHorizontal: 18, fontSize: 14, lineHeight: 19, fontWeight: '700', letterSpacing: -0.1 },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shortcutDivider: { width: StyleSheet.hairlineWidth, marginVertical: 10 },
  shortcut: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 3, gap: 5 },
  shortcutIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  shortcutLabel: { fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  attendanceCard: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 12,
    borderRadius: 12,
  },
  comingUpCard: { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 6, borderRadius: 12 },
  comingUpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  comingUpLink: { paddingHorizontal: 6, paddingVertical: 5 },
  comingUpLinkText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  comingUpRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  comingUpIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  comingUpCopy: { flex: 1, minWidth: 0 },
  comingUpTitle: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  comingUpDate: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: '500' },
  comingUpEmpty: { paddingTop: 5, paddingBottom: 9, fontSize: 11, lineHeight: 16 },
  attendanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attendanceHeaderCopy: { flex: 1 },
  attendanceTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', letterSpacing: -0.1 },
  attendanceRange: { marginTop: 1, fontSize: 11, lineHeight: 15, fontWeight: '500' },
  streakPill: { maxWidth: 148, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  streakLine: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  attendanceSummary: {
    flexDirection: 'row',
    marginTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  attendanceSummaryItem: { flex: 1 },
  attendanceSummaryValue: { fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.2 },
  attendanceSummaryLabel: { marginTop: 2, fontSize: 10, lineHeight: 13, fontWeight: '600' },
  attendanceChart: { height: 116, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10 },
  attendanceDay: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  attendanceHours: { height: 16, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  attendanceBarTrack: {
    width: '62%',
    minWidth: 16,
    maxWidth: 28,
    height: 64,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 8,
  },
  attendanceBar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  attendanceDayLabel: { marginTop: 6, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  attendanceDayLabelActive: { fontWeight: '700' },
  attendancePunches: { marginTop: 3, gap: 1 },
  attendancePunchState: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  attendancePunchDot: { width: 5, height: 5, borderRadius: 3 },
  attendancePunchLabel: { fontSize: 7, lineHeight: 9, fontWeight: '400' },
});
