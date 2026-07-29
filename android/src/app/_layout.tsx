import React from 'react';
import { View, ActivityIndicator, StyleSheet, type ViewStyle, Platform } from 'react-native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

import { COLORS } from '../lib/config';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { NotificationsProvider } from '../hooks/useNotifications';
import { ThemePreferenceProvider, useThemePreference } from '../hooks/useThemePreference';
import { ToastProvider } from '../hooks/useToast';

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

function createAppTheme(colorScheme: 'light' | 'dark' | null | 'unspecified' | undefined) {
  const isDark = colorScheme === 'dark';
  const base = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: COLORS.primary,
      onPrimary: COLORS.onPrimary,
      primaryContainer: isDark ? '#1f2a5e' : '#e0e5f5',
      onPrimaryContainer: isDark ? '#e0e5f5' : '#1f2a5e',
      secondary: COLORS.accent,
      onSecondary: COLORS.onAccent,
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
  const appTheme = createAppTheme(colorScheme);

  return (
    <PaperProvider theme={appTheme}>
      <AuthProvider>
        <ToastProvider>
          <NotificationsProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <RootNavigator backgroundColor={appTheme.colors.background} />
          </NotificationsProvider>
        </ToastProvider>
      </AuthProvider>
    </PaperProvider>
  );
}

function RootNavigator({ backgroundColor }: { backgroundColor: string }) {
  const auth = useAuth();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="promotions" />
        <Stack.Screen name="shift" />
        <Stack.Screen name="payroll" />
      </Stack>

      {auth.isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay, { backgroundColor }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create<{ loadingOverlay: ViewStyle }>({
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
