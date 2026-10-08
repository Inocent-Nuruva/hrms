import React from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Clock3, Globe2, MapPin, Navigation, Radio, ShieldCheck, Wifi } from 'lucide-react-native';

import { api, normalizeList, readMobilePunchContext } from '../lib/api';
import { COLORS } from '../lib/config';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent } from '../lib/profile-card-background';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { FluentButton } from '../components/ui/fluent-button';

interface Props {
  auth: UseAuthReturn;
}

type RecordValue = Record<string, unknown>;

export function MyLocationScreen({ auth }: Props) {
  const { isDark } = useThemePreference();
  const paletteQuery = useQuery({ queryKey: ['dashboardCardStyle'], queryFn: () => api.getMyDashboardCardStyle(), enabled: auth.isAuthenticated });
  const selectedStyle = normalizeProfileCardStyle(paletteQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const accent = profilePaletteAccent(selectedStyle.palette, isDark);
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const cardColor = isDark ? COLORS.surfaceDark : COLORS.surface;
  const [locationLive, setLocationLive] = React.useState(false);
  const [permissionMessage, setPermissionMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync().then((permission) => {
      if (active && permission.granted) setLocationLive(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const locationQuery = useQuery({
    queryKey: ['mobileWorkLocationContext'],
    queryFn: readCurrentLocation,
    staleTime: 1000 * 60,
    enabled: locationLive,
    refetchInterval: locationLive ? 30_000 : false,
  });
  const todayQuery = useQuery({
    queryKey: ['mobileWorkLocationAttendanceToday'],
    queryFn: () => api.getMyAttendanceToday(),
    staleTime: 1000 * 60,
  });
  const todayKey = dateKey(new Date());
  const historyFrom = dateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const historyQuery = useQuery({
    queryKey: ['mobileWorkLocationAttendanceHistory', historyFrom, todayKey],
    queryFn: async () => normalizeList(await api.listMyAttendanceHistory({ from_date: historyFrom, to_date: todayKey, limit: 7 })),
    staleTime: 1000 * 60,
  });
  const punchesQuery = useQuery({
    queryKey: ['mobileWorkLocationRecentPunches'],
    queryFn: async () => normalizeList(await api.listMyPunches({ limit: 10, sortOrder: 'DESC' })),
    staleTime: 1000 * 60,
  });

  const refreshing = locationQuery.isFetching || todayQuery.isFetching || historyQuery.isFetching || punchesQuery.isFetching;
  const onRefresh = React.useCallback(async () => {
    await Promise.all([locationLive ? locationQuery.refetch() : Promise.resolve(), todayQuery.refetch(), historyQuery.refetch(), punchesQuery.refetch()]);
  }, [historyQuery, locationLive, locationQuery, punchesQuery, todayQuery]);

  const toggleLocation = React.useCallback(async () => {
    if (locationLive) {
      setLocationLive(false);
      setPermissionMessage(null);
      return;
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setPermissionMessage('Location access is off. You can turn it on here, or allow access when you check in.');
      return;
    }
    setPermissionMessage(null);
    setLocationLive(true);
  }, [locationLive]);

  const currentLocation = locationQuery.data;
  const today = asRecord(todayQuery.data);
  const recentPunch = punchesQuery.data?.map(asRecord).find((item) => item !== null) || null;
  const employee = asRecord(auth.employee);
  const assignedLocation = readString(employee, ['work_location_name', 'location_name', 'branch_name']) ||
    readNestedString(employee, ['work_location', 'branch'], ['name', 'location_name']);
  const checkIn = readString(today, ['checkInAt', 'check_in_at', 'firstCheckInAt', 'first_check_in_at']);
  const checkOut = readString(today, ['checkOutAt', 'check_out_at', 'lastCheckOutAt', 'last_check_out_at']);
  const lastPunchLocation = readString(recentPunch, ['location_name', 'locationName', 'address', 'location', 'place_name']);
  const lastPunchTime = readString(recentPunch, ['punched_at', 'punch_time', 'created_at', 'createdAt', 'timestamp']);
  const attendedDays = (historyQuery.data || []).filter((item) => {
    const record = asRecord(item);
    const status = readString(record, ['attendanceStatus', 'attendance_status', 'status']).toLowerCase();
    return Boolean(readString(record, ['checkInAt', 'check_in_at', 'firstCheckInAt', 'first_check_in_at'])) ||
      ['present', 'late', 'checked-in', 'checked_in', 'complete', 'completed'].includes(status);
  }).length;

  const openMap = React.useCallback(async () => {
    const latitude = currentLocation?.latitude;
    const longitude = currentLocation?.longitude;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  }, [currentLocation]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor }]} edges={[]}>
      <MobileTopBar auth={auth} variant="compact" />
      <ScrollView
        style={{ backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accent]} />}
      >
        <ScreenTransition>
          <View style={styles.pageHeader}>
            <Text style={[styles.eyebrow, { color: accent }]}>WORKPLACE</Text>
            <Text style={[styles.pageTitle, { color: textColor }]}>Work location</Text>
            <Text style={[styles.pageDescription, { color: mutedColor }]}>Your live device location and attendance location details.</Text>
          </View>

          <Card variant="elevated" style={[styles.locationCard, { backgroundColor: cardColor, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
            <View style={styles.locationCardHeader}>
              <View style={[styles.locationIcon, { backgroundColor: isDark ? '#173A56' : '#EAF4FC' }]}>
                <MapPin size={20} color={accent} />
              </View>
              <View style={styles.locationHeading}>
                <Text style={[styles.cardEyebrow, { color: mutedColor }]}>CURRENT LOCATION</Text>
                <Text style={[styles.locationName, { color: textColor }]} numberOfLines={2}>
                  {currentLocation?.address || (locationQuery.isLoading ? 'Finding your location…' : 'Location unavailable')}
                </Text>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: locationLive ? (locationQuery.isError ? (isDark ? '#44292B' : '#FDECEC') : (isDark ? '#173F36' : '#E8F7F1')) : (isDark ? '#303841' : '#F1F3F4') }]}>
                <View style={[styles.liveDot, { backgroundColor: locationLive && !locationQuery.isError ? '#107C10' : '#8A8886' }]} />
                <Text style={[styles.liveText, { color: locationLive && !locationQuery.isError ? '#107C10' : mutedColor }]}>
                  {locationLive ? locationQuery.isFetching ? 'Updating' : locationQuery.isError ? 'Unavailable' : 'Live' : 'Off'}
                </Text>
              </View>
            </View>

            <View style={styles.locationControlRow}>
              <Text style={[styles.locationControlHint, { color: mutedColor }]}>
                {locationLive ? 'Live location refreshes while this is on.' : 'Check-in will ask for location access if needed.'}
              </Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: locationLive }}
                accessibilityLabel="Live location"
                onPress={() => void toggleLocation()}
                style={[styles.locationToggle, { backgroundColor: locationLive ? accent : (isDark ? '#3B4652' : '#E4E9EE') }]}
              >
                <View style={[styles.locationToggleKnob, locationLive && styles.locationToggleKnobOn]} />
              </Pressable>
            </View>

            {permissionMessage ? <Text style={[styles.errorText, { color: isDark ? '#FFB4AB' : '#B42318' }]}>{permissionMessage}</Text> : null}
            {locationLive && locationQuery.isError ? (
              <Text style={[styles.errorText, { color: isDark ? '#FFB4AB' : '#B42318' }]}>
                {locationQuery.error instanceof Error ? locationQuery.error.message : 'Allow location access to see your current position.'}
              </Text>
            ) : null}

            <View style={[styles.coordinatesPanel, { backgroundColor: isDark ? '#1B222A' : '#F5F9FC' }]}>
              <View style={styles.coordinateItem}>
                <Text style={[styles.coordinateLabel, { color: mutedColor }]}>LATITUDE</Text>
              <Text style={[styles.coordinateValue, { color: textColor }]}>{formatCoordinate(currentLocation?.latitude)}</Text>
              </View>
              <View style={[styles.coordinateDivider, { backgroundColor: isDark ? '#46515D' : '#DCE7F0' }]} />
              <View style={styles.coordinateItem}>
                <Text style={[styles.coordinateLabel, { color: mutedColor }]}>LONGITUDE</Text>
              <Text style={[styles.coordinateValue, { color: textColor }]}>{formatCoordinate(currentLocation?.longitude)}</Text>
              </View>
            </View>

            <View style={styles.locationMeta}>
              <View style={styles.metaItem}>
                <Radio size={15} color={mutedColor} />
                <Text style={[styles.metaText, { color: mutedColor }]}>
                  {currentLocation?.accuracyMeters ? `±${Math.round(currentLocation.accuracyMeters)} m accuracy` : 'Accuracy unavailable'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Globe2 size={15} color={mutedColor} />
                <Text style={[styles.metaText, { color: mutedColor }]}>{currentLocation?.networkType || 'Network unavailable'}</Text>
              </View>
            </View>

            <FluentButton appearance="primary" centered onPress={() => void openMap()} disabled={!currentLocation || !locationLive} style={[styles.mapButton, { backgroundColor: accent, borderColor: accent }]}>
              Open in Maps
            </FluentButton>
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Workplace details</Text>
            <ShieldCheck size={18} color={accent} />
          </View>
          <Card variant="elevated" style={[styles.detailsCard, { backgroundColor: cardColor, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
            <DetailRow icon={<MapPin size={17} color={accent} />} label="Assigned workplace" value={assignedLocation || 'No workplace assigned'} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.rowDivider, { backgroundColor: isDark ? '#3A444F' : '#E7EEF4' }]} />
            <DetailRow icon={<Wifi size={17} color={accent} />} label="Connected Wi-Fi" value={currentLocation?.wifiSsid || 'Not available on this device'} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.rowDivider, { backgroundColor: isDark ? '#3A444F' : '#E7EEF4' }]} />
            <DetailRow icon={<Radio size={17} color={accent} />} label="Wi-Fi BSSID" value={currentLocation?.wifiBssid || 'Not available on this device'} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.rowDivider, { backgroundColor: isDark ? '#3A444F' : '#E7EEF4' }]} />
            <DetailRow icon={<Globe2 size={17} color={accent} />} label="Network / IP" value={[currentLocation?.networkType, currentLocation?.ipAddress].filter(Boolean).join(' · ') || 'Unavailable'} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.rowDivider, { backgroundColor: isDark ? '#3A444F' : '#E7EEF4' }]} />
            <DetailRow icon={<Clock3 size={17} color={accent} />} label="Today’s attendance" value={checkOut ? `Checked out · ${formatTime(checkOut)}` : checkIn ? `Checked in · ${formatTime(checkIn)}` : 'No punches recorded today'} textColor={textColor} mutedColor={mutedColor} />
            <View style={[styles.rowDivider, { backgroundColor: isDark ? '#3A444F' : '#E7EEF4' }]} />
            <DetailRow icon={<Clock3 size={17} color={accent} />} label="Attendance days · last 7 days" value={historyQuery.isLoading ? 'Loading…' : `${attendedDays} ${attendedDays === 1 ? 'day' : 'days'} recorded`} textColor={textColor} mutedColor={mutedColor} />
            {lastPunchLocation || lastPunchTime ? <>
              <View style={[styles.rowDivider, { backgroundColor: isDark ? '#3A444F' : '#E7EEF4' }]} />
              <DetailRow icon={<Navigation size={17} color={accent} />} label="Most recent punch" value={[lastPunchLocation, lastPunchTime ? formatDateTime(lastPunchTime) : ''].filter(Boolean).join(' · ')} textColor={textColor} mutedColor={mutedColor} />
            </> : null}
          </Card>

          {refreshing && !currentLocation ? <ActivityIndicator style={styles.loader} color={accent} /> : null}
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, textColor, mutedColor }: { icon: React.ReactNode; label: string; value: string; textColor: string; mutedColor: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailCopy}>
        <Text style={[styles.detailLabel, { color: mutedColor }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
      </View>
    </View>
  );
}

async function readCurrentLocation() {
  const context = await readMobilePunchContext();
  let address = 'Location detected';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: context.latitude, longitude: context.longitude });
    const place = places[0];
    if (place) address = [place.name, place.street, place.city, place.region].filter(Boolean).join(', ') || address;
  } catch {
    // Coordinates remain useful when reverse geocoding is offline.
  }
  return { ...context, address };
}

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === 'object' ? value as RecordValue : null;
}

function readString(record: RecordValue | null, keys: string[]) {
  if (!record) return '';
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readNestedString(record: RecordValue | null, parents: string[], keys: string[]) {
  if (!record) return '';
  for (const parent of parents) {
    const value = readString(asRecord(record[parent]), keys);
    if (value) return value;
  }
  return '';
}

function formatCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '—';
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 32 },
  pageHeader: { marginHorizontal: 20, marginTop: 12, marginBottom: 18 },
  eyebrow: { fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 1.4 },
  pageTitle: { marginTop: 4, fontSize: 25, lineHeight: 33, fontWeight: '600', letterSpacing: -0.5 },
  pageDescription: { marginTop: 5, fontSize: 13, lineHeight: 19 },
  locationCard: { marginHorizontal: 16, padding: 16, borderRadius: 18 },
  locationCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  locationIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locationHeading: { flex: 1, minWidth: 0 },
  cardEyebrow: { fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1 },
  locationName: { marginTop: 3, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
  errorText: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  coordinatesPanel: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, borderRadius: 12 },
  coordinateItem: { flex: 1, minWidth: 0 },
  coordinateDivider: { width: 1, height: 34, marginHorizontal: 12 },
  coordinateLabel: { fontSize: 9, lineHeight: 13, fontWeight: '600', letterSpacing: 0.8 },
  coordinateValue: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  locationControlRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationControlHint: { flex: 1, fontSize: 11, lineHeight: 16 },
  locationToggle: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  locationToggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', alignSelf: 'flex-start' },
  locationToggleKnobOn: { alignSelf: 'flex-end' },
  locationMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 13 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, lineHeight: 16 },
  mapButton: { marginTop: 16, minHeight: 44, minWidth: 190, alignSelf: 'center' },
  sectionHeader: { marginHorizontal: 20, marginTop: 23, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  detailsCard: { marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: 12 },
  detailIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1, minWidth: 0, paddingVertical: 9 },
  detailLabel: { fontSize: 11, lineHeight: 16 },
  detailValue: { marginTop: 2, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
  loader: { marginTop: 20 },
});
