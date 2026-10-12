import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LoginScreen } from '../screens/LoginScreen';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../lib/config';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';

export default function LoginRoute() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  if (auth.isLoading) {
    return (
      <View style={styles.center}>
        <FluentActivityIndicator size="large" color={COLORS.primary} />
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
