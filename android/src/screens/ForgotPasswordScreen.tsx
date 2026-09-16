import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, KeyRound, MoonStar, SunMedium } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api, type ApiError } from '../lib/api';
import { COLORS } from '../lib/config';
import { useThemePreference } from '../hooks/useThemePreference';
import { Text } from '../components/ui/text';

const SUCCESS_MESSAGE =
  'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const { height: windowHeight } = useWindowDimensions();
  const { isDark, toggleTheme } = useThemePreference();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const [email, setEmail] = React.useState(initialEmail || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const borderColor = isDark ? COLORS.outlineDark : COLORS.outline;

  const submit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.forgotPassword(email);
      setSuccess(SUCCESS_MESSAGE);
    } catch (requestError: unknown) {
      const status = (requestError as ApiError)?.status;
      if (status === 404 || status === 200) {
        setSuccess(SUCCESS_MESSAGE);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to send a reset link right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to sign in"
          onPress={() => router.replace('/login')}
          style={[styles.iconButton, { borderColor }]}
        >
          <ArrowLeft size={18} color={textColor} />
        </Pressable>
        <Pressable
          accessibilityLabel={isDark ? 'Use light theme' : 'Use dark theme'}
          onPress={toggleTheme}
          style={[styles.iconButton, { borderColor }]}
        >
          {isDark ? <SunMedium size={18} color={textColor} /> : <MoonStar size={18} color={textColor} />}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              minHeight: Math.max(windowHeight - 64, 0),
              justifyContent: windowHeight < 560 ? 'flex-start' : 'center',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={[styles.featureIcon, { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant }]}>
              <KeyRound size={22} color={COLORS.primary} />
            </View>
            <Text style={[styles.title, { color: textColor }]}>Forgot password</Text>
            <Text style={[styles.description, { color: mutedColor }]}>Request a one-time link to reset your account password.</Text>

            <View style={styles.form}>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@company.com"
                value={email}
              />

              {error ? (
                <View style={[styles.message, styles.errorMessage]}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={[styles.message, styles.successMessage]}>
                  <CheckCircle2 size={18} color={COLORS.success} />
                  <Text style={[styles.successText, { color: textColor }]}>{success}</Text>
                </View>
              ) : null}

              <Button loading={loading} onPress={() => void submit()}>
                Send reset link
              </Button>

              <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} style={styles.backLink}>
                <Text style={styles.backLinkText}>Back to sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 360,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
  description: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Comfortaa_400Regular',
    lineHeight: 20,
  },
  form: {
    marginTop: 28,
  },
  message: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  errorMessage: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    fontFamily: 'Comfortaa_400Regular',
    lineHeight: 18,
  },
  successMessage: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  successText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Comfortaa_400Regular',
    lineHeight: 18,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
  },
});
