import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LoginScreen } from '../screens/LoginScreen';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../lib/config';

export default function LoginRoute() {
  const auth = useAuth();
  const router = useRouter();

  // Robust guard: if already authenticated, go to the main app
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  if (auth.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <LoginScreen auth={auth} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background, // will be overridden by theme in practice
  },
});
