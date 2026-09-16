import React, { useEffect } from 'react';
import { Tabs, useRouter, useRootNavigationState } from 'expo-router';
import { CalendarDays, Clock3, House, UserRound } from 'lucide-react-native';
import {
  ActivityIndicator,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';

export default function TabLayout() {
  const auth = useAuth();
  const router = useRouter();
  const { isDark } = useThemePreference();
  const insets = useSafeAreaInsets();
  const navigationState = useRootNavigationState();

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
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
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
          tabBarIcon: ({ color }) => <House size={19} color={color} strokeWidth={2.25} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color }) => <Clock3 size={19} color={color} strokeWidth={2.25} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarIcon: ({ color }) => <CalendarDays size={19} color={color} strokeWidth={2.25} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <UserRound size={19} color={color} strokeWidth={2.25} />,
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
