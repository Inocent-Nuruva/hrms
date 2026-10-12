import React from 'react';
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LoadingIndicator } from '../components/ui/loading-indicator';
import { FluentButton } from '../components/ui/fluent-button';

import { api, normalizeList } from '../lib/api';
import { COLORS } from '../lib/config';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent } from '../lib/profile-card-background';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { Text } from '../components/ui/text';

type MobileRecord = Record<string, unknown>;

interface Props {
  auth: UseAuthReturn;
}

export function PunchDetailsScreen({ auth }: Props) {
  const router = useRouter();
  const { isDark } = useThemePreference();
  const paletteQuery = useQuery({ queryKey: ['dashboardCardStyle'], queryFn: () => api.getMyDashboardCardStyle(), enabled: auth.isAuthenticated });
  const selectedStyle = normalizeProfileCardStyle(paletteQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const accentColor = profilePaletteAccent(selectedStyle.palette, isDark);
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const panelColor = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const todayKey = toDateKey(new Date());
  const [filterDate, setFilterDate] = React.useState(todayKey);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [pickerYear, setPickerYear] = React.useState(new Date(filterDate).getFullYear());
  const [pickerMonth, setPickerMonth] = React.useState(new Date(filterDate).getMonth() + 1);
  const [pickerDay, setPickerDay] = React.useState(new Date(filterDate).getDate());
  const [calendarView, setCalendarView] = React.useState<'days' | 'months' | 'years'>('days');
  const [yearRangeStart, setYearRangeStart] = React.useState(Math.floor(new Date(filterDate).getFullYear() / 12) * 12);

  const punchesQuery = useQuery({
    queryKey: ['mobilePunchDetails', filterDate],
    queryFn: async () => {
      const pageSize = 100;
      const punches: Record<string, unknown>[] = [];
      let page = 1;
      let total: number | undefined;

      while (true) {
        const response = await api.listMyPunches({ dateFrom: filterDate, dateTo: filterDate, page, limit: pageSize });
        const pagePunches = await normalizeList(response);
        punches.push(...pagePunches);

        const envelope = asRecord(response);
        const nestedEnvelope = asRecord(envelope?.data);
        const meta = asRecord(envelope?.meta) || asRecord(nestedEnvelope?.meta);
        const reportedTotal = Number(meta?.total);
        if (Number.isFinite(reportedTotal)) total = reportedTotal;

        if (pagePunches.length < pageSize || (total !== undefined && punches.length >= total)) break;
        page += 1;
      }

      return punches;
    },
    enabled: auth.isAuthenticated,
  });

  const onRefresh = React.useCallback(async () => {
    await punchesQuery.refetch();
  }, [punchesQuery]);

  const openDatePicker = () => {
    const current = new Date(filterDate);
    setPickerYear(current.getFullYear());
    setPickerMonth(current.getMonth() + 1);
    setPickerDay(current.getDate());
    setCalendarView('days');
    setYearRangeStart(Math.floor(current.getFullYear() / 12) * 12);
    setShowDatePicker(true);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
  const monthStartWeekday = new Date(pickerYear, pickerMonth - 1, 1).getDay();
  const calendarCellCount = Math.ceil((monthStartWeekday + getDaysInMonth(pickerYear, pickerMonth)) / 7) * 7;

  const datePunches = (punchesQuery.data || [])
    .map((item) => asRecord(item))
    .filter((item): item is MobileRecord => Boolean(item))
    .filter((item) => {
      const stamp = readPunchTimestamp(item);
      if (!stamp) return false;
      const attendanceDate = readString(item, ['attendance_date', 'attendanceDate', 'date']);
      return attendanceDate
        ? attendanceDate.slice(0, 10) === filterDate
        : new Date(stamp).toISOString().slice(0, 10) === filterDate;
    })
    .sort((a, b) => {
      const left = new Date(readPunchTimestamp(a) || 0).getTime();
      const right = new Date(readPunchTimestamp(b) || 0).getTime();
      return left - right;
    });

  const filteredPunches = datePunches;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} title="Punch history" variant="centered" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={punchesQuery.isFetching} onRefresh={onRefresh} colors={[accentColor]} />}
      >
        <ScreenTransition>
          <Text style={[styles.title, { color: textColor }]}>{new Date(filterDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          <Text style={[styles.subtitle, { color: mutedColor }]}>{filteredPunches.length} {filteredPunches.length === 1 ? 'punch' : 'punches'} recorded</Text>

          {/* Date filter */}
          <View style={styles.filterBar}>
            <Text style={[styles.filterLabel, { color: mutedColor }]}>Filter by date:</Text>
            <View style={styles.dateNav}>
              <TouchableOpacity style={styles.dateArrow} accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => {
                const d = new Date(filterDate);
                d.setDate(d.getDate() - 1);
                const newDate = toDateKey(d);
                setFilterDate(newDate);
              }}>
                <ChevronLeft size={19} color={accentColor} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateSelector, { backgroundColor: isDark ? '#27272a' : '#F3F2F1', borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                accessibilityRole="button"
                accessibilityLabel="Choose date"
                onPress={openDatePicker}
              >
                <Text style={[styles.filterDateText, { color: textColor }]}>
                  {new Date(filterDate).toLocaleDateString()}
                </Text>
                <CalendarDays size={16} color={accentColor} style={{ marginLeft: 5 }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateArrow} accessibilityRole="button" accessibilityLabel="Next day" onPress={() => {
                const d = new Date(filterDate);
                d.setDate(d.getDate() + 1);
                const newDate = toDateKey(d);
                setFilterDate(newDate);
              }}>
                <ChevronRight size={19} color={accentColor} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => setFilterDate(todayKey)} style={[styles.todayChip, { backgroundColor: accentColor }]}>
                <Text style={styles.todayChipText}>Today</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: panelColor }]}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Select a date</Text>

                {calendarView === 'days' ? (
                  <>
                    <View style={styles.calendarHeader}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Previous month"
                        style={styles.calendarMonthArrow}
                        onPress={() => {
                          const next = new Date(pickerYear, pickerMonth - 2, 1);
                          setPickerYear(next.getFullYear());
                          setPickerMonth(next.getMonth() + 1);
                          setPickerDay(Math.min(pickerDay, getDaysInMonth(next.getFullYear(), next.getMonth() + 1)));
                        }}
                      ><ChevronLeft size={19} color={accentColor} /></TouchableOpacity>
                      <View style={styles.calendarSelectors}>
                        <Pressable accessibilityRole="button" accessibilityLabel="Choose month" style={styles.calendarSelector} onPress={() => setCalendarView('months')}>
                          <Text style={[styles.calendarMonthLabel, { color: textColor }]}>{new Date(pickerYear, pickerMonth - 1, 1).toLocaleDateString(undefined, { month: 'long' })}</Text>
                          <ChevronDown size={15} color={accentColor} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Choose year" style={styles.calendarSelector} onPress={() => setCalendarView('years')}>
                          <Text style={[styles.calendarMonthLabel, { color: textColor }]}>{pickerYear}</Text>
                          <ChevronDown size={15} color={accentColor} />
                        </Pressable>
                      </View>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Next month"
                        style={styles.calendarMonthArrow}
                        onPress={() => {
                          const next = new Date(pickerYear, pickerMonth, 1);
                          setPickerYear(next.getFullYear());
                          setPickerMonth(next.getMonth() + 1);
                          setPickerDay(Math.min(pickerDay, getDaysInMonth(next.getFullYear(), next.getMonth() + 1)));
                        }}
                      ><ChevronRight size={19} color={accentColor} /></TouchableOpacity>
                    </View>

                    <View style={styles.calendarGrid}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <View key={`${day}-${index}`} style={styles.calendarCell}>
                          <Text style={[styles.calendarWeekday, { color: mutedColor }]}>{day}</Text>
                        </View>
                      ))}
                      {Array.from({ length: calendarCellCount }, (_, index) => {
                        const day = index - monthStartWeekday + 1;
                        const inMonth = day > 0 && day <= getDaysInMonth(pickerYear, pickerMonth);
                        const selected = inMonth && day === pickerDay;
                        return (
                          <TouchableOpacity
                            key={`date-${index}`}
                            disabled={!inMonth}
                            accessibilityRole="button"
                            accessibilityLabel={inMonth ? new Date(pickerYear, pickerMonth - 1, day).toLocaleDateString(undefined, { dateStyle: 'full' }) : undefined}
                            accessibilityState={{ selected }}
                            onPress={() => setPickerDay(day)}
                            style={[styles.calendarCell, selected && { backgroundColor: accentColor }]}
                          >
                            <Text style={[styles.calendarDay, { color: selected ? '#FFFFFF' : inMonth ? textColor : 'transparent' }, selected && styles.calendarDaySelected]}>
                              {inMonth ? day : ' '}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : calendarView === 'months' ? (
                  <>
                    <View style={styles.calendarPickerHeader}>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to calendar" style={styles.calendarMonthArrow} onPress={() => setCalendarView('days')}>
                        <ChevronLeft size={19} color={accentColor} />
                      </TouchableOpacity>
                      <Text style={[styles.calendarPickerTitle, { color: textColor }]}>Choose month</Text>
                      <View style={styles.calendarMonthArrow} />
                    </View>
                    <View style={styles.calendarChoiceGrid}>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                        const selected = month === pickerMonth;
                        return (
                          <TouchableOpacity
                            key={month}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              setPickerMonth(month);
                              setPickerDay(Math.min(pickerDay, getDaysInMonth(pickerYear, month)));
                              setCalendarView('days');
                            }}
                            style={[styles.calendarChoice, selected && { backgroundColor: accentColor }]}
                          >
                            <Text style={[styles.calendarChoiceText, { color: selected ? '#FFFFFF' : textColor }]}>
                              {new Date(pickerYear, month - 1, 1).toLocaleDateString(undefined, { month: 'short' })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.calendarPickerHeader}>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous years" style={styles.calendarMonthArrow} onPress={() => setYearRangeStart((start) => start - 12)}>
                        <ChevronLeft size={19} color={accentColor} />
                      </TouchableOpacity>
                      <Text style={[styles.calendarPickerTitle, { color: textColor }]}>{yearRangeStart}–{yearRangeStart + 11}</Text>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next years" style={styles.calendarMonthArrow} onPress={() => setYearRangeStart((start) => start + 12)}>
                        <ChevronRight size={19} color={accentColor} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.calendarChoiceGrid}>
                      {Array.from({ length: 12 }, (_, index) => yearRangeStart + index).map((year) => {
                        const selected = year === pickerYear;
                        return (
                          <TouchableOpacity
                            key={year}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                              setPickerYear(year);
                              setPickerDay(Math.min(pickerDay, getDaysInMonth(year, pickerMonth)));
                              setCalendarView('days');
                            }}
                            style={[styles.calendarChoice, selected && { backgroundColor: accentColor }]}
                          >
                            <Text style={[styles.calendarChoiceText, { color: selected ? '#FFFFFF' : textColor }]}>{year}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={{ color: mutedColor, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      const y = pickerYear;
                      const m = String(pickerMonth).padStart(2, '0');
                      const d = String(pickerDay).padStart(2, '0');
                      setFilterDate(`${y}-${m}-${d}`);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={{ color: accentColor, fontSize: 16, fontWeight: '600' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {punchesQuery.isLoading ? (
            <View style={styles.loaderWrap}>
              <LoadingIndicator size="md" />
            </View>
          ) : punchesQuery.isError ? (
            <View style={[styles.emptyCard, { backgroundColor: panelColor }]}>
              <Text style={[styles.emptyText, { color: mutedColor }]}>Couldn’t load punches for this date.</Text>
              <TouchableOpacity onPress={() => void punchesQuery.refetch()} style={styles.retryButton}>
                <Text style={[styles.retryText, { color: accentColor }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : filteredPunches.length === 0 ? (
            <NoPunchesEmptyState
              isDark={isDark}
              isToday={filterDate === todayKey}
              textColor={textColor}
              mutedColor={mutedColor}
              actionColor={accentColor}
              onToday={() => setFilterDate(todayKey)}
              onChooseDate={openDatePicker}
            />
          ) : (
            filteredPunches.map((punch, index) => {
              const time = formatTime(readPunchTimestamp(punch));
              const type = readString(punch, ['punch_type', 'punchType', 'type']).toUpperCase();
              const branch = asRecord(punch.branch);
              const location = readString(punch, ['branch_name', 'branchName', 'location_name', 'locationName']) || readString(branch, ['name', 'branchName', 'branch_name']);
              const validation = readString(punch, ['validation_status', 'validationStatus']);
              const punchLabel = index === 0
                ? 'Check in'
                : type.includes('OUT')
                  ? 'Check out'
                  : type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Punch';
              const punchColor = accentColor;
              const punchTint = isDark ? '#1E3445' : '#EAF3FC';
              return (
                <View key={readString(punch, ['id']) || `${filterDate}-${time}-${index}`} style={[styles.punchCard, { backgroundColor: panelColor, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
                  <View style={styles.punchRow}>
                    <View style={[styles.punchIcon, { backgroundColor: punchTint }]}>
                      <Clock3 size={18} color={punchColor} />
                    </View>
                    <View style={styles.punchInfo}>
                      <Text style={[styles.punchType, { color: textColor }]}>{punchLabel}</Text>
                      <Text style={[styles.punchTime, { color: mutedColor }]}>
                        {[index === 0 ? 'First punch of the day' : 'Attendance record', location, validation ? validation.replace(/_/g, ' ').toLowerCase() : ''].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[styles.punchTimeValue, { color: punchColor }]}>{time}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScreenTransition>
      </ScrollView>

      <SafeAreaView style={[styles.bottomBar, { backgroundColor, borderTopColor: isDark ? COLORS.outlineDark : COLORS.outline }]} edges={['bottom']}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(tabs)/attendance'); }} style={styles.backAction}>
          <ArrowLeft size={17} color={accentColor} />
          <Text style={[styles.backActionText, { color: accentColor }]}>Back to attendance</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
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

function readPunchTimestamp(value: unknown) {
  return readString(value, [
    'punchTime',
    'punch_time',
    'punched_at',
    'punchedAt',
    'timestamp',
    'created_at',
    'createdAt',
  ]);
}

function formatTime(value: string) {
  if (!value) return '--:--';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function NoPunchesEmptyState({
  isDark,
  isToday,
  textColor,
  mutedColor,
  actionColor,
  onToday,
  onChooseDate,
}: {
  isDark: boolean;
  isToday: boolean;
  textColor: string;
  mutedColor: string;
  actionColor: string;
  onToday: () => void;
  onChooseDate: () => void;
}) {
  const [rotation] = React.useState(() => new Animated.Value(0));
  const [float] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const orbit = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 24000,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const bob = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    orbit.start();
    bob.start();
    return () => {
      orbit.stop();
      bob.stop();
    };
  }, [float, rotation]);

  const handleToday = () => {
    Vibration.vibrate(10);
    onToday();
  };

  return (
    <View style={styles.noPunchesState}>
      <View style={styles.emptyIllustration}>
        <Animated.View style={[styles.emptyDoodleOrbit, { borderColor: isDark ? '#354B5E' : '#C7DFF2', transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
        <Animated.View style={[styles.emptyDoodle, styles.emptyDoodleTop, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}>
          <Sparkles size={18} color={actionColor} />
        </Animated.View>
        <Animated.View style={[styles.emptyDoodle, styles.emptyDoodleSide, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }] }]}>
          <CalendarDays size={17} color={isDark ? '#B4A0FF' : '#5C2D91'} />
        </Animated.View>
        <View style={[styles.emptyClockBadge, { backgroundColor: isDark ? '#1E3445' : '#EAF3FC' }]}>
          <Clock3 size={37} color={actionColor} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={[styles.emptyTitle, { color: textColor }]}>A quiet day</Text>
      <Text style={[styles.emptyDescription, { color: mutedColor }]}>There are no attendance punches for this date.</Text>
      {!isToday ? (
        <FluentButton centered onPress={handleToday} style={[styles.emptyPrimaryAction, { backgroundColor: actionColor }]}>
          View today’s punches
        </FluentButton>
      ) : null}
      <TouchableOpacity accessibilityRole="button" onPress={onChooseDate} style={styles.emptySecondaryAction}>
        <Text style={[styles.emptySecondaryText, { color: actionColor }]}>Choose another date</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  bottomBar: {
    minHeight: 54,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  noPunchesState: {
    minHeight: 345,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  emptyIllustration: {
    width: 190,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyDoodleOrbit: {
    position: 'absolute',
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyDoodle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  emptyDoodleTop: {
    top: 8,
    left: 27,
  },
  emptyDoodleSide: {
    right: 19,
    bottom: 13,
  },
  emptyClockBadge: {
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 7,
    textAlign: 'center',
  },
  emptyDescription: {
    maxWidth: 260,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyPrimaryAction: {
    minHeight: 44,
    minWidth: 190,
    alignSelf: 'center',
    marginTop: 18,
  },
  emptySecondaryAction: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 3,
  },
  emptySecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  punchCard: {
    width: '100%',
    minHeight: 82,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 12,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  punchIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchInfo: {
    flex: 1,
    gap: 4,
  },
  punchType: {
    fontSize: 15,
    fontWeight: '700',
  },
  punchTime: {
    fontSize: 11,
  },
  punchTimeValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  filterBar: {
    width: '100%',
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  dateArrow: {
    width: 42,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  filterDateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  todayChip: {
    minWidth: 66,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  todayChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dateSelector: {
    flex: 1,
    minWidth: 0,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  // Fluent-inspired calendar date picker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarMonthArrow: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarSelectors: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  calendarSelector: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  calendarPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarChoice: {
    width: '33.3333%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  calendarChoiceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  calendarWeekday: {
    fontSize: 13,
    fontWeight: '600',
  },
  calendarDay: {
    fontSize: 14,
  },
  calendarDaySelected: {
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#c5cde0',
  },
  modalButton: {
    padding: 8,
  },
});
