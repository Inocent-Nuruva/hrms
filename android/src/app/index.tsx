import { Redirect } from 'expo-router';

import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const auth = useAuth();

  if (auth.isLoading) {
    return null;
  }

  return <Redirect href={auth.isAuthenticated ? '/(tabs)' : '/login'} />;
}
