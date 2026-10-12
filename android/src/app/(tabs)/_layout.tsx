import React, { useEffect } from 'react';
import { Tabs, useRouter, useRootNavigationState } from 'expo-router';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';
import { FluentActivityIndicator } from '../../components/ui/fluent-activity-indicator';
import { FluentSystemIcon } from '../../components/ui/fluent-system-icon';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent } from '../../lib/profile-card-background';

export default function TabLayout() {
  const auth = useAuth();
  const router = useRouter();
  const { isDark } = useThemePreference();
  const insets = useSafeAreaInsets();
  const navigationState = useRootNavigationState();
  const paletteQuery = useQuery({ queryKey: ['dashboardCardStyle'], queryFn: () => api.getMyDashboardCardStyle(), enabled: auth.isAuthenticated });
  const accent = profilePaletteAccent(normalizeProfileCardStyle(paletteQuery.data ?? DEFAULT_PROFILE_CARD_STYLE).palette, isDark);

  // Protect the entire tab group - redirect to login if session lost.
  // We wait for navigationState?.key so that expo-router's internal linking
  // (getInitialURL promise in useLinking.native) has a mounted navigator to
  // update. Without this, you can get:
  //   "Can't perform a React state update on a component that hasn't mounted yet"
  useEffect(() => {
    if (!navigationState?.key) return;

    if (!auth.isLoading && !auth.isAuthenticated) {
      // Use replace to avoid adding to history stack on cold start
      router.replace('/login');
    }
  }, [auth.isLoading, auth.isAuthenticated, router, navigationState?.key]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return (
      <View style={styles.center}>
        <FluentActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? COLORS.outlineDark : COLORS.outline,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarActiveBackgroundColor: 'transparent',
        sceneStyle: {
          backgroundColor: isDark ? COLORS.backgroundDark : COLORS.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <FluentSystemIcon name="home" active={focused} size={21} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <FluentSystemIcon
              name="attendance"
              size={21}
              color={String(color)}
              active={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarIcon: ({ color, focused }) => (
            <FluentSystemIcon
              name="leave"
              size={21}
              color={String(color)}
              active={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="performance"
        options={{
          title: 'KPIs',
          tabBarIcon: ({ color, focused }) => <FluentSystemIcon name="performance" active={focused} size={21} color={String(color)} />,
        }}
      />
      <Tabs.Screen name="location" options={{ href: null }} />
      <Tabs.Screen name="meetings" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <FluentSystemIcon name="settings" active={focused} size={21} color={String(color)} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
