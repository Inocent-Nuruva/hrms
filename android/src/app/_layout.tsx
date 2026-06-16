import React from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme, type ViewStyle } from 'react-native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { COLORS } from '../lib/config';
import { useAuth } from '../hooks/useAuth';

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
      primaryContainer: isDark ? '#27272a' : '#f4f4f5',
      onPrimaryContainer: isDark ? '#f4f4f5' : '#18181b',
      secondary: COLORS.primary,
      surface: isDark ? COLORS.surfaceDark : COLORS.surface,
      surfaceVariant: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant,
      onSurface: isDark ? COLORS.onSurfaceDark : COLORS.onSurface,
      onSurfaceVariant: isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant,
      outline: isDark ? COLORS.outlineDark : COLORS.outline,
      background: isDark ? COLORS.backgroundDark : COLORS.background,
      elevation: {
        level0: isDark ? COLORS.backgroundDark : COLORS.background,
        level1: isDark ? '#141417' : '#fafafa',
        level2: isDark ? '#18181b' : '#f7f7f7',
        level3: isDark ? '#202024' : '#f4f4f5',
        level4: isDark ? '#242428' : '#f0f0f0',
        level5: isDark ? '#2a2a2f' : '#ebebeb',
      },
      error: COLORS.error,
      onError: '#ffffff',
    },
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const appTheme = createAppTheme(colorScheme);
  const auth = useAuth();

  // Always render providers + Stack.
  // Individual routes (login / tabs) will handle redirects based on auth.
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={appTheme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="index" />
          </Stack>

          {/* Global loading overlay while restoring session */}
          {auth.isLoading && (
            <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay, { backgroundColor: appTheme.colors.background }] }>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create<{ loadingOverlay: ViewStyle }>({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
