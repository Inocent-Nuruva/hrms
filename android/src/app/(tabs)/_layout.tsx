import React, { useEffect } from 'react';
import { Tabs, useRouter, useRootNavigationState } from 'expo-router';
import { CalendarDays, Clock3, House, UserRound } from 'lucide-react-native';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../lib/config';
import { useThemePreference } from '../../hooks/useThemePreference';

interface AnimatedTabBarButtonProps {
  accessibilityState?: { selected?: boolean };
  children?: React.ReactNode;
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  style?: StyleProp<ViewStyle>;
}

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
          height: 68 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          shadowColor: '#000000',
          shadowOpacity: isDark ? 0.16 : 0.06,
          shadowOffset: { width: 0, height: -6 },
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginTop: 1 },
        tabBarItemStyle: {
          marginHorizontal: 6,
          marginVertical: 4,
          borderRadius: 18,
          paddingVertical: 2,
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        sceneStyle: {
          backgroundColor: isDark ? COLORS.backgroundDark : '#f7f4ef',
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
          title: 'Info',
          tabBarIcon: ({ color }) => <UserRound size={19} color={color} strokeWidth={2.25} />,
        }}
      />
    </Tabs>
  );
}

function AnimatedTabBarButton({
  accessibilityState,
  children,
  onLongPress,
  onPress,
  style,
  ...rest
}: AnimatedTabBarButtonProps) {
  const selected = Boolean(accessibilityState?.selected);
  const [scale] = React.useState(() => new Animated.Value(selected ? 1.04 : 1));
  const [translateY] = React.useState(() => new Animated.Value(selected ? -2 : 0));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: selected ? 1.04 : 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 5,
      }),
      Animated.spring(translateY, {
        toValue: selected ? -2 : 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 5,
      }),
    ]).start();
  }, [scale, selected, translateY]);

  return (
    <Pressable
      {...rest}
      accessibilityState={accessibilityState}
      onLongPress={onLongPress}
      onPress={onPress}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
