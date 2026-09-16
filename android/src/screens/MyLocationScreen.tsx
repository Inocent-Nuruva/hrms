import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react-native';

import { readMobilePunchContext } from '../lib/api';
import { COLORS } from '../lib/config';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { ScreenTransition } from '../components/ui/screen-transition';
import type { UseAuthReturn } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { Text } from '../components/ui/text';

interface Props {
  auth: UseAuthReturn;
}

export function MyLocationScreen({ auth }: Props) {
  const { isDark } = useThemePreference();
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const lineColor = isDark ? COLORS.outlineDark : COLORS.outline;

  const locationQuery = useQuery({
    queryKey: ['mobileMyLocation'],
    queryFn: async () => readCurrentLocationLabel(),
    staleTime: 1000 * 60 * 5,
  });

  const punchContextQuery = useQuery({
    queryKey: ['mobileMyPunchContext'],
    queryFn: async () => readPunchContextDetails(),
    staleTime: 1000 * 60 * 5,
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      locationQuery.refetch(),
      punchContextQuery.refetch(),
    ]);
  }, [locationQuery, punchContextQuery]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={[]}>
      <MobileTopBar auth={auth} variant="compact" />
      <ScrollView
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={locationQuery.isFetching || punchContextQuery.isFetching}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        <ScreenTransition>
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>My Location</Text>

            <View style={styles.mapShell}>
              <View style={styles.mapBackdrop}>
                <View style={styles.mapRoadHorizontal} />
                <View style={styles.mapRoadVertical} />
                <View style={styles.mapMarkerRing}>
                  <View style={styles.mapMarkerCore}>
                    <Text style={styles.mapMarkerText}>
                      {readInitials(auth.user?.fullName || `${auth.employee?.first_name || ''} ${auth.employee?.last_name || ''}`)}
                    </Text>
                  </View>
                </View>
                <View style={styles.mapPinAccent} />
                <View style={styles.mapPinAccentTwo} />
                {/* Google Maps style overlay */}
                <View style={styles.mapOverlayLabel}>
                  <Text style={styles.mapOverlayText} numberOfLines={1}>
                    {locationQuery.data || 'Current Location'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.contextItemFlat}>
              <MapPin size={16} color={mutedColor} />
              <View style={styles.contextItemContent}>
                <Text style={[styles.contextLabelFlat, { color: mutedColor }]}>Location</Text>
                <Text style={[styles.contextValueFlat, { color: textColor }]} numberOfLines={1}>
                  {locationQuery.data || 'Current location unavailable'}
                </Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: lineColor, marginVertical: 4 }} />

            <View style={styles.contextItemFlat}>
              <View style={styles.contextItemContent}>
                <Text style={[styles.contextLabelFlat, { color: mutedColor }]}>Wi-Fi SSID</Text>
                <Text style={[styles.contextValueFlat, { color: textColor }]} numberOfLines={1}>
                  {punchContextQuery.data?.wifiSsid || 'Unavailable'}
                </Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: lineColor, marginVertical: 4 }} />

            <View style={styles.contextItemFlat}>
              <View style={styles.contextItemContent}>
                <Text style={[styles.contextLabelFlat, { color: mutedColor }]}>BSSID</Text>
                <Text style={[styles.contextValueFlat, { color: textColor }]} numberOfLines={1}>
                  {punchContextQuery.data?.wifiBssid || 'Unavailable'}
                </Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: lineColor, marginVertical: 4 }} />

            <View style={styles.contextItemFlat}>
              <View style={styles.contextItemContent}>
                <Text style={[styles.contextLabelFlat, { color: mutedColor }]}>Latitude</Text>
                <Text style={[styles.contextValueFlat, { color: textColor }]}>
                  {punchContextQuery.data?.latitude || '--'}
                </Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: lineColor, marginVertical: 4 }} />

            <View style={styles.contextItemFlat}>
              <View style={styles.contextItemContent}>
                <Text style={[styles.contextLabelFlat, { color: mutedColor }]}>Longitude</Text>
                <Text style={[styles.contextValueFlat, { color: textColor }]}>
                  {punchContextQuery.data?.longitude || '--'}
                </Text>
              </View>
            </View>
          </View>
        </ScreenTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function readInitials(value: string) {
  const clean = value.trim();
  if (!clean) return 'IN';
  return clean
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

async function readCurrentLocationLabel() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return 'Location permission not granted';

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const places = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const place = places[0];
    if (!place) return 'Current location detected';
    return [place.name, place.street, place.city, place.region, place.country].filter(Boolean).join(', ');
  } catch {
    return 'Current location unavailable';
  }
}

async function readPunchContextDetails() {
  try {
    const context = await readMobilePunchContext();

    return {
      wifiSsid: context.wifiSsid || 'Unavailable',
      wifiBssid: context.wifiBssid || 'Unavailable',
      latitude: context.latitude.toFixed(6),
      longitude: context.longitude.toFixed(6),
    };
  } catch {
    return {
      wifiSsid: 'Unavailable',
      wifiBssid: 'Unavailable',
      latitude: '--',
      longitude: '--',
    };
  }
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 6,
    paddingBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
    color: '#6b7280',
  },
  mapShell: {
    marginHorizontal: 0,
    marginTop: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  mapBackdrop: {
    height: 180,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#e8f0e8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  mapRoadHorizontal: {
    position: 'absolute',
    top: 75,
    left: -40,
    right: -40,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#9ca3af',
    transform: [{ rotate: '-8deg' }],
    opacity: 0.9,
  },
  mapRoadVertical: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '45%',
    width: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#9ca3af',
    transform: [{ rotate: '6deg' }],
    opacity: 0.9,
  },
  mapMarkerRing: {
    position: 'absolute',
    top: 50,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMarkerCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  mapMarkerText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  mapPinAccent: {
    position: 'absolute',
    top: 52,
    left: 48,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  mapPinAccentTwo: {
    position: 'absolute',
    bottom: 52,
    right: 62,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  mapOverlayLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  mapOverlayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  contextItemFlat: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  contextItemContent: {
    flex: 1,
    minWidth: 0,
  },
  contextLabelFlat: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  contextValueFlat: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});

