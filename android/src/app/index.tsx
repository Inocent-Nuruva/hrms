import { Redirect } from 'expo-router';

export default function Index() {
  // expo-router root will decide between login or (tabs) via _layout
  return <Redirect href="/(tabs)" />;
}
