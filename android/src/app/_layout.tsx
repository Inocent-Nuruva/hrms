import React from 'react';
import { View, StyleSheet, type ViewStyle, Platform } from 'react-native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
  useFonts,
} from '@expo-google-fonts/comfortaa';

import { COLORS, setAppAccentColor } from '../lib/config';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { NotificationsProvider } from '../hooks/useNotifications';
import { ThemePreferenceProvider, useThemePreference } from '../hooks/useThemePreference';
import { ToastProvider } from '../hooks/useToast';
import { FluentThemeProvider } from '../components/providers/fluent-theme-provider';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteAccent, profilePaletteContainer, profilePaletteForeground } from '../lib/profile-card-background';
import { AppAccentProvider } from '../hooks/useAppAccent';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 1.5,
      gcTime: 1000 * 60 * 8,
    },
  },
});

function createAppTheme(colorScheme: 'light' | 'dark' | null | 'unspecified' | undefined, accent: string = COLORS.primary) {
  const isDark = colorScheme === 'dark';
  const base = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: accent,
      onPrimary: profilePaletteForeground(accent),
      primaryContainer: profilePaletteContainer(accent, isDark),
      onPrimaryContainer: isDark ? '#F4F4F5' : '#111111',
      secondary: accent,
      onSecondary: profilePaletteForeground(accent),
      surface: isDark ? COLORS.surfaceDark : COLORS.surface,
      surfaceVariant: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant,
      onSurface: isDark ? COLORS.onSurfaceDark : COLORS.onSurface,
      onSurfaceVariant: isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant,
      outline: isDark ? COLORS.outlineDark : COLORS.outline,
      background: isDark ? COLORS.backgroundDark : COLORS.background,
      elevation: {
        level0: isDark ? COLORS.backgroundDark : COLORS.background,
        level1: isDark ? '#1a2138' : '#f0f2f8',
        level2: isDark ? '#1f2740' : '#e8ebf5',
        level3: isDark ? '#242f5c' : '#e0e5f5',
        level4: isDark ? '#2a3566' : '#d8ddf0',
        level5: isDark ? '#2f3a70' : '#d0d8f0',
      },
      error: COLORS.error,
      onError: '#ffffff',
    },
  };
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <FluentThemeProvider isDark={false}>
        <View style={styles.fontLoader}>
          <FluentActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </FluentThemeProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>
          <ThemedApp />
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { colorScheme } = useThemePreference();
  return (
    <AuthProvider>
      <PaletteThemedApp colorScheme={colorScheme} />
    </AuthProvider>
  );
}

function PaletteThemedApp({ colorScheme }: { colorScheme: 'light' | 'dark' | null | 'unspecified' | undefined }) {
  const auth = useAuth();
  const styleQuery = useQuery({ queryKey: ['dashboardCardStyle'], queryFn: () => api.getMyDashboardCardStyle(), enabled: auth.isAuthenticated });
  const style = normalizeProfileCardStyle(styleQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const accent = profilePaletteAccent(style.palette, colorScheme === 'dark');
  setAppAccentColor(accent);
  const appTheme = createAppTheme(colorScheme, accent);
  return (
    <AppAccentProvider accent={accent}>
      <PaperProvider theme={appTheme}>
        <FluentThemeProvider isDark={colorScheme === 'dark'}>
          <ToastProvider>
            <NotificationsProvider>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <RootNavigator backgroundColor={appTheme.colors.background} />
            </NotificationsProvider>
          </ToastProvider>
        </FluentThemeProvider>
      </PaperProvider>
    </AppAccentProvider>
  );
}

function RootNavigator({ backgroundColor }: { backgroundColor: string }) {
  const auth = useAuth();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="promotions" />
        <Stack.Screen name="shift" />
        <Stack.Screen name="payroll" />
        <Stack.Screen name="field" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="activities" />
        <Stack.Screen name="notifications" />
      </Stack>

      {auth.isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay, { backgroundColor }]}>
          <FluentActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create<{ fontLoader: ViewStyle; loadingOverlay: ViewStyle }>({
  fontLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
