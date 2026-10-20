import React from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import { MobileTopBar } from '../../components/layout/MobileTopBar';
import { ProfileCardDoodles } from '../../components/ui/profile-card-doodles';
import { FluentText as Text } from '../../components/ui/fluent-text';
import { useAuth } from '../../hooks/useAuth';
import { useThemePreference } from '../../hooks/useThemePreference';
import { useAppAccent } from '../../hooks/useAppAccent';
import { api } from '../../lib/api';
import * as LocalStorage from '../../lib/secure-store';
import { COLORS } from '../../lib/config';
import {
  DEFAULT_PROFILE_CARD_STYLE,
  PROFILE_CARD_ARTWORKS,
  PROFILE_CARD_PALETTES,
  profilePaletteAccent,
  profilePaletteForeground,
  profilePaletteColor,
  normalizeProfileCardStyle,
  type ProfileCardStyle,
} from '../../lib/profile-card-background';

const CARD_STYLE_QUERY_KEY = ['dashboardCardStyle'];

export default function SettingsTab() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { isDark } = useThemePreference();
  const appAccent = useAppAccent();
  const [saveError, setSaveError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [syncPending, setSyncPending] = React.useState(false);
  const syncLock = React.useRef(false);
  const syncRequested = React.useRef(false);
  const syncQueuedStyleRef = React.useRef<() => Promise<void>>(async () => {});
  const persistenceQueue = React.useRef<Promise<void>>(Promise.resolve());
  const latestStyle = React.useRef<ProfileCardStyle>(DEFAULT_PROFILE_CARD_STYLE);
  const storageScope = String(auth.user?.id ?? auth.user?.email ?? 'current-user');
  const localStyleKey = `hrms.dashboard-card-style.v1:${storageScope}`;
  const pendingStyleKey = `hrms.dashboard-card-style.pending.v1:${storageScope}`;
  const styleQuery = useQuery({
    queryKey: CARD_STYLE_QUERY_KEY,
    queryFn: async () => {
      const [localValue, pendingValue, network] = await Promise.all([
        LocalStorage.getItemAsync(localStyleKey).catch(() => null),
        LocalStorage.getItemAsync(pendingStyleKey).catch(() => null),
        NetInfo.fetch(),
      ]);
      const localStyle = parseStyle(localValue);
      const queuedStyle = parseStyle(pendingValue);
      if (queuedStyle) {
        latestStyle.current = queuedStyle;
        return queuedStyle;
      }
      if (!network.isConnected || network.isInternetReachable === false) {
        if (localStyle) {
          latestStyle.current = localStyle;
          return localStyle;
        }
        return DEFAULT_PROFILE_CARD_STYLE;
      }
      try {
        const remoteStyle = normalizeProfileCardStyle(await api.getMyDashboardCardStyle());
        latestStyle.current = remoteStyle;
        await LocalStorage.setItemAsync(localStyleKey, JSON.stringify(remoteStyle));
        return remoteStyle;
      } catch (error) {
        if (localStyle) {
          latestStyle.current = localStyle;
          return localStyle;
        }
        throw error;
      }
    },
    enabled: auth.isAuthenticated,
  });
  const selectedStyle = normalizeProfileCardStyle(styleQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;

  const syncQueuedStyle = React.useCallback(async () => {
    if (syncLock.current) {
      syncRequested.current = true;
      return;
    }
    syncLock.current = true;
    try {
      const network = await NetInfo.fetch();
      if (!network.isConnected || network.isInternetReachable === false) {
        setSyncPending(true);
        setSaving(false);
        return;
      }
      while (true) {
        const queuedValue = await LocalStorage.getItemAsync(pendingStyleKey);
        const queuedStyle = parseStyle(queuedValue);
        if (!queuedStyle) break;
        setSaving(true);
        await api.updateMyDashboardCardStyle(queuedStyle);
        const newestValue = await LocalStorage.getItemAsync(pendingStyleKey);
        if (newestValue === queuedValue) {
          await LocalStorage.deleteItemAsync(pendingStyleKey);
          await LocalStorage.setItemAsync(localStyleKey, JSON.stringify(queuedStyle));
        }
      }
      setSaveError(false);
      setSyncPending(false);
      setSaving(false);
    } catch {
      setSyncPending(true);
      setSaveError(false);
      setSaving(false);
    } finally {
      syncLock.current = false;
      if (syncRequested.current) {
        syncRequested.current = false;
        void syncQueuedStyleRef.current();
      }
    }
  }, [localStyleKey, pendingStyleKey]);

  React.useEffect(() => {
    syncQueuedStyleRef.current = syncQueuedStyle;
  }, [syncQueuedStyle]);

  React.useEffect(() => {
    let active = true;
    const checkPendingAndSync = async () => {
      const queuedStyle = parseStyle(await LocalStorage.getItemAsync(pendingStyleKey));
      if (!active) return;
      if (queuedStyle) {
        latestStyle.current = queuedStyle;
        queryClient.setQueryData(CARD_STYLE_QUERY_KEY, queuedStyle);
        setSyncPending(true);
        void syncQueuedStyle();
      }
    };
    void checkPendingAndSync().catch(() => {});
    const unsubscribe = NetInfo.addEventListener((network) => {
      if (network.isConnected && network.isInternetReachable !== false) void syncQueuedStyle();
      else {
        void LocalStorage.getItemAsync(pendingStyleKey).then((value) => {
          if (parseStyle(value)) setSyncPending(true);
        }).catch(() => {});
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncQueuedStyle();
    });
    return () => {
      active = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [pendingStyleKey, queryClient, syncQueuedStyle]);

  const saveStyle = React.useCallback((next: ProfileCardStyle) => {
    latestStyle.current = next;
    setSaveError(false);
    setSyncPending(true);
    queryClient.setQueryData(CARD_STYLE_QUERY_KEY, next);
    void queryClient.cancelQueries(
      { queryKey: CARD_STYLE_QUERY_KEY, exact: true },
      { revert: false },
    );
    persistenceQueue.current = persistenceQueue.current
      .then(async () => {
        const newestStyle = latestStyle.current;
        const serializedStyle = JSON.stringify(newestStyle);
        await LocalStorage.setItemAsync(localStyleKey, serializedStyle);
        await LocalStorage.setItemAsync(pendingStyleKey, serializedStyle);
        await syncQueuedStyle();
      })
      .catch(() => {
        setSaveError(true);
        setSyncPending(false);
      });
  }, [localStyleKey, pendingStyleKey, queryClient, syncQueuedStyle]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor }]} edges={[]}>
      <MobileTopBar auth={auth} title="Settings" variant="centered" titleWeight="400" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>Settings</Text>
        <Text style={[styles.description, { color: mutedColor }]}>Personalize your app experience.</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Dashboard card artwork</Text>
          <Text style={[styles.helper, { color: mutedColor }]}>Choose a doodle and color. Your choice is saved to your account and shared with the web dashboard.</Text>
          <Text style={[styles.groupLabel, { color: textColor }]}>Doodle structure</Text>
          <View style={styles.options}>
            {PROFILE_CARD_ARTWORKS.map((artwork) => {
              const selected = selectedStyle.artwork === artwork.id;
              const palette = PROFILE_CARD_PALETTES.find((item) => item.id === selectedStyle.palette) ?? PROFILE_CARD_PALETTES[0];
              return (
                <Pressable
                  key={artwork.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${artwork.label} doodle`}
                  onPress={() => void saveStyle({ ...selectedStyle, artwork: artwork.id })}
                  style={({ pressed }) => [
                    styles.option,
                    { opacity: pressed ? 0.82 : 1, borderColor: selected ? appAccent : (isDark ? '#475361' : '#C6DAE9'), backgroundColor: isDark ? '#252B32' : '#FFFFFF' },
                  ]}
                >
                  <View style={[styles.preview, { backgroundColor: profilePaletteColor(palette.id, isDark) }]}>
                    <ProfileCardDoodles artwork={artwork.id} onLight={profilePaletteForeground(profilePaletteColor(palette.id, isDark)) !== '#FFFFFF'} />
                  </View>
                  <View style={styles.optionCaption}>
                    <Text style={[styles.optionLabel, { color: textColor }]}>{artwork.label}</Text>
                    <View style={[styles.radio, { borderColor: selected ? appAccent : mutedColor }]}>
                      {selected ? <View style={[styles.radioDot, { backgroundColor: appAccent }]} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.groupLabel, styles.colorLabel, { color: textColor }]}>Color</Text>
          <View style={styles.paletteRow}>
            {PROFILE_CARD_PALETTES.map((palette) => {
              const selected = selectedStyle.palette === palette.id;
              return (
                <Pressable
                  key={palette.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${palette.label} card color`}
                  hitSlop={10}
                  onPress={() => void saveStyle({ ...selectedStyle, palette: palette.id })}
                  style={[styles.paletteOption, selected ? styles.paletteOptionSelected : null, { borderColor: selected ? appAccent : 'transparent' }]}
                >
                  <View style={[styles.swatch, { backgroundColor: palette.id === 'white' ? '#FFFFFF' : profilePaletteColor(palette.id, isDark), borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
                    {palette.id === 'white' ? (
                      <View style={styles.dynamicSwatchSplit}>
                        <View style={styles.dynamicSwatchLight}><View style={styles.dynamicSwatchDarkDot} /></View>
                        <View style={styles.dynamicSwatchDark}><View style={styles.dynamicSwatchLightDot} /></View>
                      </View>
                    ) : null}
                    {selected && palette.id !== 'white' ? <Check size={13} color={profilePaletteForeground(profilePaletteColor(palette.id, isDark))} strokeWidth={3} /> : null}
                  </View>
                  <Text style={[styles.paletteName, { color: mutedColor }]}>{palette.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.buttonThemePreview}>
            <Text style={[styles.helper, { color: mutedColor, marginTop: 0 }]}>Button preview</Text>
            <View style={[styles.finishButtonPreview, { backgroundColor: profilePaletteAccent(selectedStyle.palette, isDark) }]}>
              <Text style={styles.finishButtonPreviewText}>Finish onboarding</Text>
            </View>
          </View>
          <Text style={[styles.helper, { color: saveError ? '#B42318' : mutedColor }]}>
            {saveError
              ? 'Could not save this choice on your device. Please try again.'
              : saving
                ? 'Syncing your choice to your account…'
                : syncPending
                  ? 'Saved on this device. It will sync when you’re connected.'
                  : 'Saved to your account and shared with web and mobile.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30 },
  title: { fontSize: 21, lineHeight: 29, fontWeight: '400' },
  description: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  helper: { marginTop: 5, fontSize: 12, lineHeight: 18 },
  groupLabel: { marginTop: 18, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  colorLabel: { marginTop: 24 },
  options: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { width: '31%', flexGrow: 1, flexBasis: '28%', overflow: 'hidden', borderWidth: 2, borderRadius: 12 },
  preview: { width: '100%', height: 76, overflow: 'hidden' },
  optionCaption: { minHeight: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 12, lineHeight: 17 },
  radio: { width: 16, height: 16, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  paletteRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  paletteOption: { minWidth: 58, alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 7 },
  paletteOptionSelected: { transform: [{ scale: 1.04 }] },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  dynamicSwatchSplit: { ...StyleSheet.absoluteFill, flexDirection: 'row', overflow: 'hidden', borderRadius: 15 },
  dynamicSwatchLight: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  dynamicSwatchDark: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111' },
  dynamicSwatchDarkDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#111111' },
  dynamicSwatchLightDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  paletteName: { marginTop: 4, fontSize: 9, lineHeight: 12 },
  buttonThemePreview: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  finishButtonPreview: { minHeight: 38, borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  finishButtonPreviewText: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, fontWeight: '600' },
});

function parseStyle(value: string | null): ProfileCardStyle | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ProfileCardStyle>;
    const paletteIsValid = PROFILE_CARD_PALETTES.some((palette) => palette.id === parsed.palette);
    const artworkIsValid = PROFILE_CARD_ARTWORKS.some((artwork) => artwork.id === parsed.artwork);
    return paletteIsValid && artworkIsValid ? normalizeProfileCardStyle(parsed) : null;
  } catch {
    return null;
  }
}
