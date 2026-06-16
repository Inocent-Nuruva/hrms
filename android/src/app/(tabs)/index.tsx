import React from 'react';
import { HomeScreen } from '../../screens/HomeScreen';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';

export default function HomeTab() {
  const auth = useAuth();
  const router = useRouter();
  return (
    <HomeScreen
      auth={auth}
      onTabChange={(tab) => {
        if (tab === 'attendance') router.push('/(tabs)/attendance');
        if (tab === 'leave') router.push('/(tabs)/leave');
      }}
    />
  );
}
