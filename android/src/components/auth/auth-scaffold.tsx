import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FluentSystemIcon } from '../ui/fluent-system-icon';
import { FluentText as Text } from '../ui/fluent-text';
import { useThemePreference } from '../../hooks/useThemePreference';
import { COLORS } from '../../lib/config';
import allianceLogo from '../../../assets/images/alliance-logo-wide.png';

export function useAuthColors() {
  const { isDark, toggleTheme } = useThemePreference();
  return {
    isDark,
    toggleTheme,
    canvas: isDark ? '#0B1220' : '#F3F6FB',
    sheet: isDark ? '#141B26' : '#FFFFFF',
    text: isDark ? '#F4F7FB' : '#122033',
    muted: isDark ? '#A7B3C4' : '#5C6B7A',
    link: isDark ? '#8CCBFF' : COLORS.primary,
    field: isDark ? '#101820' : '#F4F7FB',
    line: isDark ? '#2A3646' : '#E4EAF1',
    error: isDark ? '#F2B8B5' : '#B42318',
  };
}

export function authFieldStyle(backgroundColor: string) {
  return {
    borderRadius: 12,
    backgroundColor,
    minHeight: 52,
    fontSize: 16,
  };
}

export function AuthScaffold({
  onBack,
  children,
}: {
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const colors = useAuthColors();
  const heroHeight = (windowHeight < 760 ? 188 : 216) + insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <StatusBar style="light" />
      <View style={[styles.hero, { height: heroHeight, backgroundColor: colors.isDark ? '#0A3F78' : COLORS.primary }]}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Back to sign in"
            hitSlop={8}
            onPress={onBack}
            style={[styles.heroButton, { top: insets.top + 8, left: 16 }]}
          >
            <FluentSystemIcon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={colors.isDark ? 'Use light theme' : 'Use dark theme'}
          hitSlop={8}
          onPress={colors.toggleTheme}
          style={[styles.heroButton, { top: insets.top + 8, right: 16 }]}
        >
          <FluentSystemIcon name={colors.isDark ? 'sun' : 'moon'} size={20} color="#FFFFFF" />
        </Pressable>
        <View style={[styles.heroBody, { paddingTop: insets.top }]}>
          <View style={styles.logoPlate}>
            <Image
              accessibilityLabel="Alliance Insurance"
              alt="Alliance Insurance"
              resizeMode="contain"
              source={allianceLogo}
              style={styles.logo}
            />
          </View>
          <Text style={styles.heroCaption}>Employee portal</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.sheet,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            {children}
            <Text style={[styles.footer, { color: colors.muted }]}>
              © {new Date().getFullYear()} Alliance Insurance Corporation Ltd
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    overflow: 'hidden',
  },
  heroBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
  },
  heroButton: {
    position: 'absolute',
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  logoPlate: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  logo: {
    width: 180,
    height: 66,
  },
  heroCaption: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  flex: {
    flex: 1,
    marginTop: -32,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  sheet: {
    flexGrow: 1,
    alignSelf: 'stretch',
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    shadowColor: '#0A3F78',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 0,
  },
  footer: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
});
